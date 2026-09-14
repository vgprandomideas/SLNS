import http from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "public");
const dataDir = join(__dirname, "data");
const storePath = join(dataDir, "store.json");
const port = Number(process.env.PORT || 3000);
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;

function seedStore() {
  return {
    organisation: { name: "SLNS Silk House", legalEntity: "SLNS Silk House Private Limited", gstin: "29AABCS1234F1ZP", currency: "INR", branches: ["Bengaluru HQ", "Kanchipuram Workshop"] },
    products: [
      { id: "SKU-KANCHI-001", sku: "SL-KAN-001", name: "Kanchipuram Ruby Zari", collection: "Heritage Gold", category: "Kanchipuram Silk", material: "Mulberry silk", design: "Temple checks", colour: "Ruby", zari: "Pure zari", trueCost: 18400, price: 28900, gstRate: 5, reorderLevel: 3, onHand: 8, reserved: 1, unit: "piece" },
      { id: "SKU-BANARAS-014", sku: "SL-BAN-014", name: "Banarasi Midnight Bloom", collection: "Nocturne", category: "Banarasi Silk", material: "Katan silk", design: "Floral jaal", colour: "Midnight blue", zari: "Tested zari", trueCost: 9200, price: 16900, gstRate: 5, reorderLevel: 4, onHand: 3, reserved: 0, unit: "piece" },
      { id: "SKU-PAITHANI-008", sku: "SL-PAI-008", name: "Paithani Parrot Pallu", collection: "Deccan Stories", category: "Paithani", material: "Silk", design: "Muniya", colour: "Parrot green", zari: "Pure zari", trueCost: 12600, price: 22400, gstRate: 5, reorderLevel: 3, onHand: 5, reserved: 2, unit: "piece" },
      { id: "MAT-SILK-RAW", sku: "RM-SILK-RAW", name: "Mulberry silk yarn - raw", collection: "Materials", category: "Raw material", material: "Mulberry silk", design: "40/42 denier", colour: "Natural", zari: "-", trueCost: 4200, price: 4200, gstRate: 5, reorderLevel: 25, onHand: 42, reserved: 0, unit: "kg" },
      { id: "MAT-ZARI-RAW", sku: "RM-ZARI-RAW", name: "Tested zari - raw", collection: "Materials", category: "Raw material", material: "Zari", design: "60/40", colour: "Gold", zari: "-", trueCost: 7800, price: 7800, gstRate: 5, reorderLevel: 10, onHand: 7, reserved: 0, unit: "kg" }
    ],
    customers: [
      { id: "CUS-001", name: "Nila Sarees", type: "B2B dealer", city: "Chennai", creditLimit: 250000, outstanding: 118400 },
      { id: "CUS-002", name: "Ananya Iyer", type: "Retail", city: "Bengaluru", creditLimit: 0, outstanding: 0 },
      { id: "CUS-003", name: "Kaveri Collective", type: "Online", city: "Mumbai", creditLimit: 100000, outstanding: 22600 }
    ],
    vendors: [
      { id: "VEN-001", name: "Mysore Silk Co-op", type: "Silk yarn", city: "Mysuru", paymentTerms: "30 days" },
      { id: "VEN-002", name: "Raja Zari Works", type: "Zari and job work", city: "Surat", paymentTerms: "45 days" },
      { id: "VEN-003", name: "Kanchipuram Weavers Guild", type: "Weaving job work", city: "Kanchipuram", paymentTerms: "15 days" }
    ],
    orders: [
      { id: "SO-2026-0041", customerId: "CUS-001", customer: "Nila Sarees", channel: "Wholesale", productId: "SKU-KANCHI-001", product: "Kanchipuram Ruby Zari", qty: 1, value: 28900, status: "Ready to dispatch", createdAt: "2026-09-14T05:05:00.000Z" },
      { id: "SO-2026-0040", customerId: "CUS-003", customer: "Kaveri Collective", channel: "Online", productId: "SKU-PAITHANI-008", product: "Paithani Parrot Pallu", qty: 2, value: 44800, status: "Picking", createdAt: "2026-09-13T11:15:00.000Z" },
      { id: "SO-2026-0039", customerId: "CUS-002", customer: "Ananya Iyer", channel: "Retail", productId: "SKU-BANARAS-014", product: "Banarasi Midnight Bloom", qty: 1, value: 16900, status: "Delivered", createdAt: "2026-09-13T07:30:00.000Z" }
    ],
    production: [
      { id: "PO-2026-0018", product: "Kanchipuram Ruby Zari", stage: "Zari finishing", owner: "Kanchipuram Weavers Guild", due: "2026-09-17", progress: 72, status: "In progress" },
      { id: "PO-2026-0017", product: "Banarasi Midnight Bloom", stage: "Quality inspection", owner: "Raja Zari Works", due: "2026-09-15", progress: 94, status: "Awaiting QC" }
    ],
    purchaseOrders: [
      { id: "PO-2026-0088", vendor: "Mysore Silk Co-op", category: "Mulberry silk yarn", value: 126000, status: "Overdue", due: "2026-09-12" },
      { id: "PO-2026-0089", vendor: "Raja Zari Works", category: "Tested zari", value: 78000, status: "Awaiting receipt", due: "2026-09-18" }
    ],
    stockMovements: [
      { id: "MOV-1005", transactionId: "GRN-2026-0092", type: "RECEIPT", productId: "MAT-SILK-RAW", product: "Mulberry silk yarn - raw", qty: 20, unit: "kg", user: "Priya N.", occurredAt: "2026-09-14T07:20:00.000Z", note: "GRN against PO-2026-0088" },
      { id: "MOV-1004", transactionId: "ISS-2026-0048", type: "ISSUE", productId: "MAT-SILK-RAW", product: "Mulberry silk yarn - raw", qty: -6, unit: "kg", user: "Ravi K.", occurredAt: "2026-09-14T06:45:00.000Z", note: "Issue to PO-2026-0018" },
      { id: "MOV-1003", transactionId: "RES-2026-0041", type: "RESERVATION", productId: "SKU-KANCHI-001", product: "Kanchipuram Ruby Zari", qty: 1, unit: "piece", user: "System", occurredAt: "2026-09-14T05:05:00.000Z", note: "Sales order SO-2026-0041" },
      { id: "MOV-1002", transactionId: "PROD-2026-0021", type: "PRODUCTION", productId: "SKU-PAITHANI-008", product: "Paithani Parrot Pallu", qty: 2, unit: "piece", user: "Kiran S.", occurredAt: "2026-09-13T12:30:00.000Z", note: "Finished goods receipt" },
      { id: "MOV-1001", transactionId: "SALE-2026-0039", type: "SALE", productId: "SKU-BANARAS-014", product: "Banarasi Midnight Bloom", qty: -1, unit: "piece", user: "Ananya I.", occurredAt: "2026-09-13T09:45:00.000Z", note: "Retail invoice INV-2026-0039" }
    ],
    events: [
      { id: "EVT-1", type: "SALE", title: "Order SO-2026-0041 reserved", detail: "Nila Sarees · 1 Kanchipuram Ruby Zari", user: "System", occurredAt: "2026-09-14T05:05:00.000Z" },
      { id: "EVT-2", type: "QC", title: "QC inspection pending", detail: "Banarasi Midnight Bloom · PO-2026-0017", user: "Ravi K.", occurredAt: "2026-09-14T04:40:00.000Z" },
      { id: "EVT-3", type: "RECEIPT", title: "Material receipt posted", detail: "20 kg Mulberry silk yarn", user: "Priya N.", occurredAt: "2026-09-14T03:50:00.000Z" },
      { id: "EVT-4", type: "ALERT", title: "Purchase order overdue", detail: "Mysore Silk Co-op · PO-2026-0088", user: "Workflow", occurredAt: "2026-09-14T03:20:00.000Z" }
    ],
    audit: []
  };
}

