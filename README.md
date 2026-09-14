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

Open http://localhost:3000. Data is persisted transactionally to the relational SQLite database at `data/slns.sqlite` and is intentionally ignored by Git. The schema uses foreign keys for products, parties, orders, invoices, stock movements, journals and audit events; the same adapter can be moved to PostgreSQL for production.

Local demo sign-in is enabled with role-specific accounts: `priya` / `slns-demo-owner`, `arjun` / `slns-demo-finance`, or `ravi` / `slns-demo-warehouse`. The API enforces bearer sessions and write permissions; replace these demo credentials with an identity provider, MFA and managed secrets before production.

## Verify

```bash
npm test
```

The local release includes safe demo/sandbox adapters, not live provider credentials. Before go-live, move the relational adapter to managed PostgreSQL, connect an identity provider with MFA, configure GST/e-invoice, bank, payment, logistics and messaging providers, enable managed object storage and TLS, then complete statutory, restore, load and security review.
