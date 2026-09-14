import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for PostgreSQL migration");
  process.exit(1);
}

let pg;
try { pg = await import("pg"); } catch {
  console.error("The pg package is not installed. Run npm install first.");
  process.exit(1);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
await client.connect();
try {
  await client.query(readFileSync(join(root, "scripts", "postgres-schema.sql"), "utf8"));
  await client.query("INSERT INTO slns_meta(key, value) VALUES($1, $2::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()", ["schema", JSON.stringify({ version: 1, migratedAt: new Date().toISOString() })]);
  console.log(JSON.stringify({ ok: true, database: "postgresql", schemaVersion: 1 }));
} finally { await client.end(); }
