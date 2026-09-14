const config = {
  gst: "GST_PROVIDER_URL",
  bank: "BANK_FEED_PROVIDER_URL",
  payment: "PAYMENT_PROVIDER_URL",
  logistics: "LOGISTICS_PROVIDER_URL",
  messaging: "MESSAGING_PROVIDER_URL",
  storage: "OBJECT_STORAGE_URL",
};

export function providerStatus() {
  return Object.entries(config).map(([name, env]) => ({ name, env, configured: Boolean(process.env[env]), mode: process.env[env] ? "configured" : "sandbox" }));
}

export async function callProvider(name, payload = {}) {
  const env = config[name];
  if (!env) throw new Error(`Unknown provider ${name}`);
  const endpoint = process.env[env];
  if (!endpoint) return { ok: true, mode: "sandbox", provider: name, accepted: true, payload, reference: `SANDBOX-${Date.now()}` };
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-SLNS-Provider": name }, body: JSON.stringify(payload) });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = { response: text.slice(0, 1000) }; }
  if (!response.ok) throw new Error(`${name} provider returned ${response.status}`);
  return { ok: true, mode: "live", provider: name, data };
}
