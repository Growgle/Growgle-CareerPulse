import { LlmAgent, FunctionTool } from '@google/adk';
import * as tools from './tools.js';

// Define tools
const newsTool = new FunctionTool(tools.ingestNewsTool);
const jobsTool = new FunctionTool(tools.ingestJobsTool);
const insightsTool = new FunctionTool(tools.getCareerInsightsTool);
const searchTool = new FunctionTool(tools.searchJobsTool);
const overviewTool = new FunctionTool(tools.getOverviewTool);
const synthesisTool = new FunctionTool(tools.synthesizeReportTool);

// 1. News Agent
export const newsAgent = new LlmAgent({
  name: 'NewsAgent',
  model: 'gemini-2.0-flash',
  description: 'Responsible for fetching and ingesting news articles related to career trends and industries.',
  tools: [newsTool],
  instructions: 'You are a news agent. Your goal is to find relevant news articles based on user queries and ingest them into the system. Use the ingestNews tool.'
});

// 2. Jobs Agent
export const jobsAgent = new LlmAgent({
  name: 'JobsAgent',
  model: 'gemini-2.0-flash',
  description: 'Responsible for fetching and ingesting job postings from external sources.',
  tools: [jobsTool],
  instructions: 'You are a jobs agent. Your goal is to find job postings based on user queries and ingest them into the system. Use the ingestJobs tool.'
});

// 3. Career Insights Agent
export const insightsAgent = new LlmAgent({
  name: 'InsightsAgent',
  model: 'gemini-2.0-flash',
  description: 'Analyzes user profiles to generate personalized career insights.',
  tools: [insightsTool],
  instructions: 'You are a career insights agent. Your goal is to provide personalized career advice using the getCareerInsights tool. This tool requires the user\'s current role and a list of skills. If the user does not provide these details, ask them clarifying questions to gather the necessary information before calling the tool. Be helpful and conversational.'
});

// 4. Job Search Agent
export const searchAgent = new LlmAgent({
  name: 'SearchAgent',
  model: 'gemini-2.0-flash',
  description: 'Helps users find specific job openings using the Talent API.',
  tools: [searchTool],
  instructions: 'You are a job search agent. Help users find jobs that match their criteria using the searchJobs tool. If the user does not specify a location or query, ask them for it.'
});

// 5. Overview Agent (Coordinator/Synthesis)
export const overviewAgent = new LlmAgent({
  name: 'OverviewAgent',
  model: 'gemini-2.0-flash',
  description: 'Provides a high-level market overview and synthesizes reports.',
  tools: [overviewTool, synthesisTool],
  instructions: 'You are an overview agent. Provide market overviews and synthesize complex reports based on available data. Use getOverview and synthesizeReport tools.'
});

export const agents = {
  newsAgent,
  jobsAgent,
  insightsAgent,
  searchAgent,
  overviewAgent
};
