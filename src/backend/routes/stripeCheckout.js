const crypto = require('crypto');
const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
const CURRENCY = (process.env.STRIPE_CURRENCY || 'azn').toLowerCase();
const RESERVATION_MINUTES = 30;
const checkoutWindows = new Map();

function checkoutRateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const window = checkoutWindows.get(key);
  if (!window || now - window.startedAt >= 60_000) {
    checkoutWindows.set(key, { startedAt: now, count: 1 });
    if (checkoutWindows.size > 5000) {
      for (const [ip, value] of checkoutWindows) if (now - value.startedAt >= 60_000) checkoutWindows.delete(ip);
    }
    return next();
  }
  if (window.count >= 10) return res.status(429).json({ error: 'Bir az gözləyin və yenidən cəhd edin.' });
  window.count++;
  return next();
}

function amountSetting(name) {
  const value = process.env[name];
  if (value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function getCheckoutConfig(method) {
  const localStripeTest = process.env.NODE_ENV !== 'production' && process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
  let shipping = amountSetting(method === 'express'
    ? 'SHIPPING_EXPRESS_AZN_QAPIK'
    : 'SHIPPING_STANDARD_AZN_QAPIK');
  let taxRate = amountSetting('CHECKOUT_TAX_RATE_BPS');
  let taxInclusive = process.env.CHECKOUT_TAX_INCLUSIVE;
  // The seller-approved initial delivery fee is 4.99 AZN for standard delivery
  // across Azerbaijan. Production still requires explicit tax settings.
  if (localStripeTest) {
    if (shipping === null && method === 'standard') shipping = 499;
    if (taxRate === null) taxRate = 0;
    if (taxInclusive === undefined || taxInclusive === '') taxInclusive = 'true';
  }
  if (shipping === null || taxRate === null || taxRate > 100000 || !['true', 'false'].includes(taxInclusive)) return null;
  return { shipping, taxRate, taxInclusive: taxInclusive === 'true' };
}

function validString(value, max = 200) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function stripeSignatureValid(rawBody, signatureHeader, secret) {
  if (!Buffer.isBuffer(rawBody) || !signatureHeader || !secret) return false;
  const parts = signatureHeader.split(',').map(part => part.split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  return signatures.some(signature => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const actual = Buffer.from(signature, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  });
}

async function releaseOrderReservation(client, orderId) {
  const result = await client.query(`
    UPDATE orders
       SET status = 'cancelled', payment_status = 'failed',
           reservation_released_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND payment_status = 'pending'
       AND reservation_released_at IS NULL
     RETURNING id
  `, [orderId]);
  if (!result.rowCount) return false;
  await client.query(`
    UPDATE products p
       SET stock_quantity = p.stock_quantity + oi.quantity
      FROM order_items oi
     WHERE oi.order_id = $1 AND p.id = oi.product_id
  `, [orderId]);
  await client.query(`UPDATE payment_records SET status = 'failed' WHERE order_id = $1 AND status = 'pending'`, [orderId]);
  return true;
}

async function releaseExpiredReservations() {
  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    throw error;
  }
  try {
    await client.query('BEGIN');
    const expired = await client.query(`
      SELECT id FROM orders
       WHERE payment_status = 'pending' AND reservation_released_at IS NULL
         AND reservation_expires_at < CURRENT_TIMESTAMP
       FOR UPDATE SKIP LOCKED
    `);
    for (const order of expired.rows) await releaseOrderReservation(client, order.id);
    await client.query('COMMIT');
    return expired.rowCount;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

router.post('/session', checkoutRateLimit, async (req, res) => {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const localStripeTest = process.env.NODE_ENV !== 'production' && stripeSecret?.startsWith('sk_test_');
  if (!stripeSecret || (!webhookSecret && !localStripeTest) || !/^sk_(test|live)_/.test(stripeSecret)) {
    return res.status(503).json({ error: 'Ödəniş hələ aktiv deyil.' });
  }
  if ((process.env.NODE_ENV === 'production' && !stripeSecret.startsWith('sk_live_')) ||
      (process.env.NODE_ENV !== 'production' && stripeSecret.startsWith('sk_live_'))) {
    return res.status(503).json({ error: 'Stripe açarı bu mühit üçün uyğun deyil.' });
  }
  if (process.env.NODE_ENV === 'production' && process.env.CHECKOUT_LIVE_ENABLED !== 'true') {
    return res.status(503).json({ error: 'Canlı ödənişlər hələ açılmayıb.' });
  }
  if (!BASE_URL || !/^https:\/\//i.test(BASE_URL) && process.env.NODE_ENV === 'production') {
    return res.status(503).json({ error: 'Checkout configuration unavailable.' });
  }
  if (CURRENCY !== 'azn') return res.status(503).json({ error: 'Unsupported checkout currency.' });

  const { items, email, phone, shippingAddress, shippingMethod = 'standard' } = req.body || {};
  const config = shippingMethod === 'standard' ? getCheckoutConfig('standard') : null;
  if (!config) return res.status(503).json({ error: 'Çatdırılma və vergi məbləğləri hələ konfiqurasiya edilməyib.' });
  if (!Array.isArray(items) || items.length < 1 || items.length > 10 ||
      !items.every(item => item && validString(item.sku, 100) && item.quantity === 1) ||
      new Set(items.map(item => item.sku)).size !== items.length) {
    return res.status(400).json({ error: 'Səbətin tərkibi yanlışdır.' });
  }
  if (!validString(email, 255) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validString(phone, 50)) {
    return res.status(400).json({ error: 'Əlaqə məlumatlarını yoxlayın.' });
  }
  if (!shippingAddress || !validString(shippingAddress.name, 120) ||
      !validString(shippingAddress.address, 250) || !validString(shippingAddress.city, 100) ||
      !validString(shippingAddress.region, 100) || shippingAddress.country !== 'AZ') {
    return res.status(400).json({ error: 'Çatdırılma ünvanını yoxlayın.' });
  }

  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    console.error('Checkout database connection failed:', error.message);
    return res.status(503).json({ error: 'Sifariş xidməti hazırda əlçatan deyil.' });
  }
  let order;
  let orderNumber;
  let subtotal;
  let tax;
  let total;
  let products;
  let stripeSessionId = null;
  try {
    await client.query('BEGIN');
    const expired = await client.query(`
      SELECT id FROM orders
       WHERE payment_status = 'pending' AND reservation_released_at IS NULL
         AND reservation_expires_at < CURRENT_TIMESTAMP
       FOR UPDATE
    `);
    for (const expiredOrder of expired.rows) await releaseOrderReservation(client, expiredOrder.id);

    const result = await client.query(`
      SELECT id, sku, name_az, price_azn_qapik, stock_quantity, condition_az
        FROM products
       WHERE sku = ANY($1::varchar[]) AND is_published = TRUE
       ORDER BY id
       FOR UPDATE
    `, [items.map(item => item.sku)]);
    products = result.rows;
    const bySku = new Map(products.map(product => [product.sku, product]));
    if (products.length !== items.length || items.some(item => !bySku.has(item.sku) || bySku.get(item.sku).stock_quantity < 1)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Bir və ya daha çox məhsul artıq mövcud deyil.' });
    }

    subtotal = products.reduce((sum, product) => sum + product.price_azn_qapik, 0);
    const beforeTax = subtotal + config.shipping;
    tax = config.taxInclusive
      ? Math.round(beforeTax * config.taxRate / (10000 + config.taxRate))
      : Math.round(beforeTax * config.taxRate / 10000);
    total = config.taxInclusive ? beforeTax : beforeTax + tax;
    if (![subtotal, tax, total].every(Number.isSafeInteger) || total <= 0 || total > 99999999) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sifariş məbləği yanlışdır.' });
    }

    orderNumber = `VO-${crypto.randomUUID()}`;
    const inserted = await client.query(`
      INSERT INTO orders (order_number, status, payment_status, fulfillment_status,
        subtotal_azn_qapik, shipping_azn_qapik, tax_azn_qapik, total_azn_qapik,
        shipping_address, customer_email, customer_phone, currency, reservation_expires_at)
      VALUES ($1, 'pending', 'pending', 'pending', $2, $3, $4, $5, $6::jsonb, $7, $8, 'AZN',
        CURRENT_TIMESTAMP + INTERVAL '${RESERVATION_MINUTES} minutes')
      RETURNING id
    `, [orderNumber, subtotal, config.shipping, tax, total, JSON.stringify(shippingAddress), email.trim(), phone.trim()]);
    order = inserted.rows[0];

    for (const product of products) {
      const reservation = await client.query(`
        UPDATE products SET stock_quantity = stock_quantity - 1
         WHERE id = $1 AND stock_quantity > 0 RETURNING id
      `, [product.id]);
      if (!reservation.rowCount) throw new Error('Inventory changed during reservation');
      await client.query(`
        INSERT INTO order_items (order_id, product_id, product_sku, product_name_az,
          product_price_azn_qapik, quantity, condition_az)
        VALUES ($1, $2, $3, $4, $5, 1, $6)
      `, [order.id, product.id, product.sku, product.name_az, product.price_azn_qapik, product.condition_az]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Checkout order preparation failed:', error.message);
    return res.status(503).json({ error: 'Sifariş hazırlanarkən xəta baş verdi.' });
  } finally {
    client.release();
  }

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('customer_email', email.trim());
  form.set('client_reference_id', orderNumber);
  form.set('metadata[orderNumber]', orderNumber);
  form.set('success_url', `${BASE_URL}/pages/checkout.html?payment=success&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${BASE_URL}/pages/checkout.html?payment=cancelled`);
  form.set('expires_at', String(Math.floor(Date.now() / 1000) + RESERVATION_MINUTES * 60));
  let line = 0;
  for (const product of products) {
    form.set(`line_items[${line}][price_data][currency]`, CURRENCY);
    form.set(`line_items[${line}][price_data][unit_amount]`, String(product.price_azn_qapik));
    form.set(`line_items[${line}][price_data][product_data][name]`, product.name_az);
    form.set(`line_items[${line}][quantity]`, '1');
    line++;
  }
  if (config.shipping > 0) {
    form.set(`line_items[${line}][price_data][currency]`, CURRENCY);
    form.set(`line_items[${line}][price_data][unit_amount]`, String(config.shipping));
    form.set(`line_items[${line}][price_data][product_data][name]`, 'Çatdırılma');
    form.set(`line_items[${line}][quantity]`, '1');
    line++;
  }
  if (tax > 0 && !config.taxInclusive) {
    form.set(`line_items[${line}][price_data][currency]`, CURRENCY);
    form.set(`line_items[${line}][price_data][unit_amount]`, String(tax));
    form.set(`line_items[${line}][price_data][product_data][name]`, 'Vergi');
    form.set(`line_items[${line}][quantity]`, '1');
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': orderNumber,
      },
      body: form,
      signal: AbortSignal.timeout(10000),
    });
    const session = await response.json();
    stripeSessionId = session.id || null;
    if (!response.ok || !session.url || !session.id) throw new Error(session.error?.message || 'Stripe session unavailable');
    const update = await pool.query(`
      UPDATE orders SET stripe_checkout_session_id = $1 WHERE id = $2 AND payment_status = 'pending'
    `, [session.id, order.id]);
    if (!update.rowCount) throw new Error('Order changed before Checkout was attached');
    await pool.query(`
      INSERT INTO payment_records (order_id, provider, provider_payment_id, amount_azn_qapik, currency, status)
      VALUES ($1, 'Stripe', $2, $3, 'AZN', 'pending')
    `, [order.id, session.id, total]);
    return res.json({ url: session.url, orderNumber });
  } catch (error) {
    // If Stripe created a session but attaching it to the order failed, keep
    // inventory reserved so its signed expiration/payment webhook can reconcile it.
    if (!stripeSessionId) {
      const cleanup = await pool.connect();
      try {
        await cleanup.query('BEGIN');
        await releaseOrderReservation(cleanup, order.id);
        await cleanup.query('COMMIT');
      } catch (cleanupError) {
        await cleanup.query('ROLLBACK').catch(() => {});
        console.error('Could not release failed checkout reservation:', cleanupError.message);
      } finally {
        cleanup.release();
      }
    }
    console.error('Stripe Checkout session creation failed:', error.message);
    return res.status(503).json({ error: 'Ödəniş səhifəsi açıla bilmədi. Yenidən cəhd edin.' });
  }
});

router.get('/status/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid checkout session.' });
  }
  const localTestPolling = process.env.NODE_ENV !== 'production' &&
    process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') && !process.env.STRIPE_WEBHOOK_SECRET;
  if (localTestPolling) {
    try {
      const { rows } = await pool.query(`
        SELECT id, order_number, total_azn_qapik, currency, payment_status
          FROM orders WHERE stripe_checkout_session_id=$1 LIMIT 1
      `, [sessionId]);
      if (!rows.length) return res.status(404).json({ error: 'Order not found.' });
      const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        signal: AbortSignal.timeout(8000),
      });
      const session = await stripeResponse.json().catch(() => ({}));
      if (!stripeResponse.ok) return res.status(503).json({ error: 'Could not check the Stripe test payment.' });
      const order = rows[0];
      if (session.id !== sessionId || session.mode !== 'payment' ||
          session.metadata?.orderNumber !== order.order_number ||
          Number(session.amount_total) !== order.total_azn_qapik ||
          String(session.currency).toUpperCase() !== order.currency.trim().toUpperCase()) {
        return res.status(400).json({ error: 'Stripe payment details did not match the order.' });
      }
      if (session.payment_status === 'paid' && order.payment_status === 'pending') {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const locked = await client.query('SELECT id,payment_status FROM orders WHERE id=$1 FOR UPDATE', [order.id]);
          if (locked.rows[0]?.payment_status === 'pending') {
            await client.query("UPDATE orders SET payment_status='paid',status='processing' WHERE id=$1 AND payment_status='pending'", [order.id]);
            await client.query("UPDATE payment_records SET status='succeeded',provider_payment_id=$2 WHERE order_id=$1 AND status='pending'", [order.id, session.payment_intent || session.id]);
          }
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
        finally { client.release(); }
        order.payment_status = 'paid';
      } else if (session.status === 'expired' && order.payment_status === 'pending') {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await releaseOrderReservation(client, order.id);
          await client.query('COMMIT');
          order.payment_status = 'failed';
        } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
        finally { client.release(); }
      }
      res.set('Cache-Control', 'no-store');
      return res.json({ orderNumber: order.order_number, paymentStatus: order.payment_status });
    } catch (error) {
      console.error('Stripe test payment status check failed:', error.message);
      return res.status(503).json({ error: 'Order status unavailable.' });
    }
  }
  try {
    const { rows } = await pool.query(`
      SELECT order_number, payment_status FROM orders
       WHERE stripe_checkout_session_id = $1 LIMIT 1
    `, [sessionId]);
    if (!rows.length) return res.status(404).json({ error: 'Order not found.' });
    res.set('Cache-Control', 'no-store');
    res.json({ orderNumber: rows[0].order_number, paymentStatus: rows[0].payment_status });
  } catch (error) {
    console.error('Checkout status lookup failed:', error.message);
    res.status(503).json({ error: 'Order status unavailable.' });
  }
});

