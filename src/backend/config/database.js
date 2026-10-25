const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL || '';
let connectionHost = process.env.DB_HOST || '';
if (!connectionHost && connectionString) {
  try { connectionHost = new URL(connectionString).hostname; } catch { /* Pool reports a malformed URL below. */ }
}
const requiredSettings = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingSettings = connectionString ? [] : requiredSettings.filter(name => !process.env[name]);
const databaseHost = connectionHost.toLowerCase();
const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseHost);
const isPrivateNetworkDatabase = process.env.DB_PRIVATE_NETWORK === 'true';

if (isProduction && missingSettings.length) {
  throw new Error(`Missing required database configuration: ${missingSettings.join(', ')}`);
}
if (isProduction && !isLocalDatabase && process.env.DB_SSL !== 'true' && !isPrivateNetworkDatabase) {
  throw new Error('Use TLS for a remote production database or explicitly mark its private network with DB_PRIVATE_NETWORK=true.');
}

const pool = new Pool({
  ...(connectionString ? { connectionString } : {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  }),
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
