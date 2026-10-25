const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const requiredSettings = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingSettings = requiredSettings.filter(name => !process.env[name]);
const databaseHost = (process.env.DB_HOST || '').toLowerCase();
const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseHost);

if (isProduction && missingSettings.length) {
  throw new Error(`Missing required database configuration: ${missingSettings.join(', ')}`);
}
if (isProduction && !isLocalDatabase && process.env.DB_SSL !== 'true') {
  throw new Error('DB_SSL=true is required for a remote production database.');
}

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 10000,
});

pool.on('error', error => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
