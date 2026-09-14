# Security and production cutover

The local release uses bearer sessions, scrypt password hashes, login throttling, security headers, audit events, validated document uploads, idempotency keys and least-privilege write permissions.

Before exposing the service publicly:

- Replace demo users with an identity provider and enforce MFA for finance and administration.
- Put all provider URLs, credentials and signing keys in the host secret manager.
- Run behind TLS with secure cookies or an equivalent gateway session policy.
- Move the runtime store to the managed PostgreSQL schema in `scripts/postgres-schema.sql` and run `npm run migrate:postgres` during cutover.
- Configure object storage, malware scanning and retention/deletion policies for uploaded documents.
- Complete penetration testing, dependency scanning, rate-limit review, load testing and a restore drill.
- Configure GST, payment, bank, courier, email and WhatsApp contracts and test each adapter in staging before production.
