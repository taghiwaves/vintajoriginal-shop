# Stripe rollout checklist

## Decision recorded

- Preferred payment provider: Stripe, using the existing account whose account country is Germany.
- Initial delivery market: Azerbaijan only.
- Store currency intended for checkout: AZN. Stripe lists AZN as a supported presentment currency; settlement and conversion depend on the account's payout configuration.
- Customer card details must be entered on Stripe-hosted Checkout. The shop must never receive or store card numbers or CVC values.

## Integration requirements

The initial server flow is implemented in `src/backend/routes/stripeCheckout.js`: it accepts SKUs and address/contact fields, recalculates amounts from PostgreSQL, reserves one-off stock, creates a Stripe-hosted Checkout Session, verifies signed webhook events, and checks payment status on return. Expired reservations are released by webhook events and a periodic cleanup.

1. Create Checkout Sessions on the backend only. This flow resolves SKU, current prices, and stock from PostgreSQL; it never trusts a browser-supplied price or total.
2. Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the deployment secret store or ignored local `.env`. Use test-mode keys during development. Never commit or paste keys into chat.
3. Apply `src/backend/migrations/002-stripe-checkout.sql` and then `src/backend/migrations/003-product-catalog.sql` to production PostgreSQL after migration `001-create-tables.sql`. Development startup applies migrations 002 and 003 automatically. Migration 003 adds product measurements and a publication flag; existing rows stay unpublished until explicitly reviewed and published.
4. Configure the Stripe webhook endpoint as `https://<shop-domain>/api/payments/stripe/webhook` for `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`.
5. Set both shipping prices and `CHECKOUT_TAX_RATE_BPS` plus `CHECKOUT_TAX_INCLUSIVE` only after the amounts and tax treatment are confirmed. Blank settings keep checkout disabled.
6. Do not enable live checkout until the Stripe account's live payments and payout destination are confirmed, real catalog data is loaded, and seller/consumer policies are reviewed.

## Current blockers to live sales

- The storefront now reads published, in-stock products and prices from PostgreSQL; the cart is browser-stored, while checkout revalidates stock and price on the server. No demonstration items are seeded or shown as saleable products.
- Real inventory, product photos, descriptions, and publication decisions still need to be entered in PostgreSQL before the collection can be used.
- PostgreSQL must be configured and populated with real items and stock.
- Shipping prices and tax treatment are not confirmed; the current checkout amounts are explicitly mock values.
- The seller has reported no Azerbaijan VÖEN. Confirm the seller's registration/tax obligations and ensure the German Stripe account is approved for the actual seller and payout arrangement before live charges.
- Seller identity, return/refund policy, privacy notice, and final delivery terms still need approved content.

## Local Stripe test mode

For local development, sign in at `http://localhost:3000/admin` and choose **Stripe-Testzahlung**. Enter a Stripe secret key that starts with `sk_test_`; the local server checks it with Stripe and writes it to the ignored `.env` file. It is accepted only from the local development server and is never returned to the browser. Standard delivery is 4.99 AZN throughout Azerbaijan; this flat rate must be confirmed against the seller's delivery arrangement before launch. Express delivery is not offered. Local test mode uses 0% tax only for development. In development, order status is checked against Stripe's test API after return, so a webhook tunnel is not required for basic checkout testing. Production continues to require live credentials, a signed webhook, explicit tax settings, and `CHECKOUT_LIVE_ENABLED=true`.

Never enter a live key in the local test-key form and never send API or webhook secrets in chat.

Stripe references: [supported currencies](https://docs.stripe.com/currencies), [global availability](https://stripe.com/global).
