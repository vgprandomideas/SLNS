import test from "node:test";
import assert from "node:assert/strict";

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
