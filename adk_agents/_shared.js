const path = require('path');
const dotenv = require('dotenv');
const { FunctionTool } = require('@google/adk');

function normalizeToolResult(result) {
  if (result === undefined) return {};
  if (result === null) return { value: null };
  if (Array.isArray(result)) return { items: result };
  if (typeof result === 'object') return result;
  return { value: result };
}

function throwAdkJsonError(code, message) {
  throw new Error(JSON.stringify({ error: { code, message } }));
}

function loadEnvFromRepoRoot(fromDir) {
  // fromDir = __dirname of agent folder, e.g. adk_agents/newsAgent
  dotenv.config({ path: path.resolve(fromDir, '../../.env') });
}

function makeTool(definition) {
  return new FunctionTool(definition);
}

function makeTools() {
  const ingestNewsTool = makeTool({
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
      const svc = (await import('../../src/services/careerInsightsService.js')).default;
      return normalizeToolResult(await svc.ingestNews(query, { pageSize, includeTrends }));
    }
  });

  const ingestJobsTool = makeTool({
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
      const svc = (await import('../../src/services/jobsService.js')).default;
      return normalizeToolResult(await svc.fetchAndIngestRapidJobs({ query, page }));
    }
  });

  const getCareerInsightsTool = makeTool({
    name: 'getCareerInsights',
    description: 'Generates career insights based on a user profile.',
    parameters: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Current role of the user.' },
        skills: { type: 'string', description: 'Comma-separated list of skills.' },
        experience: { type: 'string', description: 'Experience level (e.g., "mid-level").' },
        profileFreeText: { type: 'string', description: 'Additional context about the user.' }
      }
    },
    execute: async (userProfile) => {
      const svc = (await import('../../src/services/careerInsightsService.js')).default;
      const hasRole = Boolean(userProfile?.role && String(userProfile.role).trim());
      const hasFreeText = Boolean(userProfile?.profileFreeText && String(userProfile.profileFreeText).trim());
      if (!hasRole && !hasFreeText) {
        throwAdkJsonError(400, "getCareerInsights requires either 'role' or 'profileFreeText'.");
      }
      return normalizeToolResult(await svc.generateCareerInsights(userProfile));
    }
  });

  const generateRoadmapTool = makeTool({
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
      const svc = (await import('../../src/services/roadmapService.js')).default;
      return normalizeToolResult(await svc.generateRoadmap({ targetRole, skills, currentExperience, targetDuration }));
    }
  });

  const exploreRagTool = makeTool({
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
      const svc = (await import('../../src/services/ragIntelligenceService.js')).default;
      return normalizeToolResult(await svc.explore({ question, profile, includeTrending: includeTrending !== false }));
    }
  });

  const searchJobsTool = makeTool({
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
      const svc = (await import('../../src/services/jobsService.js')).default;
      return normalizeToolResult(await svc.talentSearchJobs({ query, location }));
    }
  });

  const getOverviewTool = makeTool({
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
      const svc = (await import('../../src/services/overviewService.js')).default;
      return await svc.getOverview({ query: industry, role, skills });
    }
  });

  const synthesizeReportTool = makeTool({
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
      const svc = (await import('../../src/services/synthesisService.js')).default;
      return await svc.synthesize({ realTimeText, governmentText, role, question });
    }
  });

  return {
    ingestNewsTool,
    ingestJobsTool,
    getCareerInsightsTool,
    generateRoadmapTool,
    exploreRagTool,
    searchJobsTool,
    getOverviewTool,
    synthesizeReportTool,
  };
}

module.exports = {
  loadEnvFromRepoRoot,
  makeTools,
};
