import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const input = process.argv[2]; const output = process.argv[3] || "migration-export.json";
if (!input || !existsSync(resolve(input))) { console.error("Usage: node scripts/migrate-spreadsheet.js export.xlsx|export.csv|tally.xml [output.json]"); process.exit(1); }
const source = resolve(input); const extension = extname(source).toLowerCase(); let data;

function normalise(rows, domain) { return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").trim())).map((row, index) => { const clean = Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim(), typeof value === "string" ? value.trim() : value])); clean.id ||= `${domain.toUpperCase()}-IMPORT-${String(index + 1).padStart(5, "0")}`; return clean; }); }
function csvRows(text) { const rows = []; let row = []; let cell = ""; let quoted = false; for (const character of text.replace(/^\uFEFF/, "")) { if (character === '"') quoted = !quoted; else if (character === "," && !quoted) { row.push(cell); cell = ""; } else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\n" && (cell || row.length)) { row.push(cell); rows.push(row); row = []; cell = ""; } } else cell += character; } if (cell || row.length) { row.push(cell); rows.push(row); } const headers = rows.shift() || []; return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))); }

if (extension === ".xlsx" || extension === ".xls") {
  let xlsx; try { xlsx = await import("xlsx"); } catch { console.error("The xlsx package is not installed. Run npm install first."); process.exit(1); }
  const workbook = xlsx.readFile(source); data = {};
  for (const sheet of workbook.SheetNames) { const key = sheet.toLowerCase().includes("product") || sheet.toLowerCase().includes("stock") ? "products" : sheet.toLowerCase().includes("customer") || sheet.toLowerCase().includes("ledger") ? "customers" : sheet.toLowerCase().includes("vendor") || sheet.toLowerCase().includes("supplier") ? "vendors" : sheet.toLowerCase().includes("order") ? "orders" : null; if (key) data[key] = normalise(xlsx.utils.sheet_to_json(workbook.Sheets[sheet], { defval: "" }), key); }
} else if (extension === ".csv") {
  const name = source.toLowerCase(); const key = name.includes("product") || name.includes("stock") ? "products" : name.includes("customer") ? "customers" : name.includes("vendor") || name.includes("supplier") ? "vendors" : name.includes("order") ? "orders" : "products"; data = { [key]: normalise(csvRows(readFileSync(source, "utf8")), key) };
} else if (extension === ".xml") {
  const xml = readFileSync(source, "utf8"); const names = [...xml.matchAll(/<(?:LEDGER|STOCKITEM)[^>]*NAME="([^"]+)"/gi)].map((match) => ({ id: `TALLY-${match[1].replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`, name: match[1], source: "Tally XML" })); data = { customers: names.filter((row) => /customer|party|debtor/i.test(row.name)), vendors: names.filter((row) => /vendor|supplier|creditor/i.test(row.name)), products: names.filter((row) => !/customer|party|debtor|vendor|supplier|creditor/i.test(row.name)) };
} else { console.error("Supported imports: .xlsx, .xls, .csv or Tally .xml"); process.exit(1); }

writeFileSync(resolve(output), JSON.stringify({ source, generatedAt: new Date().toISOString(), ...data }, null, 2));
console.log(JSON.stringify({ ok: true, output: resolve(output), domains: Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])) }, null, 2));
