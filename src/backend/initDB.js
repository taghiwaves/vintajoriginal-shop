const { query } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  const isProduction = process.env.NODE_ENV === 'production';
  try {
    await query('SELECT 1');

    const { rows } = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'categories'
      );
    `);

    if (!rows[0].exists) {
      if (isProduction) {
        throw new Error('Database schema is missing; apply migrations before starting.');
      }
      const schemaPath = path.join(__dirname, 'migrations', '001-create-tables.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await query(schema);
      console.log('Development database schema created.');
    }

    const checkoutMigrationPath = path.join(__dirname, 'migrations', '002-stripe-checkout.sql');
    const catalogMigrationPath = path.join(__dirname, 'migrations', '003-product-catalog.sql');
    if (!isProduction) {
      await query(fs.readFileSync(checkoutMigrationPath, 'utf8'));
      await query(fs.readFileSync(catalogMigrationPath, 'utf8'));
    } else {
      const { rows: migrationState } = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'orders'
             AND column_name = 'stripe_checkout_session_id'
        ) AS checkout_ready,
        to_regclass('public.stripe_webhook_events') IS NOT NULL AS webhook_ready,
        EXISTS (
          SELECT FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'products'
             AND column_name = 'is_published'
        ) AS catalog_ready
      `);
      if (!migrationState[0].checkout_ready || !migrationState[0].webhook_ready || !migrationState[0].catalog_ready) {
        throw new Error('Database migrations are missing; apply migrations 002 and 003 before starting.');
      }
    }

    return true;
  } catch (error) {
    if (isProduction) throw error;
    console.warn('Database is unavailable in development:', error.message);
    return false;
  }
}

module.exports = { initializeDatabase };
