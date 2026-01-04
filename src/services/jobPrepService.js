import careerInsightsService from './careerInsightsService.js';
import roadmapService from './roadmapService.js';
import jobsService, { bqFetchLatestJobs } from './jobsService.js';
import geminiClient from '../vertexclient/geminiClient.js';

function extractJsonText(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return null;
  if (raw.startsWith('{') && raw.endsWith('}')) return raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) return raw.slice(firstBrace, lastBrace + 1);
  return null;
}

function cleanJsonText(candidate) {
  let s = String(candidate || '').trim();
  if (!s) return s;
  // Normalize “smart quotes” that sometimes appear in model output
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Remove JS-style comments if they appear (best-effort)
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1');
  return s.trim();
}

function parseModelJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty response from model');
  const candidate = extractJsonText(raw);
  if (!candidate) throw new Error('Failed to parse model JSON');
  try {
    return JSON.parse(candidate);
  } catch {
    // Retry with light cleanup (handles trailing commas/smart quotes)
    try {
      return JSON.parse(cleanJsonText(candidate));
    } catch {
      throw new Error('Failed to parse model JSON');
    }
  }
}

async function getJsonFromModel({ prompt, schemaHint }) {
  const aiRaw = await geminiClient.generateContent(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.4,
    maxTokens: 3600,
  });

  try {
    return { parsed: parseModelJson(aiRaw?.text), rawText: aiRaw?.text, finishReason: aiRaw?.finishReason };
  } catch {
    const repairPrompt = `You are a JSON repair tool. Regenerate STRICT valid minified JSON ONLY.

JSON SCHEMA (must match exactly):
${schemaHint}

IMPORTANT RULES:
- Return ONLY a single JSON object.
- Use double quotes for all keys and string values.
- No markdown, no code fences, no comments.
- Ensure the JSON is COMPLETE (must end with a closing }).

OUTPUT TO FIX (may be truncated / may include extra text):
${String(aiRaw?.text || '').slice(0, 12000)}

Return ONLY JSON.`;
    const repaired = await geminiClient.generateContent(repairPrompt, {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxTokens: 3600,
    });

    try {
      return { parsed: parseModelJson(repaired?.text), rawText: repaired?.text, finishReason: repaired?.finishReason };
    } catch (e) {
      const snippet = String(repaired?.text || aiRaw?.text || '').slice(0, 2000);
      if (process.env.DEBUG_AI_JSON === '1') {
        console.error('JobPrepService JSON parse failed. Raw model output (first 1200 chars):', snippet.slice(0, 1200));
      }
      // Attach snippet for upstream debug responses (only returned when DEBUG_AI_JSON=1)
      e.rawOutputSnippet = snippet;
      throw e;
    }
  }
}

function normalizeJobsForPrompt(jobs, { max = 10 } = {}) {
  const rows = Array.isArray(jobs) ? jobs : [];
  return rows.slice(0, max).map((j) => {
    const title = j.title || j.job_title || j.position || '';
    const company = j.company || j.company_name || j.employer || '';
    const location = j.location || j.job_location || j.city || j.region || '';
    const url = j.url || j.job_url || j.apply_url || '';
    const postedAt = j.postedAt || j.posted_at || j.publishedAt || j.published_at || '';
    const description = j.description || j.job_description || j.summary || '';
    const snippet = String(description).replace(/\s+/g, ' ').trim().slice(0, 280);
    return {
      title: String(title).slice(0, 140),
      company: String(company).slice(0, 140),
      location: String(location).slice(0, 140),
      url: String(url).slice(0, 500),
      postedAt: String(postedAt).slice(0, 80),
      descriptionSnippet: snippet,
    };
  });
}

function normalizeRoadmapForPrompt(roadmap) {
  const r = roadmap?.roadmap || roadmap || {};
  // Keep a compact subset to reduce prompt size while preserving intent.
  const targetRole = r.targetRole || r.role || '';
  const duration = r.targetDuration || r.duration || '';
  const milestones = Array.isArray(r.milestones) ? r.milestones.slice(0, 10) : [];
  const weeklyPlan = Array.isArray(r.weeklyPlan) ? r.weeklyPlan.slice(0, 12) : [];
  const skillsToLearn = Array.isArray(r.skillsToLearn) ? r.skillsToLearn.slice(0, 30) : [];

  return {
    targetRole,
    targetDuration: duration,
    skillsToLearn,
    weeklyPlan,
    milestones,
  };
}

