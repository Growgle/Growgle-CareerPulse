const { LlmAgent } = require('@google/adk');
const { loadEnvFromRepoRoot, makeTools } = require('../_shared');

loadEnvFromRepoRoot(__dirname);
const { searchJobsTool, ingestJobsTool } = makeTools();

const rootAgent = new LlmAgent({
  name: 'JobSearchApplicationAgent',
  model: 'gemini-2.0-flash',
  description: 'Matches user profiles with relevant jobs, searches opportunities, and drafts application materials.',
  tools: [searchJobsTool, ingestJobsTool],
  instructions: "You are the Job Search & Application Agent. Use searchJobs to find opportunities (ask for location if missing). Use ingestJobs only when the user explicitly asks to ingest/sync job data. You can also draft tailored resume bullets, cold emails, and cover letters directly in your response."
});

module.exports = { rootAgent };
