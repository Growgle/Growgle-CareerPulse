const { LlmAgent } = require('@google/adk');
const { loadEnvFromRepoRoot, makeTools } = require('../_shared');

loadEnvFromRepoRoot(__dirname);
const { exploreRagTool } = makeTools();

const rootAgent = new LlmAgent({
  name: 'RagIntelligenceAgent',
  model: 'gemini-2.0-flash',
  description: 'Retrieves verified data from policies, research, and industry sources.',
  tools: [exploreRagTool],
  instructions: "You are the RAG Intelligence Agent. Your job is to answer user questions using verified signals (market + geo/policy when configured). Always call exploreRag for substantive questions and return a single consolidated answer. If the question is vague, ask one clarifying question."
});

module.exports = { rootAgent };
