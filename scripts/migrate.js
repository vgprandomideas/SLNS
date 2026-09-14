import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2];
if (!input) { console.error("Usage: node scripts/migrate.js path/to/export.json"); process.exit(1); }
const source = resolve(input);
if (!existsSync(source)) { console.error(`Migration source not found: ${source}`); process.exit(1); }
const payload = JSON.parse(readFileSync(source, "utf8"));
const required = ["products", "customers", "vendors"];
const missing = required.filter((key) => !Array.isArray(payload[key]));
const duplicateIds = Object.entries(payload).flatMap(([domain, rows]) => Array.isArray(rows) ? rows.map((row) => ({ domain, id: row.id })).filter((row) => !row.id) : []);
if (missing.length || duplicateIds.length) { console.error(JSON.stringify({ ok: false, missingDomains: missing, rowsWithoutIds: duplicateIds.slice(0, 10) }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ ok: true, source, domains: Object.fromEntries(Object.entries(payload).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])), next: "Review the report, back up the relational database, then import through the approved cutover window." }, null, 2));
