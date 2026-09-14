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
    audit: [],
    locations: [
      { id: "BIN-BLR-A1", warehouse: "Bengaluru HQ", zone: "Finished goods", rack: "A", bin: "A1", state: "Finished goods" },
      { id: "BIN-BLR-R1", warehouse: "Bengaluru HQ", zone: "Raw materials", rack: "R", bin: "R1", state: "Raw material" },
      { id: "BIN-KAN-W1", warehouse: "Kanchipuram Workshop", zone: "WIP", rack: "W", bin: "W1", state: "WIP" }
    ],
    qualityInspections: [
      { id: "QC-2026-0042", reference: "PO-2026-0017", product: "Banarasi Midnight Bloom", type: "Production", status: "Awaiting QC", inspector: "Ravi K.", criteria: "Weave, colour, zari, dimensions" },
      { id: "QC-2026-0041", reference: "GRN-2026-0092", product: "Mulberry silk yarn - raw", type: "Material receipt", status: "Accepted", inspector: "Priya N.", criteria: "Count, weight, shade" }
    ],
    invoices: [
      { id: "INV-2026-0039", orderId: "SO-2026-0039", customer: "Ananya Iyer", taxableValue: 16095, gst: 805, total: 16900, status: "Paid", due: "2026-09-13", issuedAt: "2026-09-13T09:45:00.000Z" },
      { id: "INV-2026-0041", orderId: "SO-2026-0041", customer: "Nila Sarees", taxableValue: 27524, gst: 1376, total: 28900, status: "Outstanding", due: "2026-10-13", issuedAt: "2026-09-14T05:06:00.000Z" }
    ],
    shipments: [
      { id: "PKG-2026-0040", orderId: "SO-2026-0040", carrier: "BlueDart", tracking: "BD78439201", status: "Picking", packageId: "PKG-2026-0040", destination: "Mumbai" }
    ],
    receipts: [{ id: "RCT-2026-0118", invoiceId: "INV-2026-0039", customer: "Ananya Iyer", amount: 16900, mode: "UPI", status: "Reconciled", receivedAt: "2026-09-13T10:01:00.000Z" }],
    payments: [],
    journalEntries: [
      { id: "JE-2026-0211", reference: "INV-2026-0041", description: "Sales invoice · Nila Sarees", debit: "Accounts receivable", credit: "Sales revenue", amount: 28900, status: "Posted" },
      { id: "JE-2026-0210", reference: "INV-2026-0041", description: "Output GST · 5%", debit: "Accounts receivable", credit: "Output GST", amount: 1376, status: "Posted" },
      { id: "JE-2026-0209", reference: "RCT-2026-0118", description: "UPI receipt · Ananya Iyer", debit: "Bank - UPI", credit: "Accounts receivable", amount: 16900, status: "Posted" }
    ],
    gstLedger: [
      { id: "GST-2026-0061", reference: "INV-2026-0041", direction: "Output", hsn: "5007", rate: 5, taxableValue: 27524, tax: 1376, status: "Ready for return" },
      { id: "GST-2026-0059", reference: "GRN-2026-0092", direction: "Input", hsn: "5005", rate: 5, taxableValue: 120000, tax: 6000, status: "Reconciled" }
    ],
    workflows: [
      { id: "WF-001", type: "Payment approval", reference: "VEN-002 / PO-2026-0089", owner: "CFO", status: "Pending", threshold: "₹50,000+" },
      { id: "WF-002", type: "QC approval", reference: "QC-2026-0042", owner: "Production Head", status: "Pending", threshold: "All production receipts" },
      { id: "WF-003", type: "Credit approval", reference: "SO-2026-0041", owner: "Sales Head", status: "Approved", threshold: "B2B credit terms" }
    ],
    roles: [
      { id: "ROLE-OWNER", name: "Owner / Board", permissions: "View, approve, export", users: 1 },
      { id: "ROLE-FINANCE", name: "CFO / Finance Head", permissions: "Finance, GST, approve payments", users: 1 },
      { id: "ROLE-WAREHOUSE", name: "Warehouse", permissions: "Receive, pick, transfer, count", users: 3 },
      { id: "ROLE-AUDITOR", name: "Auditor", permissions: "View audit, export", users: 1 }
    ],
    integrations: [
      { name: "GST / e-invoice provider", status: "Ready to connect", mode: "REST + webhook" },
      { name: "Bank feeds", status: "Ready to connect", mode: "Statement import / API" },
      { name: "Courier / logistics", status: "Sandbox", mode: "Tracking webhook" },
      { name: "WhatsApp / email", status: "Ready to connect", mode: "Template messages" }
    ],
    migration: { sourceSystems: ["Excel", "Tally", "Paper registers"], phases: ["Extract", "Clean & deduplicate", "Migrate masters", "Reconcile opening balances", "Parallel verify", "Progressive cutover"], status: "Planning" },
    pieces: [
      { id: "PIECE-001", sku: "SL-KAN-001", qr: "QR-SL-KAN-001", grade: "A", batch: "KAN-SEP-26-01", weight: "612 g", length: "6.3 m", status: "Available", location: "BIN-BLR-A1" },
      { id: "PIECE-002", sku: "SL-KAN-001", qr: "QR-SL-KAN-001-B", grade: "B", batch: "KAN-SEP-26-01", weight: "606 g", length: "6.2 m", status: "Reserved", location: "BIN-BLR-A1" },
      { id: "PIECE-003", sku: "SL-PAI-008", qr: "QR-SL-PAI-008", grade: "A", batch: "PAI-AUG-26-04", weight: "580 g", length: "6.1 m", status: "Available", location: "BIN-BLR-A1" }
    ],
    weaverLedgers: [
      { id: "WL-001", weaver: "Lakshmi Weaver Cluster", gstStatus: "Unregistered", advance: 45000, payable: 78000, dispatches: 4, confirmation: "WhatsApp confirmed" },
      { id: "WL-002", weaver: "Kanchipuram Weavers Guild", gstStatus: "Registered", advance: 25000, payable: 54000, dispatches: 2, confirmation: "Portal confirmed" }
    ],
    channels: [
      { name: "Wholesale", orders: 18, revenue: 486000, returns: 1, rto: 0, realisedMargin: 38.2 },
      { name: "Online · prepaid", orders: 31, revenue: 624000, returns: 3, rto: 1, realisedMargin: 32.8 },
      { name: "Online · COD", orders: 22, revenue: 418000, returns: 4, rto: 6, realisedMargin: 19.4 },
      { name: "Exhibitions / POS", orders: 14, revenue: 296000, returns: 0, rto: 0, realisedMargin: 41.5 }
    ],
    posSyncQueue: [
      { id: "POS-EVT-0088", device: "Exhibition POS · Bengaluru", createdAt: "2026-09-14T04:20:00.000Z", status: "Synced", idempotencyKey: "pos-0088" },
      { id: "POS-EVT-0089", device: "Home preview · Priya", createdAt: "2026-09-14T05:10:00.000Z", status: "Pending sync", idempotencyKey: "pos-0089" }
    ],
    contentAssets: [
      { id: "ASSET-001", sku: "SL-KAN-001", name: "Kanchipuram Ruby Zari", photos: 6, altText: true, copyStatus: "Approved", channelStatus: "Live" },
      { id: "ASSET-002", sku: "SL-BAN-014", name: "Banarasi Midnight Bloom", photos: 2, altText: false, copyStatus: "Draft", channelStatus: "Needs review" },
      { id: "ASSET-003", sku: "SL-PAI-008", name: "Paithani Parrot Pallu", photos: 0, altText: false, copyStatus: "Missing", channelStatus: "Blocked" }
    ],
    seasonality: [
      { festival: "Diwali", window: "20 Oct - 08 Nov", readiness: 68, leadTimeDays: 28, collections: "Heritage Gold, Nocturne", status: "Prepare now" },
      { festival: "Pongal", window: "10 - 17 Jan", readiness: 22, leadTimeDays: 35, collections: "Deccan Stories", status: "Planning" },
      { festival: "Wedding season", window: "Nov - Feb", readiness: 54, leadTimeDays: 42, collections: "All bridal", status: "Monitor" }
    ],
    kpis: [
      { category: "Sales & margin", name: "Realised contribution margin after returns", value: "29.6%", trend: "down 1.8 pts", tone: "warn" },
      { category: "Inventory", name: "Inventory turnover", value: "2.8x", trend: "on plan", tone: "good" },
      { category: "Manufacturing", name: "On-time job-work completion", value: "87%", trend: "up 4 pts", tone: "good" },
      { category: "Working capital", name: "Receivable days (DSO)", value: "34 days", trend: "target < 40", tone: "good" },
      { category: "Fulfilment", name: "RTO rate", value: "11.6%", trend: "COD needs action", tone: "warn" },
      { category: "Compliance", name: "GST reconciliation match", value: "98.4%", trend: "2 exceptions", tone: "good" },
      { category: "Adoption", name: "Transactions through system", value: "91%", trend: "target > 95%", tone: "warn" }
    ],
    risks: [
      { risk: "Over-building custom software", likelihood: "High", impact: "High", mitigation: "Record build-vs-buy decision and pilot configured ERP", owner: "CEO", status: "Open" },
      { risk: "Poor user adoption / side spreadsheets", likelihood: "High", impact: "High", mitigation: "Training, incentives and adoption KPI", owner: "Operations", status: "Open" },
      { risk: "RTO erases online margin", likelihood: "Medium", impact: "Medium", mitigation: "NDR aggregator, buyer confirmation, partial COD", owner: "Sales", status: "Mitigating" },
      { risk: "Customer PII breach", likelihood: "Low", impact: "High", mitigation: "Encryption, MFA, DPDP controls and penetration test", owner: "System Admin", status: "Planned" }
    ],
    nfr: { availability: "99.5% business-hours uptime", rpo: "≤ 15 minutes", rto: "≤ 4 hours", response: "≤ 1.5s p95", concurrency: "3× current headcount", retention: "8 years financial/GST", backup: "Daily full + continuous WAL + quarterly restore drill", environments: "Dev / staging / production separated" },
    privacy: { policy: "Purpose-limited collection", marketingConsent: "Consent captured for WhatsApp/SMS", piiAccess: "Role-restricted", retention: "Retention and deletion policy required", breach: "Breach-notification readiness", payment: "Avoid card storage; provider tokenisation" },
    buildBuy: [
      { option: "Configured ERP", bestWhen: "80% standard processes, limited dev capacity", tradeoff: "Saree grading and job-work may need add-ons", recommendation: "Evaluate first" },
      { option: "ERP + custom add-ons", bestWhen: "Standard core plus distinctive operations", tradeoff: "Two systems to maintain", recommendation: "Likely fit" },
      { option: "Full custom build", bestWhen: "Process is a competitive moat and dev capacity exists", tradeoff: "Highest cost, time and lifetime ownership", recommendation: "Only with evidence" }
    ],
    successTests: [
      { name: "Traceability", test: "Trace one saree from material to receipt", status: "Ready" },
      { name: "Financial integrity", test: "Trace every rupee to bank and ledger", status: "Ready" },
      { name: "Adoption", test: "Staff use system and side spreadsheets disappear", status: "Measure in pilot" },
      { name: "Resilience", test: "Restore backup and survive primary-server loss", status: "Drill required" }
    ]
  };
}

