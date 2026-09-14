# SLNS Silk Operations Platform

An end-to-end starter platform for a silk textile business, aligned to the supplied blueprint.

## Included

- Control tower dashboard for sales, collections, inventory value, WIP and contribution margin.
- Canonical product, customer, vendor, order and stock-movement data model.
- Procurement, production/job-work, inventory, order-to-cash, finance/GST and audit views.
- Immutable-style transaction APIs for material receipt, finished-goods receipt and sales-order reservation.
- Stock availability calculated from on-hand less reserved quantities.
- JSON persistence for local development and a clear API boundary for future PostgreSQL, GST, banking, logistics and messaging adapters.

## Run locally

```bash
npm start
```

Open http://localhost:3000. Data is persisted to `data/store.json` after the first transaction and is intentionally ignored by Git.

## Verify

```bash
npm test
```

This is a foundation release rather than a production compliance claim. Before go-live, connect a managed PostgreSQL database, identity provider, backups, GST/e-invoice provider, payment gateway and logistics provider; then complete statutory and security review.
