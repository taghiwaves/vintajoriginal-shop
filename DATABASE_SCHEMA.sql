-- Vintajoriginal Database Schema
-- Using PostgreSQL
-- Monetary values stored as integer minor units (cents) to avoid floating-point errors.
-- For AZN, we use subunits called "qapik": 1 AZN = 100 qapik.
-- All monetary columns are INTEGER representing qapik.

-- Enable UUID extension if needed (for UUID primary keys, but we'll use SERIAL for simplicity)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories table (supports subcategories via parent_id)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name_az VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, -- For subcategories
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table (created before carts to avoid foreign key issues)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name_az VARCHAR(255),
    phone VARCHAR(50),
    default_shipping_address JSONB, -- Store as JSONB for flexibility, but we snapshot on order
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name_az VARCHAR(255) NOT NULL,
    description_az TEXT,
    price_azn_qapik INTEGER NOT NULL CHECK (price_azn_qapik >= 0), -- Price in qapik
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    brand VARCHAR(255),
    era VARCHAR(100), -- e.g., '1970s', 'Vintage 90s'
    condition_az VARCHAR(255), -- Condition description (e.g., 'Excellent', 'Good with minor wear')
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    main_image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product images (multiple per product, with ordering and alt text)
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    alt_text_az VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cart items (can be tied to a user or session)
CREATE TABLE carts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL for guest carts
    session_id VARCHAR(255), -- For guest carts, store session ID
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id), -- One cart entry per product per user
    UNIQUE(session_id, product_id) -- One cart entry per product per session (for guests)
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL for guest orders
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., pending, processing, shipped, delivered, cancelled
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., pending, paid, failed, refunded
    fulfillment_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., pending, fulfilled, partially_fulfilled
    subtotal_azn_qapik INTEGER NOT NULL CHECK (subtotal_azn_qapik >= 0),
    shipping_azn_qapik INTEGER NOT NULL CHECK (shipping_azn_qapik >= 0),
    tax_azn_qapik INTEGER NOT NULL CHECK (tax_azn_qapik >= 0),
    total_azn_qapik INTEGER NOT NULL CHECK (total_azn_qapik >= 0),
    -- Snapshots of addresses at time of order (immutable)
    shipping_address JSONB NOT NULL,
    billing_address JSONB,
    customer_note TEXT,
    internal_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order items (snapshot of product at time of purchase)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL, -- We keep product_id for reference, but product may change/delete
    product_sku VARCHAR(100) NOT NULL, -- SKU snapshot
    product_name_az VARCHAR(255) NOT NULL,
    product_price_azn_qapik INTEGER NOT NULL, -- Price at time of purchase
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    -- Variant-specific details (if applicable)
    size VARCHAR(50),
    color VARCHAR(100),
    material VARCHAR(100),
    -- Condition snapshot (since vintage items may have unique condition descriptions)
    condition_az VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refund requests
-- Note: user_id is nullable to accommodate guest orders (where user_id is NULL)
-- For guest orders, the refund request is still linked via order_id, and can be viewed in admin panel.
-- In the customer account area, refund requests are only shown for logged-in users.
CREATE TABLE refund_requests (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL allowed for guest orders
    reason_az VARCHAR(255) NOT NULL, -- Reason for refund (from predefined list or custom)
    description_az TEXT, -- Optional customer description
    status_az VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., pending, approved, rejected, processed
    admin_note_az TEXT, -- Notes from admin
    refund_amount_azn_qapik INTEGER CHECK (refund_amount_azn_qapik >= 0), -- Amount to be refunded (in qapik)
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment records (to track payment attempts and successes)
CREATE TABLE payment_records (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL, -- e.g., 'BirBank', 'Stripe'
    provider_payment_id VARCHAR(255), -- ID from payment provider
    amount_azn_qapik INTEGER NOT NULL CHECK (amount_azn_qapik >= 0),
    currency CHAR(3) DEFAULT 'AZN',
    status VARCHAR(50) NOT NULL, -- e.g., pending, succeeded, failed, refunded
    provider_response JSONB, -- Full response from provider for auditing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refund events (history of refund actions)
CREATE TABLE refund_events (
    id SERIAL PRIMARY KEY,
    refund_request_id INTEGER NOT NULL REFERENCES refund_requests(id) ON DELETE CASCADE,
    provider VARCHAR(100),
    provider_refund_id VARCHAR(255),
    amount_azn_qapik INTEGER NOT NULL CHECK (amount_azn_qapik >= 0),
    status VARCHAR(50) NOT NULL, -- e.g., pending, succeeded, failed
    provider_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs for sensitive admin actions
CREATE TABLE admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(255) NOT NULL, -- e.g., 'product_create', 'order_update', 'refund_approve'
    table_affected VARCHAR(100),
    record_id INTEGER,
    details JSONB, -- Additional details about the change
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_stock ON products(stock_quantity) WHERE stock_quantity > 0;
CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_carts_user ON carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_carts_session ON carts(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_refund_requests_order ON refund_requests(order_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status_az);
CREATE INDEX idx_payment_records_order ON payment_records(order_id);
CREATE INDEX idx_admin_audit_log_admin ON admin_audit_log(admin_user_id);

-- Triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE
    tables TEXT[] := ARRAY['categories', 'products', 'product_images', 'carts', 'users', 'orders', 'order_items', 'refund_requests', 'payment_records', 'refund_events', 'admin_audit_log'];
    i TEXT;
BEGIN
    FOREACH i IN ARRAY tables
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', i, i);
    END LOOP;
END $$;