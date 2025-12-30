const { LlmAgent } = require('@google/adk');
const { loadEnvFromRepoRoot, makeTools } = require('../_shared');

loadEnvFromRepoRoot(__dirname);
const { generateRoadmapTool, getCareerInsightsTool } = makeTools();

const rootAgent = new LlmAgent({
  name: 'SkillGapRoadmapAgent',
  model: 'gemini-2.0-flash',
  description: 'Identifies missing skills and builds adaptive learning paths.',
  tools: [generateRoadmapTool, getCareerInsightsTool],
  instructions: "You are the Skill Gap & Roadmap Agent. When asked for a roadmap or skill-gap plan, call generateRoadmap with targetRole and any skills/experience you can infer from the user. If the user didn’t list skills, infer a reasonable baseline from their current role and proceed. Then explain the roadmap succinctly and propose a weekly execution plan."
});

module.exports = { rootAgent };
