const grid = document.querySelector("#products");
const toast = document.querySelector("#store-toast");
const count = document.querySelector("#collection-count");
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const esc = (s) => String(s ?? "").replace(/[&<>'"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
const fallbackProducts = [
  { id: "SKU-KANCHI-001", sku: "SL-KAN-001", name: "Kanchipuram Ruby Zari", collection: "Heritage Gold", category: "Kanchipuram Silk", material: "Mulberry silk", colour: "Ruby red", price: 28900, available: 8, detail: "Temple checks · Pure zari", tone: "ruby" },
  { id: "SKU-BANARAS-014", sku: "SL-BAN-014", name: "Banarasi Midnight Bloom", collection: "Nocturne", category: "Banarasi Silk", material: "Katan silk", colour: "Midnight blue", price: 16900, available: 3, detail: "Floral jaal · Tested zari", tone: "midnight" },
  { id: "SKU-PAITHANI-008", sku: "SL-PAI-008", name: "Paithani Parrot Pallu", collection: "Deccan Stories", category: "Paithani", material: "Silk", colour: "Parrot green", price: 22400, available: 5, detail: "Muniya motif · Pure zari", tone: "parrot" },
];
let products = [];

function initials(name) { return name.split(" ").map((word) => word[0]).join("").slice(0, 3); }
function render(list) {
  count.textContent = `${list.length} curated piece${list.length === 1 ? "" : "s"}`;
  if (!list.length) { grid.innerHTML = `<div class="empty collection-empty">No pieces in this edit yet. Try another filter.</div>`; return; }
  grid.innerHTML = list.map((p, index) => `<article class="product-card tone-${p.tone || ["ruby", "midnight", "parrot"][index % 3]}" data-category="${esc(p.category)}">
    <div class="product-art"><div class="product-art-top"><span>${esc(p.collection || "The edit")}</span><button class="wish" aria-label="Save ${esc(p.name)}">♡</button></div><div class="textile-motif"><b>${initials(p.name)}</b><span>${String(index + 1).padStart(2, "0")}</span></div><div class="product-art-bottom"><span>${esc(p.material || "Pure silk")}</span><span>${esc(p.colour || "Hand-finished")}</span></div></div>
    <div class="product-meta"><div class="product-meta-top"><div class="eyebrow">${esc(p.sku)}</div><span class="availability">${p.available} ready to ship</span></div><h3>${esc(p.name)}</h3><p>${esc(p.detail || `${p.collection} · QR traceable`)}</p><div class="product-buy"><div><small>From</small><strong>${money(p.price)}</strong></div><button class="btn primary" data-buy="${esc(p.id)}">View the piece <span>→</span></button></div></div>
  </article>`).join("");
  document.querySelectorAll("[data-buy]").forEach((button) => button.addEventListener("click", () => checkout(button.dataset.buy, products.find((p) => p.id === button.dataset.buy))));
  document.querySelectorAll(".wish").forEach((button) => button.addEventListener("click", () => { button.classList.toggle("saved"); button.textContent = button.classList.contains("saved") ? "♥" : "♡"; }));
}

async function load() {
  products = fallbackProducts;
  try {
    const response = await fetch("/api/storefront/products", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Collection API unavailable");
    const live = await response.json();
    if (Array.isArray(live) && live.length) products = live.map((p, index) => ({ ...p, tone: fallbackProducts[index % fallbackProducts.length].tone, detail: `${p.collection || "Silk House collection"} · QR traceable` }));
  } catch { document.body.classList.add("store-offline"); }
  render(products);
}

function checkout(productId, product) {
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="store-modal"><div class="modal store-checkout"><div class="checkout-intro"><div class="checkout-swatch tone-${product.tone || "ruby"}"><span>${initials(product.name)}</span></div><div><div class="eyebrow">RESERVE YOUR PIECE</div><h2>${esc(product.name)}</h2><p>${money(product.price)} · ${product.available} available</p></div><button class="close" data-close aria-label="Close">×</button></div><form id="store-form"><div class="form-grid"><div class="field full"><label>Your name</label><input name="customerName" autocomplete="name" required /></div><div class="field"><label>Email</label><input type="email" name="email" autocomplete="email" required /></div><div class="field"><label>City</label><input name="city" autocomplete="address-level2" required /></div><div class="field"><label>Quantity</label><input type="number" name="qty" min="1" max="${product.available}" value="1" required /></div><div class="field"><label>Payment</label><select name="paymentMode"><option>Prepaid</option><option>COD</option></select></div><div class="field full consent"><label><input type="checkbox" name="marketingConsent" value="true" /> I agree to receive collection updates on email/WhatsApp.</label></div></div><div class="checkout-actions"><button type="button" class="btn" data-close>Keep browsing</button><button class="btn primary">Confirm reservation <span>→</span></button></div></form></div></div>`);
  document.querySelectorAll("[data-close]").forEach((element) => element.addEventListener("click", () => document.querySelector("#store-modal")?.remove()));
  document.querySelector("#store-form").addEventListener("submit", async (event) => { event.preventDefault(); const payload = Object.fromEntries(new FormData(event.currentTarget)); payload.productId = productId; payload.qty = Number(payload.qty); payload.marketingConsent = payload.marketingConsent === "true"; try { const response = await fetch("/api/storefront/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Reservation failed"); document.querySelector("#store-modal").remove(); showToast(`Reserved ${result.orderId}. We’ll confirm delivery shortly.`); } catch (error) { showToast(error.message, true); } });
}
function showToast(message, error = false) { toast.textContent = message; toast.classList.toggle("toast-error", error); toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 4000); }
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active")); button.classList.add("active"); const filter = button.dataset.filter; render(filter === "all" ? products : products.filter((p) => p.category === filter)); }));
document.querySelector(".store-menu")?.addEventListener("click", () => document.querySelector(".store-nav")?.classList.toggle("open"));
load();
