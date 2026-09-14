import http from "node:http";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { loadRelationalStore, openDatabase, persistRelationalStore } from "./db.js";
import { balancedJournal, trialBalance, validateJournal } from "./services/ledger.js";
import { requiredApprover, transition } from "./services/workflow.js";
import { callProvider, providerStatus } from "./services/providers.js";
import { openPostgresStore } from "./services/postgres-store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "public");
const dataDir = join(__dirname, "data");
const storePath = join(dataDir, "store.json");
const dbPath = process.env.DATABASE_PATH ? resolve(process.env.DATABASE_PATH) : join(dataDir, "slns.sqlite");
const port = Number(process.env.PORT || 3000);
const db = openDatabase(dbPath);
let postgresStore = null;
if (process.env.DATABASE_URL) {
  try { postgresStore = await openPostgresStore(process.env.DATABASE_URL); } catch (error) { console.error(`PostgreSQL connection failed: ${error.message}`); process.exit(1); }
}
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;
const passwordSalt = "slns-local-demo-salt";
const hashPassword = (password) => scryptSync(password, passwordSalt, 32).toString("hex");
const verifyPassword = (password, hash) => { try { return timingSafeEqual(Buffer.from(hashPassword(password), "hex"), Buffer.from(hash, "hex")); } catch { return false; } };
const demoPasswordFor = { priya: "slns-demo-owner", arjun: "slns-demo-finance", ravi: "slns-demo-warehouse" };

function seedStore() {
  return {
    organisation: { name: "SLNS Silk House", legalEntity: "SLNS Silk House Private Limited", gstin: "29AABCS1234F1ZP", currency: "INR", branches: ["Bengaluru HQ", "Kanchipuram Workshop"] },
    users: [
      { id: "USR-OWNER", name: "Priya N.", username: "priya", passwordHash: hashPassword("slns-demo-owner"), role: "Owner / Board", permissions: ["*"], active: true },
      { id: "USR-FINANCE", name: "Arjun Rao", username: "arjun", passwordHash: hashPassword("slns-demo-finance"), role: "CFO / Finance Head", permissions: ["read", "finance:write", "approve:write"], active: true },
      { id: "USR-WAREHOUSE", name: "Ravi K.", username: "ravi", passwordHash: hashPassword("slns-demo-warehouse"), role: "Warehouse", permissions: ["read", "inventory:write", "production:write"], active: true }
    ],
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
    ],
    approvalRules: [
      { id: "RULE-PO-1", transaction: "Purchase Order", condition: "₹0 - ₹50,000", approver: "Purchase Manager", status: "Active" },
      { id: "RULE-PO-2", transaction: "Purchase Order", condition: "₹50,001 - ₹2,00,000", approver: "Procurement Head", status: "Active" },
      { id: "RULE-DISCOUNT", transaction: "Sales discount", condition: "> 10%", approver: "Sales Head", status: "Active" },
      { id: "RULE-CREDIT", transaction: "B2B credit exposure", condition: "> available credit", approver: "CFO", status: "Active" }
    ],
    requisitions: [{ id: "PR-2026-012", department: "Production", materials: [{ sku: "RM-SILK-RAW", qty: 30, unit: "kg" }], requiredDate: "2026-09-25", purpose: "Diwali replenishment", costCentre: "KAN-WORKSHOP", priority: "High", status: "Approval pending" }],
    rfqs: [{ id: "RFQ-2026-006", requisitionId: "PR-2026-012", vendors: ["VEN-001", "VEN-002", "VEN-003"], status: "Quotations received" }],
    quotations: [{ id: "QUO-2026-101", rfqId: "RFQ-2026-006", vendor: "Mysore Silk Co-op", price: 126000, gst: 6300, freight: 1800, deliveryDays: 12, creditDays: 30, qualityScore: 94, status: "Recommended" }],
    grns: [{ id: "GRN-2026-0092", poId: "PO-2026-0088", orderedQty: 30, receivedQty: 20, acceptedQty: 20, rejectedQty: 0, batch: "SILK-SEP-26-A", warehouse: "Bengaluru HQ", qcStatus: "Accepted", status: "Partial receipt" }],
    vendorBills: [{ id: "VB-2026-0031", vendor: "Mysore Silk Co-op", poId: "PO-2026-0088", invoiceNumber: "MSC-8841", invoiceDate: "2026-09-14", amount: 128100, gst: 6100, threeWayStatus: "Price variance", duplicate: false, status: "Exception" }],
    boms: [{ id: "BOM-SL-KAN-001-V2", sku: "SL-KAN-001", version: 2, status: "Active", components: [{ name: "Mulberry silk yarn", qty: 1.8, unit: "kg" }, { name: "Pure zari", qty: 0.28, unit: "kg" }, { name: "Weaving + finishing", qty: 1, unit: "service" }], standardCost: 17600 }],
    jobWorks: [{ id: "JW-2026-0018", productionId: "PO-2026-0018", worker: "Kanchipuram Weavers Guild", materialSent: 6, materialReturned: 5.6, expectedReturn: "2026-09-17", actualReturn: null, finishedQty: 0, wastage: 0.4, rate: 3200, payable: 0, status: "In progress" }],
    wip: [{ id: "WIP-2026-0018", productionId: "PO-2026-0018", product: "Kanchipuram Ruby Zari", stage: "Zari finishing", qty: 4, location: "Kanchipuram Workshop / W1", responsible: "Kanchipuram Weavers Guild", startedAt: "2026-09-01", expectedCompletion: "2026-09-17", ageDays: 13, costAccumulated: 73600 }],
    priceLists: [{ id: "PL-RETAIL", name: "Retail", rules: "MRP less promotion" }, { id: "PL-WHOLESALE", name: "Wholesale", rules: "15% below retail" }, { id: "PL-DEALER", name: "Dealer", rules: "Negotiated by customer" }],
    priceHistory: [{ sku: "SL-KAN-001", channel: "Wholesale", price: 24565, effectiveFrom: "2026-09-01", approvedBy: "Sales Head" }],
    creditPolicies: [{ customerType: "B2B dealer", creditDays: 30, warningAt: 80, actionAt: 100, action: "Approval required" }, { customerType: "Retail", creditDays: 0, warningAt: 0, actionAt: 0, action: "Prepaid" }],
    bankTransactions: [{ id: "BANK-001", account: "HDFC Current · 4421", date: "2026-09-14", narration: "UPI/Ananya Iyer/16900", amount: 16900, direction: "Credit", match: "RCT-2026-0118", status: "Matched" }, { id: "BANK-002", account: "HDFC Current · 4421", date: "2026-09-14", narration: "NEFT/Mysore Silk Co-op", amount: 50000, direction: "Debit", match: null, status: "Unmatched" }],
    notifications: [{ id: "NTF-001", channel: "In-app", event: "RTO threshold breached", recipient: "Sales Head", status: "Unread" }, { id: "NTF-002", channel: "WhatsApp", event: "Dispatch confirmation", recipient: "Kaveri Collective", status: "Queued" }],
    documents: [{ id: "DOC-001", type: "QC report", reference: "QC-2026-0042", filename: "qc-banarasi-0017.pdf", storage: "object://slns-demo/qc-banarasi-0017.pdf", status: "Available" }],
    rtoNdr: [{ id: "NDR-0041", orderId: "SO-2026-0040", channel: "Online · COD", pincode: "400001", reason: "Customer unavailable", attempt: 1, action: "Buyer confirmation pending", status: "Open" }],
    returns: [{ id: "RET-2026-0002", orderId: "SO-2026-0039", productId: "SKU-BANARAS-014", qty: 1, reason: "Colour preference", status: "QC pending", creditNoteId: null, createdAt: "2026-09-14T06:00:00.000Z" }],
    outbox: [{ id: "OUT-001", event: "invoice.created", reference: "INV-2026-0041", destination: "GST provider", attempts: 0, status: "Pending adapter" }],
    integrationFailures: [{ id: "IF-001", provider: "Courier sandbox", event: "shipment.tracking", reference: "PKG-2026-0040", attempts: 2, nextRetry: "2026-09-14T07:00:00.000Z", status: "Retry queued" }],
    prdAcceptance: [
      { id: "AC-01", area: "Master data + organisation", criterion: "Every active finished saree and party has a canonical record", status: "Ready" },
      { id: "AC-02", area: "Procure-to-pay", criterion: "PO → GRN → QC → three-way match → vendor payment", status: "In progress" },
      { id: "AC-03", area: "Manufacture-to-stock", criterion: "Material issue and WIP can be traced to finished goods", status: "In progress" },
      { id: "AC-04", area: "Order-to-cash", criterion: "Order → invoice → dispatch → receipt → settlement", status: "In progress" },
      { id: "AC-05", area: "Controls", criterion: "RBAC, approval, audit and no silent balance changes", status: "Ready" },
      { id: "AC-06", area: "Operations", criterion: "Backup restore, load test and security review completed", status: "Required before go-live" }
    ]
  };
}

