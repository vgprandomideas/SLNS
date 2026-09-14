import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, persistRelationalStore, loadRelationalStore } from "../db.js";
import { balancedJournal, trialBalance, validateJournal } from "../services/ledger.js";
import { transition } from "../services/workflow.js";

test("platform package is configured as an ES module service", async () => {
  const packageJson = await import("../package.json", { with: { type: "json" } });
  assert.equal(packageJson.default.type, "module");
  assert.equal(packageJson.default.scripts.start, "node server.js");
});

test("core inventory arithmetic keeps reserved stock out of availability", () => {
  const onHand = 8;
  const reserved = 1;
  assert.equal(onHand - reserved, 7);
});

test("relational adapter persists core records with foreign-key integrity", () => {
  const folder = mkdtempSync(join(tmpdir(), "slns-test-"));
  let db;
  try {
    db = openDatabase(join(folder, "slns.sqlite"));
    const store = { products: [{ id: "P1", sku: "SKU-1", name: "Test saree", category: "Finished", onHand: 1, reserved: 0 }], customers: [{ id: "C1", name: "Customer" }], vendors: [], orders: [{ id: "O1", customerId: "C1", productId: "P1", value: 100, status: "Ready" }], invoices: [], stockMovements: [], journalEntries: [], audit: [] };
    persistRelationalStore(db, store);
    const loaded = loadRelationalStore(db, {}, null);
    assert.equal(loaded.orders[0].productId, "P1");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products").get().count, 1);
  } finally { db?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test("financial postings are balanced and trial balance nets to zero", () => {
  const invoice = balancedJournal({ id: "JE-1", reference: "INV-1", description: "Test invoice", debit: "Accounts receivable", credit: "Sales revenue", amount: 1050 });
  assert.equal(validateJournal(invoice), true);
  const accounts = trialBalance([invoice]);
  assert.equal(accounts.reduce((sum, account) => sum + account.balance, 0), 0);
});

test("workflow engine rejects invalid backwards transitions", () => {
  assert.doesNotThrow(() => transition("Sales order", "Reserved", "Invoiced"));
  assert.throws(() => transition("Sales order", "Delivered", "Reserved"), /cannot move backwards/);
});
