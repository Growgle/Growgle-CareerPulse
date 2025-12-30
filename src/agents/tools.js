import careerInsightsService from '../services/careerInsightsService.js';
import jobsService from '../services/jobsService.js';
import overviewService from '../services/overviewService.js';
import synthesisService from '../services/synthesisService.js';

// Tool definitions

export const ingestNewsTool = {
  name: 'ingestNews',
  description: 'Ingests news articles based on a query.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The topic to search for news about.' },
      pageSize: { type: 'number', description: 'Number of articles to fetch.' },
      includeTrends: { type: 'boolean', description: 'Whether to include Google Trends data.' }
    },
    required: ['query']
  },
  execute: async ({ query, pageSize, includeTrends }) => {
    return await careerInsightsService.ingestNews(query, { pageSize, includeTrends });
  }
};

export const ingestJobsTool = {
  name: 'ingestJobs',
  description: 'Ingests job postings from RapidAPI based on a query.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Job search query (e.g., "software engineer in india").' },
      page: { type: 'number', description: 'Page number for pagination.' }
    },
    required: ['query']
  },
  execute: async ({ query, page }) => {
    return await jobsService.fetchAndIngestRapidJobs({ query, page });
  }
};

export const getCareerInsightsTool = {
  name: 'getCareerInsights',
  description: 'Generates career insights based on a user profile.',
  parameters: {
    type: 'object',
    properties: {
      role: { type: 'string', description: 'Current role of the user.' },
      skills: { type: 'string', description: 'Comma-separated list of skills.' },
      experience: { type: 'string', description: 'Experience level (e.g., "mid-level").' },
      profileFreeText: { type: 'string', description: 'Additional context about the user.' }
    },
    required: ['role', 'skills']
  },
  execute: async (userProfile) => {
    return await careerInsightsService.generateCareerInsights(userProfile);
  }
};

export const searchJobsTool = {
  name: 'searchJobs',
  description: 'Searches for jobs using the Talent API.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query.' },
      location: { type: 'string', description: 'Location filter.' }
    },
    required: ['query']
  },
  execute: async ({ query, location }) => {
    return await jobsService.talentSearchJobs({ query, location });
  }
};

export const getOverviewTool = {
  name: 'getOverview',
  description: 'Provides a market overview.',
  parameters: {
    type: 'object',
    properties: {
      industry: { type: 'string', description: 'Industry to analyze (maps to query).' },
      role: { type: 'string', description: 'Role to analyze.' },
      skills: { type: 'string', description: 'Skills to analyze.' }
    },
    required: []
  },
  execute: async ({ industry, role, skills }) => {
    // Map industry to query as overviewService uses query for keywords
    return await overviewService.getOverview({ query: industry, role, skills }); 
  }
};

export const synthesizeReportTool = {
  name: 'synthesizeReport',
  description: 'Synthesizes a comprehensive report from text sources.',
  parameters: {
    type: 'object',
    properties: {
      realTimeText: { type: 'string', description: 'Text from real-time insights.' },
      governmentText: { type: 'string', description: 'Text from government datasets.' },
      role: { type: 'string', description: 'Target role for the report.' },
      question: { type: 'string', description: 'Specific question to answer.' }
    },
    required: ['realTimeText', 'governmentText']
  },
  execute: async ({ realTimeText, governmentText, role, question }) => {
    return await synthesisService.synthesize({ realTimeText, governmentText, role, question });
  }
};
