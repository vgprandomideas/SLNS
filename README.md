# SLNS Silk Operations Platform

An end-to-end starter platform for a silk textile business, aligned to the supplied blueprint.

## Included

- Control tower dashboard for sales, collections, inventory value, WIP and contribution margin.
- Canonical product, customer, vendor, order and stock-movement data model.
- Procurement, production/job-work, inventory, order-to-cash, finance/GST and audit views.
- Immutable-style transaction APIs for material receipt, finished-goods receipt and sales-order reservation.
- Stock availability calculated from on-hand less reserved quantities.
- JSON persistence for local development and a clear API boundary for future PostgreSQL, GST, banking, logistics and messaging adapters.
- Blueprint coverage view that maps the supplied operating model, canonical business flow, modules, principles and phased roadmap into the application.

## API surface

Read models are exposed under `/api`: `blueprint`, `masters`, `summary`, `products`, `costing`, `orders`, `procurement`, `production`, `quality`, `stock-movements`, `logistics`, `finance`, `ledger`, `workflows`, `alerts`, `events` and `audit`.

Write transactions are exposed under `/api/actions`: `receive`, `material-issue`, `production`, `order`, `invoice`, `dispatch`, `receipt`, `qc`, `approve`, `transfer` and `return`. Each write creates a transaction reference, updates the relevant operational state and appends an audit/event record.

## Run locally

```bash
npm start
```

Open http://localhost:3000. Data is persisted to `data/store.json` after the first transaction and is intentionally ignored by Git.

Local demo sign-in is enabled with role-specific accounts: `priya` / `slns-demo-owner`, `arjun` / `slns-demo-finance`, or `ravi` / `slns-demo-warehouse`. The API enforces bearer sessions and write permissions; replace these demo credentials with an identity provider, MFA and managed secrets before production.

## Verify

```bash
npm test
```

This is a foundation release rather than a production compliance claim. Before go-live, connect a managed PostgreSQL database, identity provider, backups, GST/e-invoice provider, payment gateway and logistics provider; then complete statutory and security review.