class JobPrepService {
  async run({ targetRole, currentSkills = '', experience = '', location = '', targetDuration = '', careerPath = 'job' } = {}) {
    const role = String(targetRole || '').trim();
    if (!role) throw new Error('Provide targetRole');

    const skills = String(currentSkills || '').trim();
    const exp = String(experience || '').trim();
    const loc = String(location || '').trim();
    const path = String(careerPath || 'job').toLowerCase();
    
    // Validate career path
    const validPaths = ['job', 'startup'];
    const finalPath = validPaths.includes(path) ? path : 'job';

    // 1) Roadmap (structured JSON from existing service)
    const roadmap = await roadmapService.generateRoadmap({
      targetRole: role,
      skills,
      currentExperience: exp,
      targetDuration: String(targetDuration || '').trim(),
    });

    // 2) Market insights (plain text) - helpful for gap analysis context
    let insights = null;
    try {
      insights = await careerInsightsService.generateCareerInsights({
        role,
        skills,
        experience: exp || 'mid-level',
        location: loc,
      });
    } catch {
      insights = null;
    }

    // 3) Jobs (skip if founding a startup)
    let jobs = [];
    let jobsSource = '';
    const shouldFetchJobs = finalPath !== 'startup' || (finalPath === 'startup' && loc);
    
    if (shouldFetchJobs) {
      if (loc) {
        jobs = await jobsService.talentSearchJobs({ query: role, location: loc });
        jobsSource = 'talent_api';
      } else {
        const rows = await bqFetchLatestJobs({ limit: 25 });
        jobs = Array.isArray(rows) ? rows : [];
        jobsSource = 'bigquery_latest';
      }
    }

    const jobsForPrompt = normalizeJobsForPrompt(jobs, { max: 10 });
    const roadmapForPrompt = normalizeRoadmapForPrompt(roadmap);

    // 4) Consolidate into one plan (LLM) as strict JSON
    const schemaHint = `{
  "assumptions": [string],
  "careerPath": string,
  "gapAnalysis": {
    "strengths": [string],
    "gaps": [string],
    "prioritySkills": [string]
  },
  "learningPlan": {
    "roadmapSummary": string,
    "weeklyPlan": [
      { "week": number, "focus": string, "deliverables": [string] }
    ]
  },
  "careerStrategy": {
    "recommendedPaths": [string],
    "opportunities": [
      { "type": string, "title": string, "company": string, "location": string, "whyFit": string }
    ],
    "actionPlan": [string]
  },
  "startupGuidance": {
    "mvpSteps": [string],
    "fundingOptions": [string],
    "networking": [string]
  }
}`;

    const careerPathContext = {
      job: 'traditional employment (full-time, part-time, contract)',
      startup: 'founding or joining an early-stage startup'
    };

    const aiPrompt = `You are a comprehensive career preparation coach. Build an end-to-end plan: gap analysis → learning plan → career strategy.

INPUTS
Target role: ${role}
Career path: ${finalPath} (${careerPathContext[finalPath] || 'general'})
Current skills: ${skills || 'Not provided'}
Experience: ${exp || 'Not provided'}
Location: ${loc || 'Not provided'}

CAREER INSIGHTS (if available)
${insights?.insights?.aiAdvice ? String(insights.insights.aiAdvice).slice(0, 2500) : 'N/A'}

ROADMAP SUMMARY (authoritative)
${JSON.stringify(roadmapForPrompt).slice(0, 6000)}

${shouldFetchJobs ? `OPPORTUNITIES (jobs/gigs/roles)
${JSON.stringify(jobsForPrompt).slice(0, 6000)}` : 'OPPORTUNITIES: User is founding a startup, skip job listings.'}

OUTPUT REQUIREMENTS
Return ONLY valid minified JSON. Shape:
{
  "assumptions": [string],
  "careerPath": "${finalPath}",
  "gapAnalysis": {
    "strengths": [string],
    "gaps": [string],
    "prioritySkills": [string]
  },
  "learningPlan": {
    "roadmapSummary": string,
    "weeklyPlan": [
      { "week": number, "focus": string, "deliverables": [string] }
    ]
  },
  "careerStrategy": {
    "recommendedPaths": [string],
    "opportunities": [
      { "type": string, "title": string, "company": string, "location": string, "whyFit": string }
    ],
    "actionPlan": [string]
  },
  "startupGuidance": {
    "mvpSteps": [string],
    "fundingOptions": [string],
    "networking": [string]
  }
}

RULES
- weeklyPlan: EXACTLY 8 weeks. Keep deliverables concrete.
- careerStrategy.opportunities: up to 8 items. Set "type" to "job" or "startup".
- If careerPath is "startup", populate startupGuidance with actionable MVP steps (3-5), funding options (3-4), and networking tips (2-3).
- If careerPath is "job", set startupGuidance to {"mvpSteps": [], "fundingOptions": [], "networking": []}.
- Be realistic, no fluff.`;

    const { parsed: plan, finishReason } = await getJsonFromModel({ prompt: aiPrompt, schemaHint });

    return {
      success: true,
      targetRole: role,
      careerPath: finalPath,
      jobsSource: shouldFetchJobs ? jobsSource : 'N/A (startup founder)',
      roadmap,
      insights: insights ? { success: insights.success, trending: insights.insights?.trending || [] } : null,
      result: plan,
      finishReason,
      generatedAt: new Date().toISOString(),
    };
  }
}

export default new JobPrepService();