async function stripeWebhook(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSignatureValid(req.body, req.get('stripe-signature'), secret)) {
    return res.status(400).send('Invalid signature');
  }
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).send('Invalid event');
  }

  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    console.error('Stripe webhook database connection failed:', error.message);
    return res.status(500).send('Webhook processing unavailable');
  }
  try {
    await client.query('BEGIN');
    const inserted = await client.query(`
      INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1, $2)
      ON CONFLICT (event_id) DO NOTHING RETURNING event_id
    `, [event.id, event.type]);
    if (!inserted.rowCount) {
      await client.query('COMMIT');
      return res.status(200).json({ received: true });
    }

    const session = event.data?.object;
    const orderResult = await client.query(`
      SELECT id, order_number, total_azn_qapik, currency, payment_status
        FROM orders
       WHERE stripe_checkout_session_id = $1 OR order_number = $2
       FOR UPDATE
    `, [session?.id || '', session?.metadata?.orderNumber || session?.client_reference_id || '']);
    const order = orderResult.rows[0];

    if (order && ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const amountMatches = Number(session.amount_total) === order.total_azn_qapik;
      const currencyMatches = String(session.currency).toUpperCase() === order.currency.trim().toUpperCase();
      if (!amountMatches || !currencyMatches) {
        await client.query('ROLLBACK');
        return res.status(400).send('Checkout amount mismatch');
      }
      if (session.payment_status === 'paid' && order.payment_status === 'pending') {
        await client.query(`
          UPDATE orders SET payment_status = 'paid', status = 'processing'
           WHERE id = $1 AND payment_status = 'pending'
        `, [order.id]);
        await client.query(`
          UPDATE payment_records SET status = 'succeeded', provider_payment_id = $2
           WHERE order_id = $1 AND status = 'pending'
        `, [order.id, session.payment_intent || session.id]);
      }
    } else if (order && ['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type)) {
      await releaseOrderReservation(client, order.id);
    }
    await client.query('COMMIT');
    return res.status(200).json({ received: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Stripe webhook processing failed:', error.message);
    return res.status(500).send('Webhook processing failed');
  } finally {
    client.release();
  }
}

module.exports = { router, stripeWebhook, releaseExpiredReservations };
