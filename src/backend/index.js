const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initializeDatabase } = require('./initDB');
const { query } = require('./config/database');
const { router: stripeRouter, stripeWebhook, releaseExpiredReservations } = require('./routes/stripeCheckout');
const { router: adminRouter } = require('./routes/adminCatalog');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const frontendPath = path.join(__dirname, '..', 'frontend');
let databaseReady = false;

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https:'],
      ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  hsts: isProduction ? { maxAge: 31536000 } : false,
}));

// The storefront is served from this origin. Add CORS only for explicitly named API clients.
if (allowedOrigins.length) {
  app.use('/api', cors({ origin: allowedOrigins, optionsSuccessStatus: 204 }));
}

// Stripe signs the exact raw request bytes, so this endpoint must be mounted
// before express.json() consumes/parses the body.
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhook);

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100 }));
app.use('/api/admin', adminRouter);
app.get('/admin', (req, res) => res.sendFile(path.join(frontendPath, 'admin', 'index.html')));
app.use(express.static(frontendPath, { dotfiles: 'deny', index: 'index.html' }));
app.use('/api/checkout', stripeRouter);

app.get('/api', (req, res) => {
  res.json({ message: 'Vintajoriginal API is running', status: 'ok' });
});

app.get('/health', (req, res) => {
  const status = databaseReady ? 'healthy' : 'degraded';
  res.status(200).json({
    status,
    database: databaseReady ? 'available' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

// Public catalog data comes from PostgreSQL so checkout can later validate prices
// and stock against the same source of truth.
app.get('/api/products', async (req, res, next) => {
  if (!databaseReady) return res.status(503).json({ error: 'Catalog unavailable' });
  try {
    const { rows } = await query(`
      SELECT p.sku, p.name_az, p.description_az, p.price_azn_qapik,
             p.brand, p.era, p.condition_az, p.stock_quantity,
             p.size_label, p.material, p.color, p.measurements,
             p.main_image_url, c.name_az AS category_name_az,
             p.category_id,
             COALESCE(
               json_agg(json_build_object('url', pi.url, 'altTextAz', pi.alt_text_az)
                        ORDER BY pi.sort_order, pi.id)
                 FILTER (WHERE pi.id IS NOT NULL),
               '[]'::json
             ) AS images
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.is_published = TRUE AND p.stock_quantity > 0
      GROUP BY p.id, c.name_az
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 100
    `);
    res.set('Cache-Control', 'no-store');
    res.json({ products: rows });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:sku', async (req, res, next) => {
  if (!databaseReady) return res.status(503).json({ error: 'Catalog unavailable' });
  try {
    const { rows } = await query(`
      SELECT p.sku, p.name_az, p.description_az, p.price_azn_qapik,
             p.brand, p.era, p.condition_az, p.stock_quantity,
             p.size_label, p.material, p.color, p.measurements,
             p.main_image_url, c.name_az AS category_name_az,
             p.category_id,
             COALESCE(
               json_agg(json_build_object('url', pi.url, 'altTextAz', pi.alt_text_az)
                        ORDER BY pi.sort_order, pi.id)
                 FILTER (WHERE pi.id IS NOT NULL),
               '[]'::json
             ) AS images
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.sku = $1 AND p.is_published = TRUE AND p.stock_quantity > 0
      GROUP BY p.id, c.name_az
      LIMIT 1
    `, [req.params.sku]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.set('Cache-Control', 'no-store');
    res.json({ product: rows[0] });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Unhandled request error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  databaseReady = await initializeDatabase();
  if (!databaseReady && isProduction) {
    throw new Error('Database is required in production.');
  }
  if (databaseReady) {
    const reservationCleanup = setInterval(() => {
      releaseExpiredReservations().catch(error => {
        console.error('Expired checkout reservation cleanup failed:', error.message);
      });
    }, 60_000);
    reservationCleanup.unref();
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server is listening on ${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend served from: ${frontendPath}`);
    if (!databaseReady) console.warn('Database is unavailable; only database-independent pages are ready.');
  });

  server.on('error', error => {
    console.error('Server failed to start:', error.message);
    process.exitCode = 1;
  });
}

start().catch(error => {
  console.error('Application startup failed:', error.message);
  process.exitCode = 1;
});

module.exports = app;
