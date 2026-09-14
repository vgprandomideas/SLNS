import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export async function openPostgresStore(connectionString) {
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  await client.query(readFileSync(join(root, "scripts", "postgres-schema.sql"), "utf8"));
  await client.query("CREATE TABLE IF NOT EXISTS slns_runtime_snapshot (id INTEGER PRIMARY KEY CHECK (id = 1), payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  return {
    async read() { const result = await client.query("SELECT payload FROM slns_runtime_snapshot WHERE id = 1"); return result.rows[0]?.payload || null; },
    async write(store) { await client.query("INSERT INTO slns_runtime_snapshot(id, payload) VALUES(1, $1::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()", [JSON.stringify(store)]); },
    async close() { await client.end(); },
  };
}
