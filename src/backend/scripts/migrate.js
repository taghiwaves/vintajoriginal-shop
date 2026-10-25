const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const migrations = [
  '001-create-tables.sql',
  '002-stripe-checkout.sql',
  '003-product-catalog.sql',
];

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [731942061]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    for (const name of migrations) {
      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
      if (existing.rowCount) continue;
      if (name === '001-create-tables.sql') {
        const schemaExists = await client.query("SELECT to_regclass('public.categories') IS NOT NULL AS ready");
        if (schemaExists.rows[0].ready) {
          await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
          continue;
        }
      }
      const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', name), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      console.log(`Applied ${name}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
});