function loadStore() {
  if (!existsSync(storePath)) return seedStore();
  try { return JSON.parse(readFileSync(storePath, "utf8")); } catch { return seedStore(); }
}
let store = loadStore();
function persist() { mkdirSync(dataDir, { recursive: true }); writeFileSync(storePath, JSON.stringify(store, null, 2)); }
const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
const bad = (res, message) => json(res, 400, { error: message });
const available = (product) => product.onHand - product.reserved;
function logEvent(type, title, detail, user = "Demo User") { store.events.unshift({ id: id("EVT"), type, title, detail, user, occurredAt: now() }); store.events = store.events.slice(0, 20); }
function audit(action, entity, entityId, detail, user = "Demo User") { store.audit.unshift({ id: id("AUD"), action, entity, entityId, detail, user, occurredAt: now() }); }
function summary() {
  const inventoryValue = store.products.reduce((sum, p) => sum + p.onHand * p.trueCost, 0);
  const openOrders = store.orders.filter((o) => o.status !== "Delivered");
  const salesValue = store.orders.reduce((sum, o) => sum + o.value, 0);
  const receivables = store.customers.reduce((sum, c) => sum + c.outstanding, 0);
  const payables = store.purchaseOrders.reduce((sum, p) => sum + p.value, 0);
  const lowStock = store.products.filter((p) => available(p) <= p.reorderLevel);
  return { salesValue, collections: 118400, inventoryValue, receivables, payables, openOrders: openOrders.length, wip: 184600, lowStock: lowStock.length, margin: 34.8, cash: 842300 };
}
async function body(req) { let text = ""; for await (const chunk of req) text += chunk; if (!text) return {}; try { return JSON.parse(text); } catch { return null; } }
function staticFile(req, res) {
  const rawPath = new URL(req.url, "http://localhost").pathname;
  const requested = rawPath === "/" ? "/index.html" : rawPath;
  const file = join(publicDir, requested.replace(/^\//, ""));
  if (!file.startsWith(publicDir) || !existsSync(file)) return false;
  const contentTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
  res.writeHead(200, { "Content-Type": `${contentTypes[extname(file)] || "application/octet-stream"}; charset=utf-8` }); res.end(readFileSync(file)); return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/health") return json(res, 200, { ok: true, service: "slns-platform", version: "0.1.0", time: now() });
    if (url.pathname === "/api/summary") return json(res, 200, summary());
    if (url.pathname === "/api/products") return json(res, 200, store.products.map((p) => ({ ...p, available: available(p) })));
    if (url.pathname === "/api/orders") return json(res, 200, store.orders);
    if (url.pathname === "/api/events") return json(res, 200, store.events);
    if (url.pathname === "/api/alerts") return json(res, 200, [
      ...store.purchaseOrders.filter((p) => p.status === "Overdue").map((p) => ({ severity: "high", title: "Purchase order overdue", detail: `${p.id} · ${p.vendor}`, action: "Follow up vendor" })),
      ...store.products.filter((p) => available(p) <= p.reorderLevel).map((p) => ({ severity: "medium", title: "Stock below reorder level", detail: `${p.name} · ${available(p)} ${p.unit} available`, action: "Create requisition" })),
      ...store.production.filter((p) => p.status === "Awaiting QC").map((p) => ({ severity: "medium", title: "QC inspection pending", detail: `${p.product} · ${p.id}`, action: "Open QC queue" })),
      { severity: "low", title: "Receivable approaching due", detail: "Kaveri Collective · ₹22,600", action: "Review account" }
    ]);
    if (url.pathname === "/api/finance") return json(res, 200, { receivables: store.customers, payables: store.purchaseOrders, cash: summary().cash, tax: { input: 32400, output: 68400, pendingReconciliation: 2 } });
    if (url.pathname === "/api/audit") return json(res, 200, store.audit.slice(0, 50));
    return json(res, 404, { error: "Not found" });
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/")) {
    const payload = await body(req); if (payload === null) return bad(res, "Request body must be valid JSON");
    if (url.pathname === "/api/actions/receive" || url.pathname === "/api/actions/production") {
      const product = store.products.find((p) => p.id === payload.productId); const qty = Number(payload.qty);
      if (!product || !Number.isFinite(qty) || qty <= 0) return bad(res, "Choose a product and a positive quantity");
      if (url.pathname.endsWith("production") && product.category === "Raw material") return bad(res, "Production receipt must use a finished-goods SKU");
      product.onHand += qty; const transactionId = id(url.pathname.endsWith("receive") ? "GRN" : "PROD").toUpperCase();
      const type = url.pathname.endsWith("receive") ? "RECEIPT" : "PRODUCTION";
      store.stockMovements.unshift({ id: id("MOV").toUpperCase(), transactionId, type, productId: product.id, product: product.name, qty, unit: product.unit, user: payload.user || "Demo User", occurredAt: now(), note: payload.note || (type === "RECEIPT" ? "Manual material receipt" : "Finished goods receipt") });
      logEvent(type, type === "RECEIPT" ? "Material receipt posted" : "Finished goods received", `${qty} ${product.unit} ${product.name}`);
      audit("CREATE", type === "RECEIPT" ? "GRN" : "PRODUCTION_RECEIPT", transactionId, `Posted ${qty} ${product.sku}`); persist();
      return json(res, 201, { transactionId, product: { ...product, available: available(product) } });
    }
    if (url.pathname === "/api/actions/order") {
      const product = store.products.find((p) => p.id === payload.productId); const customer = store.customers.find((c) => c.id === payload.customerId); const qty = Number(payload.qty);
      if (!product || !customer || !Number.isFinite(qty) || qty <= 0) return bad(res, "Choose product, customer and a positive quantity");
      if (available(product) < qty) return bad(res, `Insufficient available stock. Only ${available(product)} ${product.unit} available.`);
      product.reserved += qty; const orderId = `SO-${new Date().getFullYear()}-${String(store.orders.length + 42).padStart(4, "0")}`;
      const order = { id: orderId, customerId: customer.id, customer: customer.name, channel: payload.channel || "Online", productId: product.id, product: product.name, qty, value: product.price * qty, status: "Ready to dispatch", createdAt: now() };
      store.orders.unshift(order); const transactionId = id("RES").toUpperCase();
      store.stockMovements.unshift({ id: id("MOV").toUpperCase(), transactionId, type: "RESERVATION", productId: product.id, product: product.name, qty, unit: product.unit, user: payload.user || "Demo User", occurredAt: now(), note: `Sales order ${orderId}` });
      logEvent("SALE", "Sales order reserved", `${orderId} · ${qty} ${product.unit} ${product.name}`); audit("CREATE", "SALES_ORDER", orderId, `Reserved ${qty} ${product.sku} for ${customer.name}`); persist();
      return json(res, 201, { order, transactionId });
    }
    return json(res, 404, { error: "Not found" });
  }
  if (req.method === "GET" && staticFile(req, res)) return;
  if (!url.pathname.startsWith("/api/")) return staticFile(req, res) || json(res, 404, { error: "Not found" });
  return json(res, 405, { error: "Method not allowed" });
});

server.listen(port, () => console.log(`SLNS Silk Operations Platform running at http://localhost:${port}`));