function loadStore() {
  const defaults = seedStore();
  return loadRelationalStore(db, defaults, storePath);
}
let store = loadStore();
if (postgresStore) { const remoteStore = await postgresStore.read(); if (remoteStore) store = { ...store, ...remoteStore }; }
const sessions = new Map();
store.products = (store.products || []).map((product) => ({ ...product, designCode: product.designCode || product.sku, border: product.border || "Handwoven contrast", pallu: product.pallu || "Woven pallu", blouseDetails: product.blouseDetails || "Unstitched blouse piece", mrp: product.mrp || product.price, retailPrice: product.retailPrice || product.price, wholesalePrice: product.wholesalePrice || Math.round(product.price * 0.85), barcode: product.barcode || `890${product.sku.replace(/\D/g, "").slice(-9).padStart(9, "0")}`, qr: product.qr || `QR-${product.sku}`, photos: product.photos || [], active: product.active !== false }));
store.users = (store.users || []).map((user) => ({ ...user, active: user.active !== false, passwordHash: user.passwordHash || hashPassword(demoPasswordFor[user.username] || randomUUID()) }));
for (const domain of ["uploadedDocuments", "paymentIntents", "refunds", "workflowHistory", "integrationEvents", "idempotencyKeys", "customerAccounts"]) store[domain] ||= [];
const loginAttempts = new Map();
const storefrontRequests = new Map();
let persistQueue = Promise.resolve();
function persist() { mkdirSync(dataDir, { recursive: true }); persistRelationalStore(db, store); if (postgresStore) persistQueue = persistQueue.then(() => postgresStore.write(store)).catch((error) => console.error(`PostgreSQL persistence failed: ${error.message}`)); }
if (!db.prepare("SELECT 1 FROM meta WHERE key = 'snapshot'").get()) persist();
const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" }); res.end(JSON.stringify(body)); };
const bad = (res, message) => json(res, 400, { error: message });
const available = (product) => product.onHand - product.reserved;
function currentUser(req) { const header = req.headers.authorization || ""; const token = header.startsWith("Bearer ") ? header.slice(7) : ""; const session = sessions.get(token); if (session && session.expiresAt < Date.now()) { sessions.delete(token); return null; } const user = session && store.users.find((candidate) => candidate.id === session.id && candidate.active !== false); return user ? { ...session, ...user } : null; }
function requireAuth(req, res) { const user = currentUser(req); if (!user) { json(res, 401, { error: "Authentication required" }); return null; } return user; }
function can(user, permission) { return Boolean(user && (user.permissions?.includes("*") || user.permissions?.includes(permission))); }
function requirePermission(req, res, permission) { const user = requireAuth(req, res); if (!user) return null; if (!can(user, permission)) { json(res, 403, { error: `Role ${user.role} cannot perform ${permission}` }); return null; } return user; }
function logEvent(type, title, detail, user = "Demo User") { store.events.unshift({ id: id("EVT"), type, title, detail, user, occurredAt: now() }); store.events = store.events.slice(0, 20); }
function audit(action, entity, entityId, detail, user = "Demo User") { store.audit.unshift({ id: id("AUD"), action, entity, entityId, detail, user, occurredAt: now() }); }
function postJournal(reference, description, debit, credit, amount, user = "System") { const entry = balancedJournal({ id: id("JE").toUpperCase(), reference, description, debit, credit, amount, user, occurredAt: now() }); if (!validateJournal(entry)) throw new Error("Unbalanced journal rejected"); store.journalEntries.unshift(entry); return entry; }
function enqueue(event, reference, destination, payload = {}) { const item = { id: id("OUT").toUpperCase(), event, reference, destination, payload, attempts: 0, status: "Queued", createdAt: now(), nextAttemptAt: now() }; store.outbox.unshift(item); return item; }
function idempotent(key) { return key && store.idempotencyKeys.find((entry) => entry.key === key); }
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
function prd() {
  return { version: "1.0", status: "Implementation PRD", architecture: { layers: ["Web / PWA / POS", "API layer", "Modular business backend", "Relational transactional store", "Cache / object storage / search", "Background jobs / event outbox / monitoring / backups"] }, acceptance: store.prdAcceptance, procurement: { requisitions: store.requisitions, rfqs: store.rfqs, quotations: store.quotations, grns: store.grns, vendorBills: store.vendorBills }, manufacturing: { boms: store.boms, jobWorks: store.jobWorks, wip: store.wip }, commercial: { priceLists: store.priceLists, priceHistory: store.priceHistory, creditPolicies: store.creditPolicies }, banking: { bankTransactions: store.bankTransactions }, experience: { notifications: store.notifications, documents: store.documents, rtoNdr: store.rtoNdr }, outOfScope: ["AI assistants", "Demand prediction", "Microservice decomposition", "Custom banking infrastructure", "Custom GST gateway", "Blockchain"] };
}
async function body(req) { let text = ""; for await (const chunk of req) { text += chunk; if (text.length > 12 * 1024 * 1024) return null; } if (!text) return {}; try { return JSON.parse(text); } catch { return null; } }
function staticFile(req, res) {
  const rawPath = new URL(req.url, "http://localhost").pathname;
  const requested = rawPath === "/" || rawPath === "/shop" || rawPath === "/shop/" ? "/storefront.html" : rawPath === "/operations" || rawPath === "/operations/" ? "/index.html" : rawPath;
  const file = join(publicDir, requested.replace(/^\//, ""));
  if (!file.startsWith(publicDir) || !existsSync(file)) return false;
  const contentTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
  res.writeHead(200, { "Content-Type": `${contentTypes[extname(file)] || "application/octet-stream"}; charset=utf-8`, "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:" }); res.end(readFileSync(file)); return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/auth/me") { const user = currentUser(req); return user ? json(res, 200, { user }) : json(res, 401, { error: "Authentication required" }); }
    if (url.pathname === "/api/health") return json(res, 200, { ok: true, service: "slns-platform", version: "0.1.0", database: postgresStore ? "postgresql" : "sqlite", time: now() });
    if (url.pathname === "/api/storefront/products") return json(res, 200, store.products.filter((p) => p.category !== "Raw material" && available(p) > 0).map((p) => ({ id: p.id, sku: p.sku, name: p.name, collection: p.collection, price: p.price, available: available(p), qr: p.qr || `QR-${p.sku}` })));
    if (url.pathname === "/api/storefront/order-status") {
      const order = store.orders.find((candidate) => candidate.id === url.searchParams.get("orderId")); const customer = order && store.customers.find((candidate) => candidate.id === order.customerId);
      if (!order || !customer || !url.searchParams.get("email") || customer.email !== url.searchParams.get("email")) return json(res, 404, { error: "Order not found" });
      return json(res, 200, { orderId: order.id, status: order.status, product: order.product, qty: order.qty, value: order.value, createdAt: order.createdAt, tracking: store.shipments.find((shipment) => shipment.orderId === order.id)?.tracking || null });
    }
    if (!requireAuth(req, res)) return;
    if (url.pathname === "/api/summary") return json(res, 200, summary());
    if (url.pathname === "/api/blueprint") return json(res, 200, blueprint());
    if (url.pathname === "/api/enhancements") return json(res, 200, enhancements());
    if (url.pathname === "/api/prd") return json(res, 200, prd());
    if (url.pathname === "/api/masters") return json(res, 200, { organisation: store.organisation, products: store.products, customers: store.customers, vendors: store.vendors, locations: store.locations, roles: store.roles, integrations: store.integrations, migration: store.migration });
    if (url.pathname === "/api/users") return json(res, 200, store.users.map(({ passwordHash, ...user }) => user));
    if (url.pathname === "/api/products") return json(res, 200, store.products.map((p) => ({ ...p, available: available(p) })));
    if (url.pathname === "/api/costing") return json(res, 200, store.products.filter((p) => p.category !== "Raw material").map((p) => { const components = [{ name: "Silk / yarn", value: Math.round(p.trueCost * 0.34) }, { name: "Zari", value: Math.round(p.trueCost * 0.13) }, { name: "Dyeing + weaving", value: Math.round(p.trueCost * 0.28) }, { name: "Job work + finishing", value: Math.round(p.trueCost * 0.17) }, { name: "Packaging + freight + overhead", value: Math.round(p.trueCost * 0.08) }]; return { sku: p.sku, name: p.name, trueCost: p.trueCost, price: p.price, contributionMargin: p.price - p.trueCost - Math.round(p.price * 0.05), components }; }));
    if (url.pathname === "/api/orders") return json(res, 200, store.orders);
    if (url.pathname === "/api/stock-movements") return json(res, 200, store.stockMovements.slice(0, 50));
    if (url.pathname === "/api/quality") return json(res, 200, store.qualityInspections);
    if (url.pathname === "/api/production") return json(res, 200, store.production);
    if (url.pathname === "/api/procurement") return json(res, 200, { purchaseOrders: store.purchaseOrders, vendors: store.vendors, workflows: store.workflows.filter((w) => /Payment|Procurement/i.test(w.type)) });
    if (url.pathname === "/api/procurement-full") return json(res, 200, { requisitions: store.requisitions, rfqs: store.rfqs, quotations: store.quotations, grns: store.grns, vendorBills: store.vendorBills, approvalRules: store.approvalRules });
    if (url.pathname === "/api/manufacturing") return json(res, 200, { production: store.production, boms: store.boms, materialIssues: store.stockMovements.filter((m) => m.type === "ISSUE"), jobWorks: store.jobWorks, wip: store.wip, quality: store.qualityInspections });
    if (url.pathname === "/api/pricing") return json(res, 200, { priceLists: store.priceLists, priceHistory: store.priceHistory, creditPolicies: store.creditPolicies });
    if (url.pathname === "/api/banking") return json(res, 200, { accounts: ["HDFC Current · 4421", "ICICI Collections · 1180"], transactions: store.bankTransactions, unmatched: store.bankTransactions.filter((t) => t.status === "Unmatched") });
    if (url.pathname === "/api/notifications") return json(res, 200, store.notifications);
    if (url.pathname === "/api/documents") return json(res, 200, store.documents);
    if (url.pathname === "/api/integrations") return json(res, 200, { providers: store.integrations, configuredProviders: providerStatus(), outbox: store.outbox, failures: store.integrationFailures });
    if (url.pathname === "/api/payment-intents") return json(res, 200, store.paymentIntents);
    if (url.pathname === "/api/refunds") return json(res, 200, store.refunds);
    if (url.pathname === "/api/workflow-history") return json(res, 200, store.workflowHistory.slice(0, 100));
    if (url.pathname === "/api/uploads") return json(res, 200, store.uploadedDocuments.map(({ storage, ...document }) => document));
    if (url.pathname === "/api/migrations") return json(res, 200, store.migration);
    if (url.pathname === "/api/search") { const q = (url.searchParams.get("q") || "").trim().toLowerCase(); if (!q) return json(res, 200, []); const sources = [["Product", store.products], ["Customer", store.customers], ["Vendor", store.vendors], ["Order", store.orders], ["Invoice", store.invoices], ["Shipment", store.shipments], ["Production", store.production], ["Payment", store.payments]]; const results = sources.flatMap(([type, rows]) => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 10).map((row) => ({ type, id: row.id, label: row.name || row.product || row.customer || row.vendor || row.description || row.orderId || row.invoiceId || row.type, data: row }))); return json(res, 200, results.slice(0, 50)); }
    if (url.pathname === "/api/logistics") return json(res, 200, { invoices: store.invoices, shipments: store.shipments, receipts: store.receipts });
    if (url.pathname === "/api/returns") return json(res, 200, store.returns);
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
    if (url.pathname === "/api/ledger/trial-balance") return json(res, 200, { balanced: store.journalEntries.every(validateJournal), accounts: trialBalance(store.journalEntries) });
    if (url.pathname === "/api/reports") { const revenue = store.invoices.reduce((sum, i) => sum + i.total, 0); const cogs = store.orders.reduce((sum, o) => { const p = store.products.find((x) => x.id === o.productId); return sum + (p?.trueCost || 0) * o.qty; }, 0); const gstInput = store.gstLedger.filter((g) => g.direction === "Input").reduce((sum, g) => sum + g.tax, 0); const gstOutput = store.gstLedger.filter((g) => g.direction === "Output").reduce((sum, g) => sum + g.tax, 0); return json(res, 200, { profitAndLoss: { revenue, cogs, grossProfit: revenue - cogs, operatingExpenses: 42000, netProfit: revenue - cogs - 42000 }, balanceSheet: { inventory: summary().inventoryValue, receivables: summary().receivables, payables: summary().payables, cash: summary().cash }, cashFlow: { operatingInflow: store.receipts.reduce((sum, r) => sum + r.amount, 0), vendorOutflow: store.payments.reduce((sum, p) => sum + p.amount, 0), closingCash: summary().cash }, gst: { input: gstInput, output: gstOutput, payable: Math.max(0, gstOutput - gstInput) } }); }
    if (url.pathname === "/api/ops") return json(res, 200, { targets: store.nfr, security: { tls: "Required at deployment", encryptionAtRest: "Managed database/storage responsibility", mfa: "Required for finance/admin", secrets: "Use managed secret store", environments: "Separate dev / staging / production", logging: "Centralised logs + error tracking", restoreDrill: "Quarterly" }, backup: { strategy: "Daily full + continuous WAL", rpo: store.nfr?.rpo, rto: store.nfr?.rto, lastBackupAt: store.lastBackupAt || null } });
    if (url.pathname === "/api/workflows") return json(res, 200, store.workflows);
    if (url.pathname === "/api/audit") return json(res, 200, store.audit.slice(0, 50));
    return json(res, 404, { error: "Not found" });
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/")) {
    const payload = await body(req); if (payload === null) return bad(res, "Request body must be valid JSON");
    if (url.pathname === "/api/auth/login") {
      const attempt = loginAttempts.get(payload.username) || { count: 0, blockedUntil: 0 }; if (attempt.blockedUntil > Date.now()) return json(res, 429, { error: "Too many attempts; try again later" });
      const username = String(payload.username || "").trim().toLowerCase();
      const user = store.users.find((candidate) => candidate.username === username && candidate.active !== false && verifyPassword(payload.password || "", candidate.passwordHash));
      if (!user) { attempt.count += 1; if (attempt.count >= 5) attempt.blockedUntil = Date.now() + 15 * 60 * 1000; loginAttempts.set(payload.username, attempt); return json(res, 401, { error: "Invalid username or password" }); }
      loginAttempts.delete(username); const token = randomUUID(); const sessionHours = Number(process.env.SESSION_TTL_HOURS || 8); sessions.set(token, { ...user, expiresAt: Date.now() + sessionHours * 60 * 60 * 1000 }); return json(res, 200, { token, user });
    }
    if (url.pathname === "/api/auth/logout") { const header = req.headers.authorization || ""; const token = header.startsWith("Bearer ") ? header.slice(7) : ""; sessions.delete(token); return json(res, 200, { ok: true }); }
    if (url.pathname === "/api/storefront/orders") {
      const client = req.socket.remoteAddress || "unknown"; const recent = storefrontRequests.get(client) || []; const fresh = recent.filter((timestamp) => Date.now() - timestamp < 60 * 60 * 1000); if (fresh.length >= 30) return json(res, 429, { error: "Storefront rate limit exceeded" }); storefrontRequests.set(client, [...fresh, Date.now()]);
      const product = store.products.find((candidate) => candidate.id === payload.productId); const qty = Number(payload.qty); const customerName = String(payload.customerName || "").trim(); if (!product || !customerName || !Number.isFinite(qty) || qty <= 0 || available(product) < qty) return bad(res, "Choose an available product, customer name and valid quantity");
      let customer = store.customers.find((candidate) => candidate.email && candidate.email === payload.email); if (!customer) { customer = { id: id("CUS").toUpperCase(), name: customerName, type: "Online", city: payload.city || "India", email: payload.email || null, creditLimit: 0, outstanding: 0, marketingConsent: Boolean(payload.marketingConsent) }; store.customers.push(customer); }
      product.reserved += qty; const orderId = `WEB-${new Date().getFullYear()}-${String(store.orders.length + 1).padStart(4, "0")}`; const paymentMode = payload.paymentMode || "Prepaid"; const order = { id: orderId, customerId: customer.id, customer: customer.name, channel: "Website", productId: product.id, product: product.name, qty, value: product.price * qty, status: paymentMode === "Prepaid" ? "Payment pending" : "Reserved", paymentMode, createdAt: now() }; store.orders.unshift(order); const transactionId = id("RES").toUpperCase(); store.stockMovements.unshift({ id: id("MOV").toUpperCase(), transactionId, type: "RESERVATION", productId: product.id, product: product.name, qty, unit: product.unit, user: "Storefront", occurredAt: now(), note: `Website order ${orderId}` }); enqueue("order.created", orderId, "Internal notifications", { orderId, customer: customer.name, value: order.value }); logEvent("SALE", "Website order received", `${orderId} · ${customer.name}`); audit("CREATE", "WEB_ORDER", orderId, `Reserved ${qty} ${product.sku}`); persist(); return json(res, 201, { orderId, transactionId, status: order.status, amount: order.value, paymentMode });
    }
    if (url.pathname === "/api/storefront/payment-intent") {
      const order = store.orders.find((candidate) => candidate.id === payload.orderId); const amount = Number(payload.amount || order?.value);
      const customer = order && store.customers.find((candidate) => candidate.id === order.customerId); if (!order || !customer || !payload.email || customer.email !== payload.email || !Number.isFinite(amount) || amount <= 0) return bad(res, "Choose an order, matching customer email and a positive amount");
      const existing = idempotent(payload.idempotencyKey); if (existing) return json(res, 200, existing.response);
      let provider; try { provider = await callProvider("payment", { orderId: order.id, amount, currency: "INR", customer: order.customer }); } catch (error) { return json(res, 502, { error: error.message }); }
      const intent = { id: id("PI").toUpperCase(), orderId: order.id, amount, provider: provider.mode, status: provider.mode === "sandbox" ? "Requires confirmation" : "Created", providerReference: provider.reference || provider.data?.id || null, createdAt: now() };
      store.paymentIntents.unshift(intent); const outbox = enqueue("payment.intent.created", intent.id, "Payment provider", { orderId: order.id, amount }); if (payload.idempotencyKey) store.idempotencyKeys.unshift({ key: payload.idempotencyKey, response: { paymentIntent: intent, outboxId: outbox.id }, createdAt: now() }); audit("CREATE", "PAYMENT_INTENT", intent.id, `Created ${amount} INR for ${order.id}`); persist(); return json(res, 201, { paymentIntent: intent, outboxId: outbox.id });
    }
    const permission = url.pathname.includes("/actions/approve") ? "approve:write" : url.pathname.includes("/actions/migration") || url.pathname.includes("/actions/user-") ? "admin:write" : url.pathname.includes("/actions/receipt") || url.pathname.includes("/actions/vendor-payment") || url.pathname.includes("/actions/weaver-advance") || url.pathname.includes("/actions/bank-reconcile") || url.pathname.includes("/actions/three-way-match") || url.pathname.includes("/actions/gst-submit") || url.pathname.includes("/actions/bank-sync") ? "finance:write" : url.pathname.includes("/actions/order") || url.pathname.includes("/actions/invoice") || url.pathname.includes("/actions/dispatch") || url.pathname.includes("/actions/return") || url.pathname.includes("/actions/refund") || url.pathname.includes("/actions/shipment-sync") || url.pathname.includes("/actions/notify") ? "sales:write" : "inventory:write";
    const user = requirePermission(req, res, permission); if (!user) return;
    payload.user ||= user.name;
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
      postJournal(invoiceId, `Sales invoice · ${order.customer}`, "Accounts receivable", "Sales revenue", order.value, payload.user);
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
      postJournal(receiptId, `Customer receipt · ${invoice.customer}`, `Bank - ${receipt.mode}`, "Accounts receivable", amount, payload.user);
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
      const returnId = id("RET").toUpperCase(); const transactionId = id("RET").toUpperCase(); const returnRequest = { id: returnId, orderId: order.id, productId: product.id, qty, reason: payload.reason || "Customer return", status: "QC pending", creditNoteId: null, createdAt: now() };
      store.returns.unshift(returnRequest); product.returned = (product.returned || 0) + qty; order.status = "Return inspection";
      store.stockMovements.unshift({ id: id("MOV").toUpperCase(), transactionId, type: "RETURN_RECEIVED", productId: product.id, product: product.name, qty: 0, unit: product.unit, user: payload.user || "Demo User", occurredAt: now(), note: `${returnId} awaiting QC` });
      logEvent("SALE", "Return received for inspection", `${returnId} · ${order.id}`); audit("POST", "RETURN_REQUEST", returnId, `Received ${qty} ${product.sku}; not sellable until QC`); persist(); return json(res, 201, { returnId, transactionId, status: returnRequest.status });
    }
    if (url.pathname === "/api/actions/return-qc") {
      const request = store.returns.find((candidate) => candidate.id === payload.returnId); const product = request && store.products.find((p) => p.id === request.productId);
      if (!request || !product || !["Accepted", "Rejected"].includes(payload.status)) return bad(res, "Choose a return and Accepted or Rejected");
      product.returned = Math.max(0, (product.returned || 0) - request.qty); request.status = payload.status === "Accepted" ? "Accepted - restocked" : "Rejected - damaged"; if (payload.status === "Accepted") product.onHand += request.qty;
      const creditNoteId = `CN-${new Date().getFullYear()}-${String(store.invoices.length + 1).padStart(4, "0")}`; request.creditNoteId = creditNoteId; store.gstLedger.unshift({ id: id("GST").toUpperCase(), reference: creditNoteId, direction: "Adjustment", hsn: "5007", rate: 5, taxableValue: Math.round((product.price * request.qty) / 1.05), tax: Math.round((product.price * request.qty) - (product.price * request.qty) / 1.05), status: "Ready for return" });
      logEvent("QC", `Return ${payload.status.toLowerCase()}`, `${request.id} · ${product.name}`); audit("APPROVE", "RETURN_QC", request.id, `${request.status}; ${creditNoteId}`); persist(); return json(res, 200, request);
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
      ledger.advance += amount; const paymentId = id("ADV").toUpperCase(); store.payments.unshift({ id: paymentId, vendor: ledger.weaver, amount, type: "Weaver advance", status: "Posted", paidAt: now() }); postJournal(paymentId, `Weaver advance · ${ledger.weaver}`, "Weaver advances", "Bank / cash", amount, payload.user); logEvent("PROCUREMENT", "Weaver advance posted", `${ledger.weaver} · ${amount}`); audit("POST", "WEAVER_ADVANCE", paymentId, `Advance posted for ${ledger.id}`); persist(); return json(res, 201, { paymentId, ledger });
    }
    if (url.pathname === "/api/actions/content") {
      const asset = store.contentAssets.find((a) => a.id === payload.assetId); if (!asset) return bad(res, "Content asset not found");
      if (payload.photos !== undefined) asset.photos = Math.max(0, Number(payload.photos)); if (payload.altText !== undefined) asset.altText = Boolean(payload.altText); if (payload.copyStatus) asset.copyStatus = payload.copyStatus; if (payload.channelStatus) asset.channelStatus = payload.channelStatus;
      audit("UPDATE", "CONTENT_ASSET", asset.id, `Content status updated for ${asset.sku}`); persist(); return json(res, 200, asset);
    }
    if (url.pathname === "/api/actions/vendor-payment") {
      const po = store.purchaseOrders.find((candidate) => candidate.id === payload.purchaseOrderId); const amount = Number(payload.amount);
      if (!po || !Number.isFinite(amount) || amount <= 0 || amount > po.value) return bad(res, "Choose a purchase order and a valid payment amount");
      const paymentId = id("PAY").toUpperCase(); po.status = amount >= po.value ? "Paid" : "Part paid"; store.payments.unshift({ id: paymentId, purchaseOrderId: po.id, vendor: po.vendor, amount, type: "Vendor payment", status: "Approved", paidAt: now() }); postJournal(paymentId, `Vendor payment · ${po.vendor}`, "Accounts payable", "Bank / cash", amount, payload.user); logEvent("FINANCE", "Vendor payment posted", `${paymentId} · ${po.vendor} · ${amount}`); audit("POST", "VENDOR_PAYMENT", paymentId, `Settled ${po.id}`); persist(); return json(res, 201, { paymentId, status: po.status });
    }
    if (url.pathname === "/api/actions/three-way-match") {
      const bill = store.vendorBills.find((candidate) => candidate.id === payload.vendorBillId); if (!bill) return bad(res, "Vendor bill not found");
      bill.threeWayStatus = payload.status || (bill.amount > (store.purchaseOrders.find((p) => p.id === bill.poId)?.value || 0) ? "Price variance" : "Matched"); bill.status = bill.threeWayStatus === "Matched" ? "Approved for payment" : "Exception review"; const workflow = store.workflows.find((w) => w.type === "Payment approval"); if (workflow) workflow.status = bill.status === "Approved for payment" ? "Approved" : "Pending"; logEvent("PROCUREMENT", "Three-way match reviewed", `${bill.id} · ${bill.threeWayStatus}`); audit("REVIEW", "THREE_WAY_MATCH", bill.id, `PO / GRN / invoice status ${bill.threeWayStatus}`); persist(); return json(res, 200, bill);
    }
    if (url.pathname === "/api/actions/bank-reconcile") {
      const transaction = store.bankTransactions.find((candidate) => candidate.id === payload.bankTransactionId); if (!transaction) return bad(res, "Bank transaction not found");
      transaction.match = payload.reference || transaction.match; transaction.status = "Matched"; audit("MATCH", "BANK_TRANSACTION", transaction.id, `Matched to ${transaction.match || "manual reconciliation"}`); logEvent("FINANCE", "Bank transaction reconciled", `${transaction.id} · ${transaction.match || "manual match"}`); persist(); return json(res, 200, transaction);
    }
    if (url.pathname === "/api/actions/workflow-transition") {
      const domains = ["requisitions", "purchaseOrders", "vendorBills", "orders", "returns", "production"]; const entity = domains.flatMap((domain) => (store[domain] || []).map((row) => ({ domain, row }))).find(({ row }) => row.id === payload.entityId);
      if (!entity || !payload.workflowType || !payload.nextStatus) return bad(res, "Choose an entity, workflow type and next status");
      const from = entity.row.status; try { transition(payload.workflowType, from, payload.nextStatus); } catch (error) { return bad(res, error.message); }
      entity.row.status = payload.nextStatus; const approval = requiredApprover(store.approvalRules, payload.workflowType, Number(entity.row.value || entity.row.amount || 0), { entityId: entity.row.id }); const history = { id: id("WFH").toUpperCase(), entityId: entity.row.id, domain: entity.domain, type: payload.workflowType, from, to: payload.nextStatus, approver: approval?.approver || null, user: payload.user, occurredAt: now() }; store.workflowHistory.unshift(history); enqueue("workflow.transitioned", entity.row.id, "Internal notifications", history); audit("TRANSITION", payload.workflowType, entity.row.id, `${history.from} → ${history.to}`); persist(); return json(res, 200, { entity: entity.row, history, approval });
    }
    if (url.pathname === "/api/actions/document-upload") {
      const filename = String(payload.filename || "").replace(/[^a-zA-Z0-9._-]/g, "-"); const content = String(payload.contentBase64 || ""); const allowed = ["application/pdf", "image/jpeg", "image/png", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
      if (!filename || !content || !allowed.includes(payload.mimeType)) return bad(res, "Filename, supported MIME type and base64 content are required");
      let buffer; try { buffer = Buffer.from(content, "base64"); } catch { return bad(res, "Document content must be valid base64"); }
      if (!buffer.length || buffer.length > 8 * 1024 * 1024) return bad(res, "Document must be between 1 byte and 8 MB");
      const documentId = id("DOC").toUpperCase(); const documentDir = join(dataDir, "documents"); mkdirSync(documentDir, { recursive: true }); const storageKey = `${documentId}-${filename}`; writeFileSync(join(documentDir, storageKey), buffer); let storage = `local://${storageKey}`; let storageMode = "local";
      if (process.env.OBJECT_STORAGE_URL) { try { const remote = await callProvider("storage", { documentId, filename, mimeType: payload.mimeType, contentBase64: content }); storage = remote.data?.url || `object://${storageKey}`; storageMode = "configured"; } catch (error) { return json(res, 502, { error: `Object storage upload failed: ${error.message}` }); } }
      const document = { id: documentId, type: payload.type || "Business document", reference: payload.reference || null, filename, mimeType: payload.mimeType, sizeBytes: buffer.length, storage, storageMode, status: "Available", uploadedBy: payload.user, uploadedAt: now() }; store.documents.unshift(document); store.uploadedDocuments.unshift(document); audit("UPLOAD", "DOCUMENT", documentId, `${filename} · ${buffer.length} bytes · ${storageMode}`); persist(); return json(res, 201, document);
    }
    if (["/api/actions/gst-submit", "/api/actions/bank-sync", "/api/actions/shipment-sync", "/api/actions/notify"].includes(url.pathname)) {
      const type = url.pathname.split("/").pop().replace("-sync", "").replace("-submit", ""); const provider = type === "gst" ? "gst" : type === "bank" ? "bank" : type === "shipment" ? "logistics" : "messaging";
      const request = { operation: type, reference: payload.reference || id("REQ").toUpperCase(), payload: payload.data || payload };
      let result; try { result = await callProvider(provider, request); } catch (error) { const failure = { id: id("IF").toUpperCase(), provider, event: request.operation, reference: request.reference, attempts: 1, error: error.message, nextRetry: new Date(Date.now() + 300000).toISOString(), status: "Retry queued" }; store.integrationFailures.unshift(failure); persist(); return json(res, 502, { error: error.message, failure }); }
      const event = { id: id("INT").toUpperCase(), provider, operation: type, reference: request.reference, mode: result.mode, result, createdAt: now() }; store.integrationEvents.unshift(event); if (type === "notify") store.notifications.unshift({ id: event.id, channel: payload.channel || "In-app", event: payload.event || "Notification", recipient: payload.recipient || "Operations", status: "Sent", sentAt: now() }); if (type === "gst") store.gstLedger = store.gstLedger.map((entry) => ({ ...entry, submittedAt: now(), status: "Submitted to adapter" })); audit("DISPATCH", "PROVIDER", event.id, `${provider} ${type} dispatched via ${result.mode}`); persist(); return json(res, 200, event);
    }
    if (url.pathname === "/api/actions/integration-dispatch") {
      const event = store.outbox.find((candidate) => candidate.id === payload.outboxId); if (!event) return bad(res, "Outbox event not found"); const provider = payload.provider || ({ "GST provider": "gst", "Payment provider": "payment", "Courier": "logistics", "Messaging": "messaging" }[event.destination] || "messaging");
      try { const result = await callProvider(provider, event.payload || { reference: event.reference }); event.attempts += 1; event.status = "Delivered"; event.deliveredAt = now(); const delivery = { id: id("INT").toUpperCase(), outboxId: event.id, provider, result, createdAt: now() }; store.integrationEvents.unshift(delivery); audit("DISPATCH", "INTEGRATION_EVENT", event.id, `${provider} adapter delivered`); persist(); return json(res, 200, { event, delivery }); } catch (error) { event.attempts += 1; event.status = "Retry queued"; const failure = { id: id("IF").toUpperCase(), provider, event: event.event, reference: event.reference, attempts: event.attempts, error: error.message, nextRetry: new Date(Date.now() + Math.min(event.attempts * 5, 60) * 60000).toISOString(), status: "Retry queued" }; store.integrationFailures.unshift(failure); persist(); return json(res, 502, { error: error.message, failure }); }
    }
    if (url.pathname === "/api/actions/refund") {
      const order = store.orders.find((candidate) => candidate.id === payload.orderId); const amount = Number(payload.amount || order?.value); if (!order || !Number.isFinite(amount) || amount <= 0 || amount > order.value) return bad(res, "Choose an order and a valid refund amount");
      const refundId = id("REF").toUpperCase(); let provider; try { provider = await callProvider("payment", { operation: "refund", orderId: order.id, amount, currency: "INR" }); } catch (error) { return json(res, 502, { error: error.message }); }
      const refund = { id: refundId, orderId: order.id, amount, reason: payload.reason || "Customer return", provider: provider.mode, status: provider.mode === "sandbox" ? "Queued" : "Submitted", createdAt: now() }; store.refunds.unshift(refund); order.status = "Refund requested"; postJournal(refundId, `Sales refund · ${order.customer}`, "Sales returns and allowances", "Refunds payable", amount, payload.user); enqueue("refund.created", refundId, "Payment provider", refund); audit("CREATE", "REFUND", refundId, `${amount} INR for ${order.id}`); persist(); return json(res, 201, refund);
    }
    if (url.pathname === "/api/actions/customer-consent") {
      const customer = store.customers.find((candidate) => candidate.id === payload.customerId || candidate.email === payload.email); if (!customer) return bad(res, "Customer not found"); customer.marketingConsent = Boolean(payload.marketingConsent); customer.consentUpdatedAt = now(); audit("UPDATE", "CUSTOMER_CONSENT", customer.id, `Marketing consent ${customer.marketingConsent ? "granted" : "withdrawn"}`); persist(); return json(res, 200, { id: customer.id, marketingConsent: customer.marketingConsent, consentUpdatedAt: customer.consentUpdatedAt });
    }
    if (url.pathname === "/api/actions/user-create") {
      const username = String(payload.username || "").trim().toLowerCase(); const password = String(payload.password || ""); const name = String(payload.name || "").trim();
      const validRoles = ["Owner / Board", "CFO / Finance Head", "Warehouse", "Auditor", "Sales", "Production"];
      if (!/^[a-z0-9._-]{3,40}$/.test(username) || !name || password.length < 12 || !validRoles.includes(payload.role)) return bad(res, "Provide a name, valid username, role and password of at least 12 characters");
      if (store.users.some((candidate) => candidate.username === username)) return bad(res, "That username is already in use");
      const permissions = Array.isArray(payload.permissions) ? payload.permissions.filter((permission) => typeof permission === "string").slice(0, 30) : ["read"];
      const created = { id: id("USR").toUpperCase(), name, username, passwordHash: hashPassword(password), role: payload.role, permissions, active: true, createdAt: now() };
      store.users.push(created); audit("CREATE", "USER", created.id, `Created ${created.username} · ${created.role}`); persist(); const { passwordHash, ...safeUser } = created; return json(res, 201, safeUser);
    }
    if (url.pathname === "/api/actions/user-disable") {
      const target = store.users.find((candidate) => candidate.id === payload.userId || candidate.username === payload.username);
      if (!target) return bad(res, "User not found"); if (target.id === user.id) return bad(res, "You cannot disable your own active session");
      target.active = false; target.disabledAt = now(); audit("UPDATE", "USER", target.id, `Disabled ${target.username}`); persist(); return json(res, 200, { id: target.id, username: target.username, active: false });
    }
    if (url.pathname === "/api/actions/migration-import") {
      if (!payload.data || typeof payload.data !== "object") return bad(res, "Migration data object is required");
      const allowed = ["products", "customers", "vendors", "orders", "purchaseOrders", "invoices", "stockMovements", "bankTransactions"];
      const imported = {}; const problems = [];
      for (const [domain, rows] of Object.entries(payload.data)) {
        if (!allowed.includes(domain)) continue; if (!Array.isArray(rows)) { problems.push(`${domain} must be an array`); continue; }
        const ids = rows.map((row) => row.id); if (ids.some((value) => !value) || new Set(ids).size !== ids.length) problems.push(`${domain} contains missing or duplicate ids`); imported[domain] = rows;
      }
      if (problems.length) return bad(res, problems.join("; "));
      for (const [domain, rows] of Object.entries(imported)) { const existing = new Map((store[domain] || []).map((row) => [row.id, row])); for (const row of rows) existing.set(row.id, { ...existing.get(row.id), ...row, importedAt: now() }); store[domain] = [...existing.values()]; }
      store.migration = { ...store.migration, lastImportAt: now(), lastImportBy: payload.user, domains: Object.fromEntries(Object.entries(imported).map(([domain, rows]) => [domain, rows.length])), status: "Imported" }; audit("IMPORT", "MIGRATION", "cutover", `Imported ${Object.values(imported).reduce((sum, rows) => sum + rows.length, 0)} records`); persist(); return json(res, 201, { ok: true, migration: store.migration });
    }
    if (url.pathname === "/api/actions/backup") {
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true }); persist(); const backupDir = join(dataDir, "backups"); mkdirSync(backupDir, { recursive: true }); const backupPath = join(backupDir, `slns-${new Date().toISOString().replaceAll(":", "-")}.sqlite`); copyFileSync(dbPath, backupPath); store.lastBackupAt = now(); persist(); audit("BACKUP", "STORE", "local", "Relational database backup snapshot created"); return json(res, 201, { ok: true, lastBackupAt: store.lastBackupAt, path: backupPath });
    }
    return json(res, 404, { error: "Not found" });
  }
  if (req.method === "GET" && staticFile(req, res)) return;
  if (!url.pathname.startsWith("/api/")) return staticFile(req, res) || json(res, 404, { error: "Not found" });
  return json(res, 405, { error: "Method not allowed" });
});

server.listen(port, () => console.log(`SLNS Silk Operations Platform running at http://localhost:${port}`));
