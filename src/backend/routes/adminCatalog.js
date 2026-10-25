const crypto = require('crypto');
const express = require('express');
const path = require('path');
const { query, pool } = require('../config/database');

const router = express.Router();
const sessions = new Map();
const attempts = new Map();
const SESSION_MS = 8 * 60 * 60 * 1000;
const imageRoot = path.resolve(process.env.PRODUCT_IMAGES_DIR || path.resolve(__dirname, '../../frontend/images/products'));
const publicFields = `p.sku, p.name_az, p.description_az, p.price_azn_qapik,
  p.brand, p.era, p.condition_az, p.stock_quantity, p.size_label, p.material,
  p.color, p.measurements, p.main_image_url, p.is_published, c.name_az AS category_name_az,
  COALESCE(json_agg(json_build_object('id', pi.id, 'url', pi.url, 'altTextAz', pi.alt_text_az)
  ORDER BY pi.sort_order, pi.id) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS images`;

function getAdminPasswordHash() {
  if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
  try {
    const fs = require('fs');
    const dotenv = require('dotenv');
    const envPath = path.resolve(__dirname, '../../../.env');
    return dotenv.parse(fs.readFileSync(envPath, 'utf8')).ADMIN_PASSWORD_HASH || '';
  } catch { return ''; }
}

function isLocalSetupRequest(req) {
  const host = (req.hostname || '').toLowerCase();
  const address = (req.socket.remoteAddress || '').toLowerCase();
  return ['localhost', '127.0.0.1', '::1'].includes(host) &&
    (address === '::1' || address === '127.0.0.1' || address.startsWith('::ffff:127.'));
}

function passwordMatches(password, encoded) {
  const [scheme, salt, digest] = String(encoded || '').split('$');
  if (scheme !== 'scrypt' || !salt || !digest || !/^[a-f0-9]{128}$/i.test(digest)) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function originMatches(req) {
  const origin = req.get('origin');
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === req.get('host') && ['http:', 'https:'].includes(parsed.protocol);
  } catch { return false; }
}

function requireOrigin(req, res, next) {
  if (!originMatches(req)) return res.status(403).json({ error: 'Request origin rejected.' });
  next();
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.vintaj_admin;
  const expires = token && sessions.get(token);
  if (!expires || expires < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Please sign in again.' });
  }
  sessions.set(token, Date.now() + SESSION_MS);
  res.set('Cache-Control', 'no-store');
  next();
}

// Read cookies without adding a runtime dependency.
router.use((req, _res, next) => {
  const cookieHeader = req.headers.cookie || '';
  req.cookies = Object.fromEntries(cookieHeader.split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
  next();
});

router.get('/status', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ configured: Boolean(getAdminPasswordHash()) });
});

router.post('/setup', requireOrigin, (req, res) => {
  if (!isLocalSetupRequest(req)) return res.status(403).json({ error: 'First setup is available only from this computer at localhost.' });
  if (getAdminPasswordHash()) return res.status(409).json({ error: 'Admin password is already configured.' });
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const confirmation = typeof req.body?.confirmation === 'string' ? req.body.confirmation : '';
  if (password.length < 12 || password.length > 200) return res.status(400).json({ error: 'Use a password between 12 and 200 characters.' });
  if (password !== confirmation) return res.status(400).json({ error: 'The passwords do not match.' });
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  const envPath = path.resolve(__dirname, '../../../.env');
  const fs = require('fs');
  let contents = '';
  try { contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''; }
  catch { return res.status(500).json({ error: 'Could not read the local environment file.' }); }
  if (/^ADMIN_PASSWORD_HASH\s*=/m.test(contents)) return res.status(409).json({ error: 'Admin password is already configured.' });
  const entry = `ADMIN_PASSWORD_HASH=scrypt$${salt}$${digest}`;
  try { fs.writeFileSync(envPath, `${contents.replace(/[\r\n]*$/, '')}\n${entry}\n`, { mode: 0o600 }); }
  catch { return res.status(500).json({ error: 'Could not save the admin password to the project environment file.' }); }
  res.status(201).json({ ok: true });
});

router.post('/login', requireOrigin, async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const state = attempts.get(ip) || { count: 0, blockedUntil: 0 };
  if (state.blockedUntil > Date.now()) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const configuredHash = getAdminPasswordHash();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!configuredHash || password.length > 200 || !passwordMatches(password, configuredHash)) {
    state.count += 1;
    if (state.count >= 6) { state.count = 0; state.blockedUntil = Date.now() + 15 * 60 * 1000; }
    attempts.set(ip, state);
    return res.status(configuredHash ? 401 : 503).json({ error: configuredHash ? 'Incorrect password.' : 'Admin password is not configured. Run npm run admin:setup in the project folder.' });
  }
  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  res.cookie('vintaj_admin', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/api/admin', maxAge: SESSION_MS,
  });
  res.set('Cache-Control', 'no-store').json({ ok: true });
});

