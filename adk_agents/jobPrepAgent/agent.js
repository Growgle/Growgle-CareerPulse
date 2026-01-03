const { LlmAgent } = require('@google/adk');
const { loadEnvFromRepoRoot, makeTools } = require('../_shared');

loadEnvFromRepoRoot(__dirname);

const {
  generateRoadmapTool,
  getCareerInsightsTool,
  getTrendingSkillsTool,
  validateSkillsAgainstMarketTool,
  searchJobsTool,
  getLatestJobsTool,
} = makeTools();

const rootAgent = new LlmAgent({
  name: 'JobPrepAgent',
  model: 'gemini-2.0-flash',
  description: 'One-stop job preparation workflow that covers skill gap analysis → learning plan → job search strategy and roles to apply for.',
  tools: [
    generateRoadmapTool,
    getCareerInsightsTool,
    getTrendingSkillsTool,
    validateSkillsAgainstMarketTool,
    searchJobsTool,
    getLatestJobsTool,
  ],
  instructions: `You are an expert End-to-End Job Prep Agent.

YOUR GOAL:
Deliver ONE cohesive workflow that covers:
1) Gap analysis
2) Learning plan
3) Job search plan + roles to apply for

WORKFLOW:
1. UNDERSTAND TARGET: Identify target role, location (if any), timeline, and current skills/experience.
2. GAP ANALYSIS:
   - Use getCareerInsights and/or validateSkillsAgainstMarket when helpful.
   - Clearly list missing skills vs. already-strong skills.
3. LEARNING PLAN:
   - Call generateRoadmap with targetRole + inferred skills/experience.
   - Convert roadmap into a week-by-week execution plan (8-12 weeks by default).
4. JOB SEARCH:
   - If location is provided, call searchJobs with query + location.
   - If location is missing, call getLatestJobs and filter logically by target role keywords.
   - Provide a short application plan (portfolio, networking, outreach message template).

OUTPUT FORMAT:
- Section 1: Gap Analysis
- Section 2: Learning Plan (Roadmap + weekly plan)
- Section 3: Job Search (top matches + strategy)

GUIDELINES:
- Ask up to 2 clarifying questions only if critical (usually location + seniority).
- Make reasonable assumptions when details are missing and state them.
- Keep the workflow practical and time-bounded.`
});

module.exports = { rootAgent };
