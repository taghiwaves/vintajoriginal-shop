-- Product attributes and explicit publication control.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS size_label VARCHAR(80),
  ADD COLUMN IF NOT EXISTS material VARCHAR(160),
  ADD COLUMN IF NOT EXISTS color VARCHAR(100),
  ADD COLUMN IF NOT EXISTS measurements TEXT,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_published_stock
  ON products(is_published, stock_quantity) WHERE is_published = TRUE AND stock_quantity > 0;
