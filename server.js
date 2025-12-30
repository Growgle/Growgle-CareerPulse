import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createRequire } from 'module';
import insightsRoutes from './src/routes/insightsRoutes.js';
import jobsRoutes from './src/routes/jobsRoutes.js';
import { agents as srcAgents } from './src/agents/agent.js';
import { InMemoryRunner } from '@google/adk';

function loadAdkAgents() {
  const require = createRequire(import.meta.url);
  const baseDir = path.resolve(process.cwd(), 'adk_agents');
  const agentDirs = [
    'careerPlanningAgent',
    'skillGapRoadmapAgent',
    'ragIntelligenceAgent',
    'feedbackAdaptationAgent',
    'jobSearchApplicationAgent'
  ];

  const loaded = {};
  for (const dirName of agentDirs) {
    // Each adk_agents/<name>/agent.js exports { rootAgent }
    const mod = require(path.join(baseDir, dirName, 'agent.js'));
    if (!mod?.rootAgent) {
      throw new Error(`adk_agents/${dirName}/agent.js must export rootAgent`);
    }
    loaded[dirName] = mod.rootAgent;
  }
  return loaded;
}

const agents = (process.env.AGENTS_SOURCE || '').toLowerCase() === 'adk_agents'
  ? loadAdkAgents()
  : srcAgents;

console.log(`Agents source: ${(process.env.AGENTS_SOURCE || '').toLowerCase() === 'adk_agents' ? 'adk_agents (CommonJS)' : 'src/agents (ESM)'}`);

// Basic env validation & helpful warnings
const baseRequired = ['NEWS_API_KEY','PROJECT_ID'];
const baseMissing = baseRequired.filter(k => !process.env[k]);
if (baseMissing.length) {
  console.warn('Missing required env vars:', baseMissing.join(', '));
}

// Auth strategy detection
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('Auth: service account key file mode');
  console.log('   File:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
} else {
  console.log('Auth: Application Default Credentials (gcloud login)');
  console.log('Ensure you ran: gcloud auth application-default login');
}

const app = express();
const PORT = process.env.PORT || 3000;

const allowAll = (process.env.CORS_ORIGINS || '*') === '*';
const whitelist = allowAll
  ? []
  : process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

const corsOptions = {
  origin: allowAll
    ? true
    : function (origin, callback) {
        if (!origin || whitelist.includes(origin)) return callback(null, true);
        return callback(new Error('CORS: Origin not allowed'));
      },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files

// Routes
app.use('/api', insightsRoutes);
app.use('/api/jobs', jobsRoutes);

// Agent endpoint
const activeRunners = new Map(); // Store runners by sessionId

app.post('/api/agent/:name', async (req, res) => {
  const { name } = req.params;
  const { prompt, sessionId: providedSessionId } = req.body;

  const agent = agents[name];
  if (!agent) {
    return res.status(404).json({ error: `Agent '${name}' not found. Available agents: ${Object.keys(agents).join(', ')}` });
  }

  try {
    const userId = 'user-1';
    // Use provided sessionId or generate a new one
    const sessionId = providedSessionId || `session-${Date.now()}`;
    
    let runner;
    if (activeRunners.has(sessionId)) {
      runner = activeRunners.get(sessionId);
      // Optional: Check if the runner is for the same agent. 
      // For simplicity, we assume the session is tied to the agent it started with.
    } else {
      runner = new InMemoryRunner({ agent });
      activeRunners.set(sessionId, runner);
      
      // Initialize session for new runner
      await runner.sessionService.createSession({
        appName: runner.appName,
        userId,
        sessionId
      });
    }

    const iterator = runner.runAsync({
      userId,
      sessionId,
      newMessage: { role: 'user', parts: [{ text: prompt }] }
    });

    let finalResponse = '';
    for await (const event of iterator) {
      console.log('Agent Event:', JSON.stringify(event, null, 2));
      
      // Collect model responses
      if (event.content && event.content.role === 'model') {
        const textParts = event.content.parts.map(p => p.text || '').join('');
        finalResponse += textParts;
      }
    }

    res.json({ success: true, result: finalResponse, sessionId });
  } catch (error) {
    console.error(`Agent '${name}' error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'career-insights-api'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Career Insights API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      setup: '/api/setup',
      ingestNews: 'POST /api/ingest/news',
      insights: 'GET /api/insights?skills=python,js&role=engineer',
      jobs: {
        ingest: 'POST /api/jobs/ingest { query, page }',
        talent: {
          createCompany: 'POST /api/jobs/talent/company { displayName, externalId? }',
          createJob: 'POST /api/jobs/talent/job { title, company_name, description, apply_link, location, employment_type, job_id }',
          search: 'GET /api/jobs/talent/search?q=frontend+developer&location=Bangalore'
        }
      },
      agents: {
        run: 'POST /api/agent/:name { prompt }',
        available: Object.keys(agents)
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
