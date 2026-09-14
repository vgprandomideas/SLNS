import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const arrayDomains = ["products", "customers", "vendors", "orders", "purchaseOrders", "production", "stockMovements", "events", "audit", "locations", "qualityInspections", "invoices", "shipments", "receipts", "payments", "journalEntries", "gstLedger", "workflows", "roles", "integrations", "pieces", "weaverLedgers", "channels", "posSyncQueue", "contentAssets", "seasonality", "kpis", "risks", "approvalRules", "requisitions", "rfqs", "quotations", "grns", "vendorBills", "boms", "jobWorks", "wip", "priceLists", "priceHistory", "creditPolicies", "bankTransactions", "notifications", "documents", "rtoNdr", "returns", "outbox", "integrationFailures", "prdAcceptance", "uploadedDocuments", "paymentIntents", "refunds", "workflowHistory", "integrationEvents", "idempotencyKeys", "customerAccounts"];

export function openDatabase(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL, on_hand REAL NOT NULL DEFAULT 0, reserved REAL NOT NULL DEFAULT 0, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS parties (id TEXT PRIMARY KEY, party_type TEXT NOT NULL, name TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, product_id TEXT NOT NULL, value REAL NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, FOREIGN KEY(customer_id) REFERENCES parties(id), FOREIGN KEY(product_id) REFERENCES products(id));
    CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, total REAL NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id));
    CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL UNIQUE, product_id TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, occurred_at TEXT NOT NULL, payload TEXT NOT NULL, FOREIGN KEY(product_id) REFERENCES products(id));
    CREATE TABLE IF NOT EXISTS journal_entries (id TEXT PRIMARY KEY, reference TEXT NOT NULL, debit TEXT NOT NULL, credit TEXT NOT NULL, amount REAL NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, occurred_at TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS domain_records (domain TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(domain, id));`);
  return db;
}

function put(db, sql, rows, mapper) {
  const statement = db.prepare(sql);
  for (const row of rows) statement.run(...mapper(row));
}

export function persistRelationalStore(db, store) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM invoices; DELETE FROM orders; DELETE FROM stock_movements; DELETE FROM products; DELETE FROM parties; DELETE FROM journal_entries; DELETE FROM audit_events; DELETE FROM domain_records;");
    put(db, "INSERT INTO products(id,sku,name,category,on_hand,reserved,payload) VALUES(?,?,?,?,?,?,?)", store.products || [], (p) => [p.id, p.sku, p.name, p.category, p.onHand || 0, p.reserved || 0, JSON.stringify(p)]);
    put(db, "INSERT INTO parties(id,party_type,name,payload) VALUES(?,?,?,?)", [...(store.customers || []).map((p) => ({ ...p, partyType: "customer" })), ...(store.vendors || []).map((p) => ({ ...p, partyType: "vendor" }))], (p) => [p.id, p.partyType, p.name, JSON.stringify(p)]);
    put(db, "INSERT INTO orders(id,customer_id,product_id,value,status,payload) VALUES(?,?,?,?,?,?)", store.orders || [], (o) => [o.id, o.customerId, o.productId, o.value || 0, o.status, JSON.stringify(o)]);
    put(db, "INSERT INTO invoices(id,order_id,total,status,payload) VALUES(?,?,?,?,?)", store.invoices || [], (i) => [i.id, i.orderId, i.total || 0, i.status, JSON.stringify(i)]);
    put(db, "INSERT INTO stock_movements(id,transaction_id,product_id,type,quantity,occurred_at,payload) VALUES(?,?,?,?,?,?,?)", store.stockMovements || [], (m) => [m.id, m.transactionId, m.productId, m.type, m.qty || 0, m.occurredAt, JSON.stringify(m)]);
    put(db, "INSERT INTO journal_entries(id,reference,debit,credit,amount,payload) VALUES(?,?,?,?,?,?)", store.journalEntries || [], (j) => [j.id, j.reference, j.debit, j.credit, j.amount || 0, JSON.stringify(j)]);
    put(db, "INSERT INTO audit_events(id,action,entity,entity_id,occurred_at,payload) VALUES(?,?,?,?,?,?)", store.audit || [], (a) => [a.id, a.action, a.entity, a.entityId, a.occurredAt, JSON.stringify(a)]);
    for (const domain of arrayDomains) put(db, "INSERT INTO domain_records(domain,id,payload) VALUES(?,?,?)", store[domain] || [], (row) => [domain, row.id || `${domain}-${Math.random()}`, JSON.stringify(row)]);
    db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('snapshot',?)").run(JSON.stringify(store));
    db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('updated_at',?)").run(new Date().toISOString());
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function readDomain(db, domain) { return db.prepare("SELECT payload FROM domain_records WHERE domain = ? ORDER BY rowid").all(domain).map((row) => JSON.parse(row.payload)); }

export function loadRelationalStore(db, seed, legacyJsonPath) {
  const snapshot = db.prepare("SELECT value FROM meta WHERE key = 'snapshot'").get();
  if (snapshot?.value) return { ...seed, ...JSON.parse(snapshot.value) };
  if (legacyJsonPath && existsSync(legacyJsonPath)) {
    try { const legacy = JSON.parse(readFileSync(legacyJsonPath, "utf8")); return { ...seed, ...legacy }; } catch { /* fall through to seed */ }
  }
  return seed;
}
