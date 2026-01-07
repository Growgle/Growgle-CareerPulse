import express from 'express';
import jobsService, { syncBqToTalent, bqFetchLatestJobs, bqSearchIngestedJobs } from '../services/jobsService.js';

const router = express.Router();

// Ingest jobs from RapidAPI into BigQuery
router.post('/ingest', async (req, res) => {
  try {
    const { query = 'software engineer in india', page = 1 } = req.body || {};
    const result = await jobsService.fetchAndIngestRapidJobs({ query, page });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Jobs ingest error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Talent: create company
router.post('/talent/company', async (req, res) => {
  try {
    const { displayName, externalId } = req.body || {};
    const result = await jobsService.talentCreateCompany({ displayName, externalId });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Talent create company error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Talent: create job
router.post('/talent/job', async (req, res) => {
  try {
    const jobData = req.body || {};
    const result = await jobsService.talentCreateJob(jobData);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Talent create job error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Talent: search jobs
router.get('/talent/search', async (req, res) => {
  try {
    const { q, location, userId, domain, pageSize } = req.query || {};
    const result = await jobsService.talentSearchJobs({
      query: q || '',
      location: location || '',
      userId: userId || 'user-unknown',
      domain: domain || 'career-insights.app',
      pageSize: pageSize ? Number(pageSize) : 10
    });
    res.json({ success: true, matches: result });
  } catch (error) {
    console.error('Talent search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync BigQuery → Google Talent
router.post('/talent/sync', async (req, res) => {
  try {
    const { limit = 50, since, dryRun = false } = req.body || {};
    const result = await syncBqToTalent({ limit: Number(limit) || 50, since, dryRun: !!dryRun });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Talent sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// BigQuery: fetch latest N jobs
router.get('/latest', async (req, res) => {
  try {
    const { limit = '50' } = req.query || {};
    const rows = await bqFetchLatestJobs({ limit: Number(limit) || 50 });
    res.json({ success: true, source: 'bigquery', count: rows.length, jobs: rows });
  } catch (error) {
    console.error('Latest jobs fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// BigQuery: search ingested jobs (deterministic, dashboard-friendly)
router.post('/match', async (req, res) => {
  try {
    const { query = '', location = '', limit = 20 } = req.body || {};
    const q = String(query || '').trim();
    if (!q) {
      return res.status(400).json({ success: false, error: "'query' is required" });
    }

    const lim = Math.min(Number(limit) || 20, 100);
    const rows = await bqSearchIngestedJobs({ query: q, location: String(location || '').trim(), limit: lim });

    const normalizeIngestedAt = (v) => {
      if (!v) return null;
      if (typeof v === 'string') return v;
      if (v?.value) return String(v.value);
      if (v instanceof Date) return v.toISOString();
      return String(v);
    };

    const jobs = (rows || []).map((r) => ({
      job_id: r.job_id,
      title: r.title,
      company_name: r.company_name ?? null,
      location: r.location ?? null,
      employment_type: r.employment_type ?? null,
      description: r.description ?? null,
      apply_link: r.apply_link ?? null,
      ingested_at: normalizeIngestedAt(r.ingested_at)
    }));

    res.json({
      success: true,
      source: 'bigquery',
      query: q,
      location: String(location || '').trim(),
      count: jobs.length,
      jobs
    });
  } catch (error) {
    console.error('Jobs match error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
