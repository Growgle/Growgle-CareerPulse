import geminiClient from '../vertexclient/geminiClient.js';

class RoadmapService {
  async generateRoadmap(params = {}) {
    const {
      roadmapName = '',
      title,
      role,
      targetRole,
      skills = '',
      currentExperience = '',
      experience = '',
      targetDuration = ''
    } = params || {};

    const requestedTitle = String(roadmapName || title || role || targetRole || '').trim();
    if (!requestedTitle) {
      throw new Error('Provide roadmapName (or title/role/targetRole)');
    }

    let userSkills = [];
    if (Array.isArray(skills)) {
      userSkills = skills.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof skills === 'string') {
      userSkills = skills.split(',').map((s) => s.trim()).filter(Boolean);
    }

    const exp = String(currentExperience || experience || '').trim();

    const prompt = `You are an expert career curriculum architect. Build a structured, realistic upskilling roadmap.
Target Role / Roadmap: ${requestedTitle}
User Skills (existing): ${userSkills.length ? userSkills.join(', ') : 'None provided'}
User Experience: ${exp || 'Not specified'}
Preferred Total Duration (optional hint): ${targetDuration || 'Not specified'}

OUTPUT REQUIREMENTS:
Return ONLY valid minified JSON (no markdown, no commentary before/after). Shape:
{
  "roadmapData": {
    "title": string,
    "totalDuration": string, // e.g. "12 months"
    "completionRate": number, // 0-100 integer
    "phases": [
      {
        "id": number,
        "title": string,
        "duration": string, // e.g. "3 months"
        "status": "completed" | "in-progress" | "pending",
        "progress": number, // 0-100
        "milestones": [
          {
            "id": number,
            "title": string,
            "type": "course" | "project" | "certification" | "reading" | "practice",
            "duration": string, // e.g. "3 weeks"
            "status": "completed" | "in-progress" | "pending",
            "provider": string
          }
        ]
      }
    ]
  },
  "certifications": [
    {
      "name": string,
      "provider": string,
      "difficulty": "Beginner" | "Intermediate" | "Advanced",
      "duration": string,
      "value": "High" | "Medium" | "Low",
      "priority": "Recommended" | "Optional" | "Stretch"
    }
  ]
}

LOGIC & RULES:
- Max 3 phases total. Max 2 milestones per phase. Order them logically (fundamentals -> specialization -> integration -> professional polish).
- A phase or milestone is 'completed' only if its core skills are already in user skills. Partially covered => 'in-progress'. Others 'pending'.
- completionRate (%) should reflect weighted progress over all milestones.
- Milestone durations: use weeks for granular items; phase duration sum should roughly match totalDuration.
- If no targetDuration provided, choose a realistic total (e.g., 6, 9, or 12 months) based on breadth.
- Ensure IDs are unique and sequential across milestones (phase ordering preserved) but milestone IDs must not reset inside a phase in a way that conflicts.
- Tailor content to ${requestedTitle}. Avoid generic filler.
- Include at least 1 project milestone each phase (except possibly a pure certification phase).
- Keep provider names credible (Official Docs, freeCodeCamp, Coursera, AWS, etc.).
- Output VALID JSON ONLY.`;

    const aiRaw = await geminiClient.generateContent(prompt, {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxTokens: 4000
    });

    const rawText = (aiRaw && aiRaw.text ? String(aiRaw.text).trim() : '');
    if (!rawText) {
      throw new Error('Empty response from model');
    }

    let parsed;
    try {
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      const candidate = firstBrace >= 0 && lastBrace > firstBrace ? rawText.slice(firstBrace, lastBrace + 1) : rawText;
      parsed = JSON.parse(candidate);
    } catch {
      throw new Error('Failed to parse model JSON');
    }

    return {
      success: true,
      roadmap: parsed.roadmapData,
      certifications: parsed.certifications || [],
      finishReason: aiRaw?.finishReason
    };
  }
}

export default new RoadmapService();
