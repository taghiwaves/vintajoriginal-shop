# Deploy Vintajoriginal to Render

This repository includes a Render Blueprint for the full Node.js shop: storefront, admin, PostgreSQL, product image storage, and Stripe Checkout in test mode. The first deploy creates an empty database schema; it does not import or publish products automatically.

## Estimated recurring cost

The selected Render Hobby resources currently list at about **$13.25/month** before usage beyond included bandwidth: web service `0.5c-512mb` ($7), PostgreSQL `0.1c-256mb` ($6), and a 1 GB persistent disk ($0.25). Render bills usage and storage separately and can change pricing. Confirm the current estimate in Render before creating resources. Free services are unsuitable for this setup because free web services cannot use persistent disks and free Postgres expires after 30 days. Sources: [Render pricing](https://render.com/pricing), [free plan limitations](https://render.com/docs/free).

## Create the services

1. In Render, connect the private GitHub repository `taghiwaves/vintajoriginal-shop`.
2. Choose **New → Blueprint** and select the repository's `render.yaml` on branch `main`.
3. Review the services, region (Frankfurt), plan, disk, and displayed cost before clicking **Apply**. The Blueprint sets Postgres to private-network access only and Stripe to test mode.
4. When Render requests unsynced environment variables, enter the Stripe **test** secret key (`sk_test_...`) and `ADMIN_PASSWORD_HASH`. Enter these only in Render's dashboard, never in Git or chat. A webhook secret is optional for the test flow; the app checks the test Checkout session directly with Stripe after return.
5. Wait until the migration and service deploy finish. Open `/health`; it should return `healthy` with database `available`.
6. Import the reviewed catalog from `catalog-import-ready.csv` using Render's one-off shell command `npm run catalog:import -- catalog-import-ready.csv`, then review and publish approved products in `/admin`. The image disk is seeded with bundled photos on its first startup.
7. Complete a Stripe test checkout. The Blueprint explicitly keeps `CHECKOUT_LIVE_ENABLED=false`; it cannot accept live payments until all seller, tax, delivery, policy, and Stripe live settings are reviewed separately.

## Product image storage

Admin uploads are stored on Render's attached persistent disk at `/var/data/product-images`, so they survive application deploys and restarts. Keep a separate backup of uploaded product images. The 1 GB disk can be enlarged later.

## Secrets and operations

- Keep Stripe keys, webhook secrets, and `ADMIN_PASSWORD_HASH` in Render's secret environment variables only.
- To create a fresh admin password hash locally, run `npm run admin:setup` in a private local copy, then copy only the `ADMIN_PASSWORD_HASH` value from the ignored `.env` into Render. Never commit `.env`.
- Database schema migrations run in Render's pre-deploy step. Back up the database and image disk before any major change.
- GitHub stores source code; it does not run the app, database, admin, or checkout.
