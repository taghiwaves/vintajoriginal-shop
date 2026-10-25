const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const requiredHeaders = [
  'sku', 'name_az', 'description_az', 'price_azn', 'category_name_az',
  'brand', 'era', 'condition_az', 'size_label', 'material', 'color',
  'measurements', 'stock_quantity', 'main_image_url', 'image_alt_az',
];
const frontendRoot = path.resolve(__dirname, '../../frontend');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') {
      if (field.length) throw new Error('Unexpected quote in CSV field.');
      quoted = true;
    } else if (char === ',') {
      row.push(field); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  row.push(field);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  return rows;
}

function parsePrice(value, line) {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) throw new Error(`Line ${line}: price_azn must be a positive amount with at most 2 decimal places.`);
  const [whole, fraction = ''] = normalized.split('.');
  const qapik = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(qapik) || qapik <= 0 || qapik > 2147483647) throw new Error(`Line ${line}: price_azn is outside the supported range.`);
  return qapik;
}

function readCatalog(filePath) {
  const absolute = path.resolve(filePath);
  const source = fs.readFileSync(absolute, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(source);
  if (!rows.length) throw new Error('CSV file is empty.');
  const headers = rows[0].map(value => value.trim());
  const missing = requiredHeaders.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`CSV is missing columns: ${missing.join(', ')}`);
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column names.');
  if (rows.length === 1) throw new Error('CSV has a header but no products.');

  const seenSkus = new Set();
  return rows.slice(1).map((values, index) => {
    const line = index + 2;
    if (values.length !== headers.length) throw new Error(`Line ${line}: expected ${headers.length} columns but found ${values.length}.`);
    const record = Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
    for (const key of headers) {
      if (record[key].includes('\uFFFD')) throw new Error(`Line ${line}: ${key} contains damaged text (Unicode replacement characters). Re-save the CSV as UTF-8 and check the original wording.`);
    }
    const placeholders = /^(?:empty|none|null|n\/a|na|todo|tbd)$/i;
    for (const key of headers) if (placeholders.test(record[key])) record[key] = '';
    for (const key of ['sku', 'name_az', 'description_az', 'category_name_az', 'condition_az', 'size_label', 'main_image_url']) {
      if (!record[key]) throw new Error(`Line ${line}: ${key} is required.`);
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/.test(record.sku)) throw new Error(`Line ${line}: sku may contain only letters, numbers, underscores, and hyphens.`);
    if (seenSkus.has(record.sku)) throw new Error(`Line ${line}: duplicate SKU ${record.sku} in this file.`);
    seenSkus.add(record.sku);
    for (const [key, max] of [['name_az', 255], ['category_name_az', 255], ['brand', 255], ['era', 100], ['condition_az', 255], ['size_label', 80], ['material', 160], ['color', 100], ['main_image_url', 500], ['image_alt_az', 255]]) {
      if (record[key].length > max) throw new Error(`Line ${line}: ${key} exceeds ${max} characters.`);
    }
    if (record.description_az.length > 10000 || record.measurements.length > 2000) throw new Error(`Line ${line}: description or measurements are too long.`);
    if (record.stock_quantity && record.stock_quantity !== '1') throw new Error(`Line ${line}: vintage one-off products must use stock_quantity 1 or leave it blank.`);
    if (!record.main_image_url.startsWith('/images/products/') || record.main_image_url.includes('..') || /[?#\\]/.test(record.main_image_url)) {
      throw new Error(`Line ${line}: main_image_url must be a local /images/products/... path without query strings.`);
    }
    const segments = record.main_image_url.slice(1).split('/');
    let imagePath = frontendRoot;
    for (const segment of segments) {
      if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isDirectory()) {
        throw new Error(`Line ${line}: image file not found under src/frontend${record.main_image_url}.`);
      }
      const actualName = fs.readdirSync(imagePath).find(name => name.toLocaleLowerCase('en') === segment.toLocaleLowerCase('en'));
      if (!actualName) throw new Error(`Line ${line}: image file not found under src/frontend${record.main_image_url}.`);
      if (actualName !== segment) throw new Error(`Line ${line}: image path casing does not match the file name. Use '${actualName}'.`);
      imagePath = path.join(imagePath, actualName);
    }
    if (!imagePath.startsWith(`${path.join(frontendRoot, 'images', 'products')}${path.sep}`) || !fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) {
      throw new Error(`Line ${line}: image file not found under src/frontend${record.main_image_url}.`);
    }
    return { ...record, price_azn_qapik: parsePrice(record.price_azn, line), stock_quantity: 1 };
  });
}

async function importCatalog(products) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const skus = products.map(product => product.sku);
    const existing = await client.query('SELECT sku FROM products WHERE sku = ANY($1::varchar[])', [skus]);
    if (existing.rowCount) throw new Error(`These SKUs already exist: ${existing.rows.map(row => row.sku).join(', ')}. No products were imported.`);

    for (const product of products) {
      const categoryResult = await client.query('SELECT id FROM categories WHERE name_az = $1 ORDER BY id LIMIT 1 FOR UPDATE', [product.category_name_az]);
      const categoryId = categoryResult.rows[0]?.id ?? (await client.query(
        'INSERT INTO categories (name_az) VALUES ($1) RETURNING id', [product.category_name_az],
      )).rows[0].id;
      const inserted = await client.query(`
        INSERT INTO products (sku, name_az, description_az, price_azn_qapik, category_id,
          brand, era, condition_az, stock_quantity, main_image_url,
          size_label, material, color, measurements, is_published)
        VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''), $8, 1, $9,
          $10, NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''), FALSE)
        RETURNING id
      `, [product.sku, product.name_az, product.description_az, product.price_azn_qapik,
        categoryId, product.brand, product.era, product.condition_az, product.main_image_url,
        product.size_label, product.material, product.color, product.measurements]);
      await client.query(`
        INSERT INTO product_images (product_id, url, alt_text_az, sort_order)
        VALUES ($1, $2, NULLIF($3, ''), 0)
      `, [inserted.rows[0].id, product.main_image_url, product.image_alt_az]);
    }
    await client.query('COMMIT');
    return products.length;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const checkOnly = process.argv[2] === '--check';
  const file = process.argv[checkOnly ? 3 : 2];
  if (!file) throw new Error('Usage: node src/backend/scripts/import-catalog.js [--check] <catalog.csv>');
  const products = readCatalog(file);
  if (checkOnly) {
    console.log(`${products.length} product(s) validated. No database changes were made.`);
    return;
  }
  const count = await importCatalog(products);
  console.log(`${count} product(s) imported as unpublished. Review each product before publishing.`);
}

main().catch(error => {
  const code = error.code || error.errors?.[0]?.code;
  const message = error.message || (code === 'ECONNREFUSED'
    ? 'PostgreSQL refused the connection. Start the database and retry.'
    : code ? `Database or import error (${code}).` : 'Unknown error.');
  console.error(`Catalog import failed: ${message}`);
  process.exitCode = 1;
}).finally(() => pool.end());