function loadStore() {
  const defaults = seedStore();
  if (!existsSync(storePath)) return defaults;
  try {
    const saved = JSON.parse(readFileSync(storePath, "utf8"));
    return { ...defaults, ...saved, products: saved.products || defaults.products, customers: saved.customers || defaults.customers, orders: saved.orders || defaults.orders, events: saved.events || defaults.events, audit: saved.audit || defaults.audit };
  } catch { return defaults; }
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
function blueprint() {
  return {
    architecture: ["Web admin + mobile/PWA + POS", "API backend", "Modular business domains", "PostgreSQL-ready transactional store", "Redis/cache + object storage", "BI / analytics"],
    canonicalFlow: ["Supplier", "Purchase order", "GRN + QC", "Raw material", "Production / job work", "WIP", "Finished saree", "SKU + barcode", "Warehouse", "Sales order", "Invoice", "Dispatch", "Customer", "Receipt", "Bank reconciliation"],
    modules: [
      { id: "masters", name: "Master data foundation", status: "Live", entities: "Organisation, products/SKUs, parties, tax, price lists, bins" },
      { id: "procurement", name: "Procurement & vendor management", status: "Live", entities: "Requisitions, RFQs, quotations, POs, GRNs, QC, 3-way match" },
      { id: "manufacturing", name: "Manufacturing & job work", status: "Live", entities: "Production orders, material issue, WIP, job work, yield, wastage" },
      { id: "inventory", name: "Inventory & warehouse", status: "Live", entities: "Stock states, ledger, reservations, transfers, counts, ageing" },
      { id: "sales", name: "Omnichannel sales & CRM", status: "Live", entities: "Quotes, orders, pricing, credit, customers, returns" },
      { id: "logistics", name: "Logistics & fulfilment", status: "Live", entities: "Packages, invoices, dispatch, tracking, POD, returns" },
      { id: "finance", name: "Finance, payments & banking", status: "Live", entities: "GL, AP, AR, receipts, payments, reconciliation" },
      { id: "gst", name: "GST & statutory compliance", status: "Ready for provider", entities: "HSN, input/output tax, e-invoice, e-way bill, reconciliation" },
      { id: "control", name: "Control tower & workflow alerts", status: "Live", entities: "Revenue, margin, cash, exceptions, approvals, audit" }
    ],
    principles: ["One canonical master per vendor, customer, product and location", "Operational transactions generate finance and tax consequences", "Immutable stock and audit history", "Idempotent APIs and integration events", "Maker-checker and segregation of duties", "Configuration over hard-coding", "AI after clean transactional data"],
    roadmap: ["Foundation + controls", "Procure-to-pay", "Manufacture-to-stock", "Order-to-cash", "Finance + compliance", "Management intelligence", "Customer channels"]
  };
}
function enhancements() {
  return { nfr: store.nfr, privacy: store.privacy, pieces: store.pieces, weaverLedgers: store.weaverLedgers, channels: store.channels, posSyncQueue: store.posSyncQueue, contentAssets: store.contentAssets, seasonality: store.seasonality, kpis: store.kpis, risks: store.risks, buildBuy: store.buildBuy, successTests: store.successTests };
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
    if (url.pathname === "/api/blueprint") return json(res, 200, blueprint());
    if (url.pathname === "/api/enhancements") return json(res, 200, enhancements());
    if (url.pathname === "/api/masters") return json(res, 200, { organisation: store.organisation, products: store.products, customers: store.customers, vendors: store.vendors, locations: store.locations, roles: store.roles, integrations: store.integrations, migration: store.migration });
    if (url.pathname === "/api/products") return json(res, 200, store.products.map((p) => ({ ...p, available: available(p) })));
    if (url.pathname === "/api/costing") return json(res, 200, store.products.filter((p) => p.category !== "Raw material").map((p) => { const components = [{ name: "Silk / yarn", value: Math.round(p.trueCost * 0.34) }, { name: "Zari", value: Math.round(p.trueCost * 0.13) }, { name: "Dyeing + weaving", value: Math.round(p.trueCost * 0.28) }, { name: "Job work + finishing", value: Math.round(p.trueCost * 0.17) }, { name: "Packaging + freight + overhead", value: Math.round(p.trueCost * 0.08) }]; return { sku: p.sku, name: p.name, trueCost: p.trueCost, price: p.price, contributionMargin: p.price - p.trueCost - Math.round(p.price * 0.05), components }; }));
    if (url.pathname === "/api/orders") return json(res, 200, store.orders);
    if (url.pathname === "/api/stock-movements") return json(res, 200, store.stockMovements.slice(0, 50));
    if (url.pathname === "/api/quality") return json(res, 200, store.qualityInspections);
    if (url.pathname === "/api/production") return json(res, 200, store.production);
    if (url.pathname === "/api/procurement") return json(res, 200, { purchaseOrders: store.purchaseOrders, vendors: store.vendors, workflows: store.workflows.filter((w) => /Payment|Procurement/i.test(w.type)) });
    if (url.pathname === "/api/logistics") return json(res, 200, { invoices: store.invoices, shipments: store.shipments, receipts: store.receipts });
    if (url.pathname === "/api/events") return json(res, 200, store.events);
    if (url.pathname === "/api/alerts") return json(res, 200, [
      ...store.purchaseOrders.filter((p) => p.status === "Overdue").map((p) => ({ severity: "high", title: "Purchase order overdue", detail: `${p.id} · ${p.vendor}`, action: "Follow up vendor" })),
      ...store.products.filter((p) => available(p) <= p.reorderLevel).map((p) => ({ severity: "medium", title: "Stock below reorder level", detail: `${p.name} · ${available(p)} ${p.unit} available`, action: "Create requisition" })),
      ...store.production.filter((p) => p.status === "Awaiting QC").map((p) => ({ severity: "medium", title: "QC inspection pending", detail: `${p.product} · ${p.id}`, action: "Open QC queue" })),
      { severity: "medium", title: "Festival readiness below plan", detail: "Diwali · 68% ready with 28-day lead time", action: "Review collection plan" },
      { severity: "high", title: "COD RTO above margin threshold", detail: "Online COD · 27% RTO this month", action: "Open NDR queue" },
      { severity: "low", title: "Receivable approaching due", detail: "Kaveri Collective · ₹22,600", action: "Review account" }
    ]);
    if (url.pathname === "/api/finance") return json(res, 200, { receivables: store.customers, payables: store.purchaseOrders, cash: summary().cash, tax: { input: 32400, output: 68400, pendingReconciliation: 2 } });
    if (url.pathname === "/api/ledger") return json(res, 200, { journalEntries: store.journalEntries, gstLedger: store.gstLedger, receipts: store.receipts, payments: store.payments });
    if (url.pathname === "/api/workflows") return json(res, 200, store.workflows);
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
    if (url.pathname === "/api/actions/invoice") {
      const order = store.orders.find((o) => o.id === payload.orderId);
      if (!order) return bad(res, "Sales order not found");
      if (store.invoices.some((i) => i.orderId === order.id)) return bad(res, "This order already has an invoice");
      const taxableValue = Math.round(order.value / 1.05); const gst = order.value - taxableValue; const invoiceId = `INV-${new Date().getFullYear()}-${String(store.invoices.length + 42).padStart(4, "0")}`;
      const invoice = { id: invoiceId, orderId: order.id, customer: order.customer, taxableValue, gst, total: order.value, status: "Outstanding", due: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), issuedAt: now() };
      store.invoices.unshift(invoice); order.status = "Invoiced";
      store.journalEntries.unshift({ id: id("JE").toUpperCase(), reference: invoiceId, description: `Sales invoice · ${order.customer}`, debit: "Accounts receivable", credit: "Sales revenue", amount: order.value, status: "Posted" });
      store.gstLedger.unshift({ id: id("GST").toUpperCase(), reference: invoiceId, direction: "Output", hsn: "5007", rate: 5, taxableValue, tax: gst, status: "Ready for return" });
      logEvent("FINANCE", "Invoice issued", `${invoiceId} · ${order.customer} · ${order.value}`); audit("POST", "INVOICE", invoiceId, `Issued from ${order.id}`); persist();
      return json(res, 201, invoice);
    }
    if (url.pathname === "/api/actions/dispatch") {
      const order = store.orders.find((o) => o.id === payload.orderId); const product = order && store.products.find((p) => p.id === order.productId);
      if (!order || !product) return bad(res, "Order or product not found");
      if (product.reserved < order.qty || product.onHand < order.qty) return bad(res, "Reserved stock is not available for dispatch");
      product.onHand -= order.qty; product.reserved -= order.qty; order.status = "Dispatched";
      const shipmentId = `SHP-${new Date().getFullYear()}-${String(store.shipments.length + 41).padStart(4, "0")}`; const transactionId = id("SHIP").toUpperCase();
      const shipment = { id: shipmentId, orderId: order.id, carrier: payload.carrier || "BlueDart", tracking: payload.tracking || `TRK${Date.now().toString().slice(-8)}`, status: "Dispatched", packageId: `PKG-${shipmentId.slice(4)}`, destination: payload.destination || "India" };
      store.shipments.unshift(shipment); store.stockMovements.unshift({ id: id("MOV").toUpperCase(), transactionId, type: "SHIPMENT", productId: product.id, product: product.name, qty: -order.qty, unit: product.unit, user: payload.user || "Demo User", occurredAt: now(), note: `Dispatch ${order.id}` });
      logEvent("LOGISTICS", "Order dispatched", `${order.id} · ${shipment.tracking}`); audit("POST", "SHIPMENT", shipmentId, `Dispatched ${order.qty} ${product.sku}`); persist();
      return json(res, 201, { shipment, transactionId });
    }
    if (url.pathname === "/api/actions/receipt") {
      const invoice = store.invoices.find((i) => i.id === payload.invoiceId); const amount = Number(payload.amount);
      if (!invoice || !Number.isFinite(amount) || amount <= 0 || amount > invoice.total) return bad(res, "Choose an invoice and a valid receipt amount");
      const receiptId = id("RCT").toUpperCase(); const receipt = { id: receiptId, invoiceId: invoice.id, customer: invoice.customer, amount, mode: payload.mode || "UPI", status: "Reconciled", receivedAt: now() };
      store.receipts.unshift(receipt); invoice.status = amount >= invoice.total ? "Paid" : "Part paid";
      const customer = store.customers.find((c) => c.name === invoice.customer); if (customer) customer.outstanding = Math.max(0, customer.outstanding - amount);
      store.journalEntries.unshift({ id: id("JE").toUpperCase(), reference: receiptId, description: `Customer receipt · ${invoice.customer}`, debit: `Bank - ${receipt.mode}`, credit: "Accounts receivable", amount, status: "Posted" });
      logEvent("FINANCE", "Customer receipt reconciled", `${receiptId} · ${invoice.customer} · ${amount}`); audit("POST", "RECEIPT", receiptId, `Settled ${invoice.id}`); persist();
      return json(res, 201, receipt);
    }
    if (url.pathname === "/api/actions/qc") {
      const inspection = store.qualityInspections.find((q) => q.id === payload.inspectionId); if (!inspection || !["Accepted", "Rejected"].includes(payload.status)) return bad(res, "Choose a QC inspection and Accepted or Rejected");
      inspection.status = payload.status; inspection.inspector = payload.inspector || "Demo User"; const workflow = store.workflows.find((w) => w.reference.includes(inspection.id)); if (workflow) workflow.status = "Approved";
      logEvent("QC", `QC ${payload.status.toLowerCase()}`, `${inspection.id} · ${inspection.product}`); audit("APPROVE", "QUALITY_INSPECTION", inspection.id, `QC result ${payload.status}`); persist(); return json(res, 200, inspection);
    }
    if (url.pathname === "/api/actions/material-issue") {
      const product = store.products.find((p) => p.id === payload.productId); const qty = Number(payload.qty);
      if (!product || product.category !== "Raw material" || !Number.isFinite(qty) || qty <= 0 || available(product) < qty) return bad(res, "Choose available raw material and a valid issue quantity");
      product.onHand -= qty; const transactionId = id("ISS").toUpperCase();
      store.stockMovements.unshift({ id: id("MOV").toUpperCase(), transactionId, type: "ISSUE", productId: product.id, product: product.name, qty: -qty, unit: product.unit, user: payload.user || "Demo User", occurredAt: now(), note: `Issue to ${payload.productionId || "WIP"}` });
      logEvent("PRODUCTION", "Raw material issued", `${qty} ${product.unit} ${product.name} → ${payload.productionId || "WIP"}`); audit("POST", "MATERIAL_ISSUE", transactionId, `Issued ${qty} ${product.sku}`); persist(); return json(res, 201, { transactionId, product: { ...product, available: available(product) } });
    }
    if (url.pathname === "/api/actions/transfer") {
      const product = store.products.find((p) => p.id === payload.productId); const qty = Number(payload.qty);
      if (!product || !Number.isFinite(qty) || qty <= 0 || available(product) < qty || !payload.from || !payload.to) return bad(res, "Choose product, locations and a valid available quantity");
      const transactionId = id("TRF").toUpperCase(); store.stockMovements.unshift({ id: id("MOV").toUpperCase(), transactionId, type: "TRANSFER", productId: product.id, product: product.name, qty: 0, unit: product.unit, user: payload.user || "Demo User", occurredAt: now(), note: `${payload.from} → ${payload.to}` });
      logEvent("INVENTORY", "Stock transfer posted", `${qty} ${product.unit} ${product.name} · ${payload.from} → ${payload.to}`); audit("POST", "STOCK_TRANSFER", transactionId, `Moved ${qty} ${product.sku}`); persist(); return json(res, 201, { transactionId });
    }
    if (url.pathname === "/api/actions/return") {
      const order = store.orders.find((o) => o.id === payload.orderId); const product = order && store.products.find((p) => p.id === order.productId); const qty = Number(payload.qty || order?.qty);
      if (!order || !product || !Number.isFinite(qty) || qty <= 0 || qty > order.qty) return bad(res, "Choose a valid order and return quantity");
      product.onHand += qty; order.status = "Returned"; const creditNoteId = `CN-${new Date().getFullYear()}-${String(store.invoices.length + 1).padStart(4, "0")}`; const transactionId = id("RET").toUpperCase();
      store.stockMovements.unshift({ id: id("MOV").toUpperCase(), transactionId, type: "RETURN", productId: product.id, product: product.name, qty, unit: product.unit, user: payload.user || "Demo User", occurredAt: now(), note: payload.reason || "Customer return" });
      store.gstLedger.unshift({ id: id("GST").toUpperCase(), reference: creditNoteId, direction: "Adjustment", hsn: "5007", rate: 5, taxableValue: Math.round((product.price * qty) / 1.05), tax: Math.round((product.price * qty) - (product.price * qty) / 1.05), status: "Ready for return" });
      logEvent("SALE", "Return and credit note posted", `${creditNoteId} · ${order.id}`); audit("POST", "CREDIT_NOTE", creditNoteId, `Returned ${qty} ${product.sku}`); persist(); return json(res, 201, { creditNoteId, transactionId });
    }
    if (url.pathname === "/api/actions/approve") {
      const workflow = store.workflows.find((w) => w.id === payload.workflowId); if (!workflow) return bad(res, "Workflow task not found");
      workflow.status = payload.status === "Rejected" ? "Rejected" : "Approved"; audit("APPROVE", "WORKFLOW", workflow.id, `${workflow.type} marked ${workflow.status}`); persist(); return json(res, 200, workflow);
    }
    if (url.pathname === "/api/actions/pos-sync") {
      const event = store.posSyncQueue.find((p) => p.id === payload.eventId); if (!event) return bad(res, "POS event not found");
      if (event.status === "Synced") return json(res, 200, { event, idempotent: true });
      event.status = "Synced"; event.syncedAt = now(); logEvent("POS", "Offline POS event synced", `${event.id} · ${event.device}`); audit("SYNC", "POS_EVENT", event.id, `Idempotency key ${event.idempotencyKey}`); persist(); return json(res, 200, { event, idempotent: false });
    }
    if (url.pathname === "/api/actions/weaver-advance") {
      const ledger = store.weaverLedgers.find((w) => w.id === payload.weaverId); const amount = Number(payload.amount);
      if (!ledger || !Number.isFinite(amount) || amount <= 0) return bad(res, "Choose a weaver and a positive advance amount");
      ledger.advance += amount; const paymentId = id("ADV").toUpperCase(); store.payments.unshift({ id: paymentId, vendor: ledger.weaver, amount, type: "Weaver advance", status: "Posted", paidAt: now() }); store.journalEntries.unshift({ id: id("JE").toUpperCase(), reference: paymentId, description: `Weaver advance · ${ledger.weaver}`, debit: "Weaver advances", credit: "Bank / cash", amount, status: "Posted" }); logEvent("PROCUREMENT", "Weaver advance posted", `${ledger.weaver} · ${amount}`); audit("POST", "WEAVER_ADVANCE", paymentId, `Advance posted for ${ledger.id}`); persist(); return json(res, 201, { paymentId, ledger });
    }
    if (url.pathname === "/api/actions/content") {
      const asset = store.contentAssets.find((a) => a.id === payload.assetId); if (!asset) return bad(res, "Content asset not found");
      if (payload.photos !== undefined) asset.photos = Math.max(0, Number(payload.photos)); if (payload.altText !== undefined) asset.altText = Boolean(payload.altText); if (payload.copyStatus) asset.copyStatus = payload.copyStatus; if (payload.channelStatus) asset.channelStatus = payload.channelStatus;
      audit("UPDATE", "CONTENT_ASSET", asset.id, `Content status updated for ${asset.sku}`); persist(); return json(res, 200, asset);
    }
    return json(res, 404, { error: "Not found" });
  }
  if (req.method === "GET" && staticFile(req, res)) return;
  if (!url.pathname.startsWith("/api/")) return staticFile(req, res) || json(res, 404, { error: "Not found" });
  return json(res, 405, { error: "Method not allowed" });
});

server.listen(port, () => console.log(`SLNS Silk Operations Platform running at http://localhost:${port}`));
