# Product catalog import

The CSV importer validates the complete file before it connects to PostgreSQL, inserts all rows in one transaction, rejects duplicate SKUs, and always creates products with `is_published = FALSE`. Imported products cannot appear in the storefront or checkout until they are reviewed and published.

## Prepare the catalog

1. Copy `catalog-import-template.csv` to `catalog-import.csv`.
2. Add one product per row. Use UTF-8 and normal CSV quoting for commas or line breaks in text.
3. Put each product photo in `src/frontend/images/products/` and use a path such as `/images/products/blue-coat.jpg` in `main_image_url`. The file must exist before importing.
4. Keep `stock_quantity` at `1` for these one-off vintage items. `price_azn` uses AZN, for example `45.00`.
5. From the project folder, check the file without database changes using `npm run catalog:import -- --check "catalog-import.csv"`.
6. Once the check succeeds, import it using `npm run catalog:import -- "catalog-import.csv"`.

Required fields: `sku`, `name_az`, `description_az`, `price_azn`, `category_name_az`, `condition_az`, `size_label`, and `main_image_url`. Keep every column from the template header. Brand, era, material, color, measurements, and image alt text may be blank. Do not use placeholders such as `empty` or `TODO`; leave optional fields blank and provide real descriptions for required fields. The image path's capitalization must match the actual file name (also on Windows). A failed row or existing SKU aborts the entire import; existing products are never overwritten.

## Review and publish

After reviewing product names, descriptions, sizes, prices, condition notes, stock, and photos, publish only the approved SKUs explicitly in PostgreSQL:

```sql
UPDATE products
   SET is_published = TRUE
 WHERE sku = 'REPLACE_WITH_REVIEWED_SKU'
   AND stock_quantity = 1
   AND main_image_url IS NOT NULL
RETURNING sku, name_az, price_azn_qapik, is_published;
```

This import workflow does not configure tax, shipping, legal policies, or live Stripe payments. Those launch items remain separate prerequisites.

## Admin catalog page

Set an admin password once from an interactive terminal in the project folder with `npm run admin:setup`. The password is entered without terminal echo and its scrypt hash is saved to `.env`. Restart the server, then open `http://localhost:3000/admin`. The page can create and edit products, upload additional JPG/PNG/WebP product photos (up to 8 MB each), and publish or unpublish items. New products are saved as drafts until explicitly published. Keep `.env` private and do not commit it.