router.post('/logout', requireOrigin, (req, res) => {
  if (req.cookies.vintaj_admin) sessions.delete(req.cookies.vintaj_admin);
  res.clearCookie('vintaj_admin', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/admin' });
  res.json({ ok: true });
});

router.use(requireAdmin);
router.use((req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : requireOrigin(req, res, next));

router.get('/stripe-test-status', (_req, res) => {
  res.json({ configured: Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) });
});

router.post('/stripe-test-key', async (req, res) => {
  if (process.env.NODE_ENV === 'production' || !isLocalSetupRequest(req)) {
    return res.status(403).json({ error: 'Test keys can be configured only on the local development shop.' });
  }
  const secret = typeof req.body?.secretKey === 'string' ? req.body.secretKey.trim() : '';
  if (!/^sk_test_[A-Za-z0-9]{16,}$/.test(secret)) {
    return res.status(400).json({ error: 'Use the secret key beginning with sk_test_ from Stripe Test mode.' });
  }
  let verified = false;
  try {
    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return res.status(response.status === 401 ? 400 : 502).json({ error: response.status === 401 ? 'Stripe rejected this test key. Check that you copied the secret test key.' : 'Stripe could not verify the key right now.' });
    verified = true;
  } catch { /* Save locally; the UI will clearly state that Stripe could not verify it. */ }
  const envPath = path.resolve(__dirname, '../../../.env');
  const fs = require('fs');
  let contents = '';
  try { contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''; }
  catch { return res.status(500).json({ error: 'Could not read the local environment file.' }); }
  const line = `STRIPE_SECRET_KEY=${secret}`;
  const pattern = /^STRIPE_SECRET_KEY=.*$/m;
  const updated = pattern.test(contents) ? contents.replace(pattern, line) : `${contents.replace(/[\r\n]*$/, '')}\n${line}\n`;
  try { fs.writeFileSync(envPath, updated, { mode: 0o600 }); }
  catch { return res.status(500).json({ error: 'Could not save the test key to the ignored local .env file.' }); }
  process.env.STRIPE_SECRET_KEY = secret;
  res.json({ configured: true, verified });
});

router.get('/products', async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT ${publicFields} FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN product_images pi ON pi.product_id=p.id GROUP BY p.id,c.name_az ORDER BY p.created_at DESC,p.id DESC`);
    res.json({ products: rows });
  } catch (error) { next(error); }
});

function readProduct(body) {
  const text = (key, max, required = false) => {
    const value = typeof body?.[key] === 'string' ? body[key].trim() : '';
    if (required && !value) throw new Error(`${key} is required.`);
    if (value.length > max) throw new Error(`${key} is too long.`);
    return value;
  };
  const sku = text('sku', 100, true);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/.test(sku)) throw new Error('SKU may contain letters, numbers, underscores, and hyphens.');
  const price = Number(body?.price_azn);
  if (!Number.isFinite(price) || price <= 0 || price > 21474836.47) throw new Error('Enter a valid price in AZN.');
  const stock = Number(body?.stock_quantity ?? 1);
  if (!Number.isInteger(stock) || stock < 0 || stock > 10000) throw new Error('Enter a valid stock quantity.');
  return {
    sku, name: text('name_az', 255, true), description: text('description_az', 10000),
    price: Math.round(price * 100), category: text('category_name_az', 255, true),
    brand: text('brand', 255), era: text('era', 100), condition: text('condition_az', 255, true),
    size: text('size_label', 80), material: text('material', 160), color: text('color', 100),
    measurements: text('measurements', 2000), stock,
  };
}

async function upsertProduct(product, existingSku = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const foundCategory = await client.query('SELECT id FROM categories WHERE name_az=$1 ORDER BY id LIMIT 1 FOR UPDATE', [product.category]);
    const categoryId = foundCategory.rows[0]?.id ?? (await client.query('INSERT INTO categories (name_az) VALUES ($1) RETURNING id', [product.category])).rows[0].id;
    if (existingSku) {
      const result = await client.query(`UPDATE products SET name_az=$2,description_az=$3,price_azn_qapik=$4,category_id=$5,brand=NULLIF($6,''),era=NULLIF($7,''),condition_az=$8,stock_quantity=$9,size_label=$10,material=NULLIF($11,''),color=NULLIF($12,''),measurements=NULLIF($13,''),updated_at=NOW() WHERE sku=$1 RETURNING id`,
        [existingSku, product.name, product.description, product.price, categoryId, product.brand, product.era, product.condition, product.stock, product.size, product.material, product.color, product.measurements]);
      if (!result.rowCount) throw Object.assign(new Error('Product not found.'), { status: 404 });
    } else {
      await client.query(`INSERT INTO products (sku,name_az,description_az,price_azn_qapik,category_id,brand,era,condition_az,stock_quantity,size_label,material,color,measurements,is_published) VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),$8,$9,$10,NULLIF($11,''),NULLIF($12,''),NULLIF($13,''),FALSE)`,
        [product.sku, product.name, product.description, product.price, categoryId, product.brand, product.era, product.condition, product.stock, product.size, product.material, product.color, product.measurements]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

router.post('/products', async (req, res, next) => {
  try { await upsertProduct(readProduct(req.body)); res.status(201).json({ ok: true }); }
  catch (error) { if (error.code === '23505') return res.status(409).json({ error: 'That SKU already exists.' }); if (error.message?.includes('required') || error.message?.includes('valid') || error.message?.includes('too long') || error.message?.includes('SKU')) return res.status(400).json({ error: error.message }); next(error); }
});

router.put('/products/:sku', async (req, res, next) => {
  try { await upsertProduct(readProduct({ ...req.body, sku: req.params.sku }), req.params.sku); res.json({ ok: true }); }
  catch (error) { if (error.message?.includes('required') || error.message?.includes('valid') || error.message?.includes('too long') || error.message?.includes('SKU')) return res.status(400).json({ error: error.message }); next(error); }
});

router.patch('/products/:sku/publish', async (req, res, next) => {
  try {
    const publish = req.body?.is_published === true;
    const { rows } = await query(`UPDATE products SET is_published=$2,updated_at=NOW() WHERE sku=$1 AND ($2=FALSE OR (stock_quantity>0 AND main_image_url IS NOT NULL)) RETURNING sku,is_published`, [req.params.sku, publish]);
    if (!rows.length) return res.status(400).json({ error: 'Add stock and a main product image before publishing.' });
    res.json({ product: rows[0] });
  } catch (error) { next(error); }
});

router.post('/products/:sku/images', async (req, res, next) => {
  try {
    const { data, altTextAz = '' } = req.body || {};
    if (typeof data !== 'string' || data.length > 11_200_000) return res.status(400).json({ error: 'Choose an image smaller than 8 MB.' });
    if (typeof altTextAz !== 'string' || altTextAz.length > 255) return res.status(400).json({ error: 'Image description is too long.' });
    const match = data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ error: 'Use a JPG, PNG, or WebP image.' });
    const image = Buffer.from(match[2], 'base64');
    if (!image.length || image.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Choose an image smaller than 8 MB.' });
    const signature = match[1] === 'image/jpeg' ? image[0] === 0xff && image[1] === 0xd8
      : match[1] === 'image/png' ? image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : image.subarray(0, 4).toString() === 'RIFF' && image.subarray(8, 12).toString() === 'WEBP';
    if (!signature) return res.status(400).json({ error: 'The selected file is not a valid image.' });
    const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[match[1]];
    const filename = `${crypto.randomUUID()}${extension}`;
    const url = `/images/products/${filename}`;
    const product = await query('SELECT id FROM products WHERE sku=$1', [req.params.sku]);
    if (!product.rowCount) return res.status(404).json({ error: 'Product not found.' });
    const fs = require('fs/promises');
    await fs.mkdir(imageRoot, { recursive: true });
    await fs.writeFile(path.join(imageRoot, filename), image, { flag: 'wx' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const order = await client.query('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM product_images WHERE product_id=$1', [product.rows[0].id]);
      await client.query('INSERT INTO product_images(product_id,url,alt_text_az,sort_order) VALUES($1,$2,NULLIF($3,\'\'),$4)', [product.rows[0].id, url, altTextAz, order.rows[0].n]);
      await client.query('UPDATE products SET main_image_url=COALESCE(main_image_url,$2),updated_at=NOW() WHERE id=$1', [product.rows[0].id, url]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); await fs.unlink(path.join(imageRoot, filename)).catch(() => {}); throw error; }
    finally { client.release(); }
    res.status(201).json({ image: { url, altTextAz } });
  } catch (error) { next(error); }
});

router.delete('/products/:sku/images/:imageId', async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const product = await client.query('SELECT id,main_image_url FROM products WHERE sku=$1 FOR UPDATE', [req.params.sku]);
      if (!product.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Product not found.' }); }
      const image = await client.query('SELECT id,url FROM product_images WHERE id=$1 AND product_id=$2 FOR UPDATE', [req.params.imageId, product.rows[0].id]);
      if (!image.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Image not found.' }); }
      await client.query('DELETE FROM product_images WHERE id=$1', [image.rows[0].id]);
      const next = await client.query('SELECT url FROM product_images WHERE product_id=$1 ORDER BY sort_order,id LIMIT 1', [product.rows[0].id]);
      const main = product.rows[0].main_image_url === image.rows[0].url ? (next.rows[0]?.url || null) : product.rows[0].main_image_url;
      await client.query('UPDATE products SET main_image_url=$2,updated_at=NOW() WHERE id=$1', [product.rows[0].id, main]);
      await client.query('COMMIT');
      res.json({ ok: true, mainImageUrl: main });
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  } catch (error) { next(error); }
});

module.exports = { router };
