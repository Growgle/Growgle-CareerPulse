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
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  s = s.replace(/,\s*([}\]])/g, '$1');
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
    try {
      return JSON.parse(cleanJsonText(candidate));
    } catch {
      throw new Error('Failed to parse model JSON');
    }
  }
}

function normalizeJobInput(job) {
  const j = job && typeof job === 'object' ? job : {};
  const description = String(j.description || '').replace(/\s+/g, ' ').trim();
  return {
    job_id: j.job_id ?? null,
    title: j.title ?? null,
    company_name: j.company_name ?? null,
    location: j.location ?? null,
    employment_type: j.employment_type ?? null,
    fitScore: j.fitScore ?? null,
    // Keep prompt size bounded
    description: description ? description.slice(0, 12000) : null,
    requiredSkills: Array.isArray(j.requiredSkills) ? j.requiredSkills.slice(0, 50) : [],
  };
}

class InterviewPrepService {
  async generate({ job, candidateProfile = null } = {}) {
    const normalizedJob = normalizeJobInput(job);

    if (!normalizedJob.title && !normalizedJob.description) {
      throw new Error('Provide job.title and/or job.description');
    }

    const schemaHint = `{
  "commonQuestions": [string],
  "keySkillsFocus": [string]
}`;

    const prompt = `You are an interview preparation assistant.

INPUT JOB (JSON)
${JSON.stringify(normalizedJob)}

${candidateProfile ? `CANDIDATE PROFILE (JSON)\n${JSON.stringify(candidateProfile).slice(0, 6000)}\n\n` : ''}OUTPUT REQUIREMENTS (STRICT)
Return ONLY valid minified JSON matching this schema exactly:
${schemaHint}

RULES
- commonQuestions: 10-14 items, mix of behavioral + technical + role-specific based on the job description.
- keySkillsFocus: 8-12 items, concrete skills/topics to prepare (e.g., "MLOps pipelines", "CI/CD automation", "Distributed systems", "Cloud cost optimization").
- No markdown, no code fences, no extra keys, no commentary.`;

    const aiRaw = await geminiClient.generateContent(prompt, {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxTokens: 2400,
    });

    try {
      const parsed = parseModelJson(aiRaw?.text);
      return {
        success: true,
        interviewPrepData: parsed,
        finishReason: aiRaw?.finishReason,
        generatedAt: new Date().toISOString(),
      };
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
        maxTokens: 2400,
      });

      const parsed = parseModelJson(repaired?.text);
      return {
        success: true,
        interviewPrepData: parsed,
        finishReason: repaired?.finishReason,
        generatedAt: new Date().toISOString(),
      };
    }
  }
}

export default new InterviewPrepService();
