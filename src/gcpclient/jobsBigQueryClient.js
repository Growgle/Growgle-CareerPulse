import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.PROJECT_ID;
const DATASET = process.env.BQ_JOBS_DATASET || 'jobs_dataset';
const TABLE = process.env.BQ_JOBS_TABLE || 'jobs_raw';

class JobsBigQueryClient {
  constructor() {
    this.bigquery = null;
  }

  initClient() {
    if (!this.bigquery) {
      this.bigquery = new BigQuery({ projectId: PROJECT_ID });
    }
    return this.bigquery;
  }

  async ensureDatasetAndTable() {
    const bq = this.initClient();
    const dataset = bq.dataset(DATASET);

    const [dsExists] = await dataset.exists();
    if (!dsExists) {
      await dataset.create();
      console.log(`📊 Jobs dataset ${DATASET} created`);
    }

    const table = dataset.table(TABLE);
    const [tblExists] = await table.exists();
    if (!tblExists) {
      const schema = [
        { name: 'job_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'title', type: 'STRING', mode: 'REQUIRED' },
        { name: 'company_name', type: 'STRING', mode: 'NULLABLE' },
        { name: 'location', type: 'STRING', mode: 'NULLABLE' },
        { name: 'employment_type', type: 'STRING', mode: 'NULLABLE' },
        { name: 'description', type: 'STRING', mode: 'NULLABLE' },
        { name: 'apply_link', type: 'STRING', mode: 'NULLABLE' },
        { name: 'ingested_at', type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()' }
      ];
      await table.create({ schema });
      console.log(`📋 Jobs table ${TABLE} created with schema`);
    }

    return { dataset: DATASET, table: TABLE };
  }

  async insertJobs(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    const bq = this.initClient();
    const table = bq.dataset(DATASET).table(TABLE);
    const cleaned = rows.map(r => ({
      job_id: String(r.job_id || ''),
      title: r.title || r.job_title || '',
      company_name: r.company_name || r.employer_name || null,
      location: r.location || r.job_city || r.job_country || null,
      employment_type: r.employment_type || r.job_employment_type || null,
      description: r.description || r.job_description || null,
      apply_link: r.apply_link || r.job_apply_link || null,
      ingested_at: new Date()
    })).filter(x => x.job_id && x.title);

    if (!cleaned.length) return 0;

    await table.insert(cleaned, { ignoreUnknownValues: false, skipInvalidRows: false });
    console.log(`✅ Inserted ${cleaned.length} jobs into ${DATASET}.${TABLE}`);
    return cleaned.length;
  }

  async fetchJobsForSync({ limit = 50, since } = {}) {
    const bq = this.initClient();
    const dataset = bq.dataset(DATASET);
    const table = dataset.table(TABLE);
    const projectPrefix = PROJECT_ID ? `\`${PROJECT_ID}.${DATASET}.${TABLE}\`` : `\`${DATASET}.${TABLE}\``;
    const sql = `
      SELECT job_id, title, company_name, location, employment_type, description, apply_link, ingested_at
      FROM ${projectPrefix}
      WHERE job_id IS NOT NULL AND title IS NOT NULL
        ${since ? 'AND ingested_at >= @since' : ''}
      ORDER BY ingested_at DESC
      LIMIT @limit
    `;
    const params = { limit: Number(limit) };
    const types = { limit: 'INT64' };
    if (since) {
      params.since = since instanceof Date ? since : new Date(since);
      types.since = 'TIMESTAMP';
    }
    const [job] = await bq.createQueryJob({ query: sql, params, types });
    const [rows] = await job.getQueryResults();
    return rows || [];
  }

  async fetchRandomJobs({ limit = 50 } = {}) {
    const bq = this.initClient();
    const fqtn = PROJECT_ID ? `\`${PROJECT_ID}.${DATASET}.${TABLE}\`` : `\`${DATASET}.${TABLE}\``;
    const sql = `
      SELECT job_id, title, company_name, location, employment_type, description, apply_link, ingested_at
      FROM ${fqtn}
      WHERE job_id IS NOT NULL AND title IS NOT NULL
      ORDER BY RAND()
      LIMIT @limit
    `;
    const params = { limit: Number(limit) };
    const types = { limit: 'INT64' };
    const [rows] = await bq.query({ query: sql, params, types });
    return rows || [];
  }
}

export default new JobsBigQueryClient();
