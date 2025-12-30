import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ADK Web imports this file directly for agent discovery.
// Ensure env vars are loaded before importing any services/clients.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });

const { LlmAgent, FunctionTool } = await import('@google/adk');
const tools = await import('./tools.js');

// Define tools
const newsTool = new FunctionTool(tools.ingestNewsTool);
const jobsTool = new FunctionTool(tools.ingestJobsTool);
const insightsTool = new FunctionTool(tools.getCareerInsightsTool);
const searchTool = new FunctionTool(tools.searchJobsTool);
const overviewTool = new FunctionTool(tools.getOverviewTool);
const synthesisTool = new FunctionTool(tools.synthesizeReportTool);
const roadmapTool = new FunctionTool(tools.generateRoadmapTool);
const exploreRagTool = new FunctionTool(tools.exploreRagTool);

// 1) Career Planning Agent
export const careerPlanningAgent = new LlmAgent({
  name: 'CareerPlanningAgent',
  model: 'gemini-2.0-flash',
  description: 'Understands goals and plans long-term career strategies.',
  tools: [insightsTool, overviewTool, synthesisTool, newsTool],
  instructions: "You are the Career Planning Agent. You help users clarify career goals and create a long-term strategy (90 days to 2 years). Prefer calling getCareerInsights early using role and/or profileFreeText (do not block on missing skills). Use getOverview when market context is needed. Use synthesizeReport only when the user provides two text sources to combine. Ask at most 2 clarifying questions if needed; otherwise make reasonable assumptions and proceed."
});

// 2) Skill Gap & Roadmap Agent
export const skillGapRoadmapAgent = new LlmAgent({
  name: 'SkillGapRoadmapAgent',
  model: 'gemini-2.0-flash',
  description: 'Identifies missing skills and builds adaptive learning paths.',
  tools: [roadmapTool, insightsTool],
  instructions: "You are the Skill Gap & Roadmap Agent. When asked for a roadmap or skill-gap plan, call generateRoadmap with targetRole and any skills/experience you can infer from the user. If the user didn’t list skills, infer a reasonable baseline from their current role and proceed. Then explain the roadmap succinctly and propose a weekly execution plan."
});

// 3) RAG Intelligence Agent
export const ragIntelligenceAgent = new LlmAgent({
  name: 'RagIntelligenceAgent',
  model: 'gemini-2.0-flash',
  description: 'Retrieves verified data from policies, research, and industry sources.',
  tools: [exploreRagTool],
  instructions: "You are the RAG Intelligence Agent. Your job is to answer user questions using verified signals (market + geo/policy when configured). Always call exploreRag for substantive questions and return a single consolidated answer. If the question is vague, ask one clarifying question."
});

// 4) Feedback & Adaptation Agent
export const feedbackAdaptationAgent = new LlmAgent({
  name: 'FeedbackAdaptationAgent',
  model: 'gemini-2.0-flash',
  description: 'Learns from user progress and updates recommendations.',
  tools: [roadmapTool, insightsTool],
  instructions: "You are the Feedback & Adaptation Agent. Track what the user has already done in this session, ask for concrete progress signals (time/week, completed milestones, blockers), and update the plan accordingly. If the user wants an updated roadmap, call generateRoadmap again with updated skills and constraints, then summarize what changed and what to do next week."
});

// 5) Job Search & Application Agent
export const jobSearchApplicationAgent = new LlmAgent({
  name: 'JobSearchApplicationAgent',
  model: 'gemini-2.0-flash',
  description: 'Matches user profiles with relevant jobs, searches opportunities, and drafts application materials.',
  tools: [searchTool, jobsTool],
  instructions: "You are the Job Search & Application Agent. Use searchJobs to find opportunities (ask for location if missing). Use ingestJobs only when the user explicitly asks to ingest/sync job data. You can also draft tailored resume bullets, cold emails, and cover letters directly in your response."
});

export const agents = {
  careerPlanningAgent,
  skillGapRoadmapAgent,
  ragIntelligenceAgent,
  feedbackAdaptationAgent,
  jobSearchApplicationAgent
};
