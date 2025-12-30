import careerInsightsService from '../services/careerInsightsService.js';
import jobsService from '../services/jobsService.js';
import overviewService from '../services/overviewService.js';
import synthesisService from '../services/synthesisService.js';
import roadmapService from '../services/roadmapService.js';
import ragIntelligenceService from '../services/ragIntelligenceService.js';

// Tool definitions

function normalizeToolResult(result) {
  if (result === undefined) return {};
  if (result === null) return { value: null };
  if (Array.isArray(result)) return { items: result };
  if (typeof result === 'object') return result;
  return { value: result };
}

function throwAdkJsonError(code, message) {
  // ADK tries to JSON.parse(error.message) for model/tool errors.
  throw new Error(JSON.stringify({ error: { code, message } }));
}

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
    return normalizeToolResult(await careerInsightsService.ingestNews(query, { pageSize, includeTrends }));
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
    return normalizeToolResult(await jobsService.fetchAndIngestRapidJobs({ query, page }));
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
    // NOTE: @google/genai rejects schemas that contain both `type` and `anyOf`.
    // We'll validate this requirement at runtime instead.
  },
  execute: async (userProfile) => {
    const hasRole = Boolean(userProfile?.role && String(userProfile.role).trim());
    const hasFreeText = Boolean(userProfile?.profileFreeText && String(userProfile.profileFreeText).trim());
    if (!hasRole && !hasFreeText) {
      throwAdkJsonError(400, "getCareerInsights requires either 'role' or 'profileFreeText'.");
    }
    return normalizeToolResult(await careerInsightsService.generateCareerInsights(userProfile));
  }
};

export const generateRoadmapTool = {
  name: 'generateRoadmap',
  description: 'Builds a structured skill-gap roadmap (phases + milestones + suggested certifications) for a target role.',
  parameters: {
    type: 'object',
    properties: {
      targetRole: { type: 'string', description: 'The target role/title to build a roadmap for.' },
      skills: { type: 'string', description: 'Comma-separated current skills.' },
      currentExperience: { type: 'string', description: 'Current experience (free text).' },
      targetDuration: { type: 'string', description: 'Optional hint like "6 months" / "12 months".' }
    },
    required: ['targetRole']
  },
  execute: async ({ targetRole, skills, currentExperience, targetDuration }) => {
    return normalizeToolResult(await roadmapService.generateRoadmap({ targetRole, skills, currentExperience, targetDuration }));
  }
};

export const exploreRagTool = {
  name: 'exploreRag',
  description: 'Retrieves and consolidates market signals + geo/policy context into a single verified answer.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'User question to investigate.' },
      role: { type: 'string', description: 'Optional role context.' },
      skills: { type: 'string', description: 'Optional skills context.' },
      experience: { type: 'string', description: 'Optional experience level.' },
      interests: { type: 'string', description: 'Optional interests.' },
      location: { type: 'string', description: 'Optional location.' },
      profileFreeText: { type: 'string', description: 'Optional full user narrative.' },
      includeTrending: { type: 'boolean', description: 'Include trending skills signal (default true).' }
    },
    required: ['question']
  },
  execute: async ({ question, includeTrending, ...profile }) => {
    return normalizeToolResult(await ragIntelligenceService.explore({
      question,
      profile,
      includeTrending: includeTrending !== false
    }));
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
    return normalizeToolResult(await jobsService.talentSearchJobs({ query, location }));
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
    return normalizeToolResult(await overviewService.getOverview({ query: industry, role, skills }));
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
    return normalizeToolResult(await synthesisService.synthesize({ realTimeText, governmentText, role, question }));
  }
};
