const { LlmAgent } = require('@google/adk');
const { loadEnvFromRepoRoot, makeTools } = require('../_shared');

loadEnvFromRepoRoot(__dirname);
const { generateRoadmapTool, getCareerInsightsTool } = makeTools();

const rootAgent = new LlmAgent({
  name: 'FeedbackAdaptationAgent',
  model: 'gemini-2.0-flash',
  description: 'Learns from user progress and updates recommendations.',
  tools: [generateRoadmapTool, getCareerInsightsTool],
  instructions: "You are the Feedback & Adaptation Agent. Track what the user has already done in this session, ask for concrete progress signals (time/week, completed milestones, blockers), and update the plan accordingly. If the user wants an updated roadmap, call generateRoadmap again with updated skills and constraints, then summarize what changed and what to do next week."
});

module.exports = { rootAgent };
