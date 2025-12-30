const { LlmAgent } = require('@google/adk');
const { loadEnvFromRepoRoot, makeTools } = require('../_shared');

loadEnvFromRepoRoot(__dirname);
const { getCareerInsightsTool, getOverviewTool, synthesizeReportTool, ingestNewsTool } = makeTools();

const rootAgent = new LlmAgent({
  name: 'CareerPlanningAgent',
  model: 'gemini-2.0-flash',
  description: 'Understands goals and plans long-term career strategies.',
  tools: [getCareerInsightsTool, getOverviewTool, synthesizeReportTool, ingestNewsTool],
  instructions: "You are the Career Planning Agent. You help users clarify career goals and create a long-term strategy (90 days to 2 years). Prefer calling getCareerInsights early using role and/or profileFreeText (do not block on missing skills). Use getOverview when market context is needed. Use synthesizeReport only when the user provides two text sources to combine. Ask at most 2 clarifying questions if needed; otherwise make reasonable assumptions and proceed."
});

module.exports = { rootAgent };
