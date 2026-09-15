const grid = document.querySelector("#products");
const toast = document.querySelector("#store-toast");
const count = document.querySelector("#collection-count");
const bagCount = document.querySelector("#bag-count");
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const esc = (s) => String(s ?? "").replace(/[&<>'"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
const fallbackProducts = [
  { id: "SKU-KANCHI-001", sku: "SL-KAN-001", name: "Kanchipuram Ruby Zari", collection: "Heritage Gold", category: "Kanchipuram Silk", material: "Mulberry silk", colour: "Ruby red", price: 28900, available: 8, detail: "Temple checks · Pure zari", tone: "ruby" },
  { id: "SKU-BANARAS-014", sku: "SL-BAN-014", name: "Banarasi Midnight Bloom", collection: "Nocturne", category: "Banarasi Silk", material: "Katan silk", colour: "Midnight blue", price: 16900, available: 3, detail: "Floral jaal · Tested zari", tone: "midnight" },
  { id: "SKU-PAITHANI-008", sku: "SL-PAI-008", name: "Paithani Parrot Pallu", collection: "Deccan Stories", category: "Paithani", material: "Silk", colour: "Parrot green", price: 22400, available: 5, detail: "Muniya motif · Pure zari", tone: "parrot" },
];
let products = [];
let bag = JSON.parse(localStorage.getItem("slns_bag") || "[]");

function initials(name) { return String(name || "Silk").split(" ").map((word) => word[0]).join("").slice(0, 3); }
function persistBag() { localStorage.setItem("slns_bag", JSON.stringify(bag)); updateBagCount(); }
function updateBagCount() { if (bagCount) bagCount.textContent = bag.reduce((total, item) => total + item.qty, 0); }
function productById(id) { return products.find((product) => product.id === id) || fallbackProducts.find((product) => product.id === id); }

function render(list) {
  count.textContent = `${list.length} curated piece${list.length === 1 ? "" : "s"}`;
  if (!list.length) { grid.innerHTML = `<div class="empty collection-empty">No pieces in this edit yet. Try another filter.</div>`; return; }
  grid.innerHTML = list.map((p, index) => `<article class="product-card tone-${p.tone || ["ruby", "midnight", "parrot"][index % 3]}" data-category="${esc(p.category)}">
    <div class="product-art"><div class="product-art-top"><span>${esc(p.collection || "The edit")}</span><button class="wish" aria-label="Save ${esc(p.name)}">♡</button></div><div class="textile-motif"><b>${initials(p.name)}</b><span>${String(index + 1).padStart(2, "0")}</span></div><div class="product-art-bottom"><span>${esc(p.material || "Pure silk")}</span><span>${esc(p.colour || "Hand-finished")}</span></div></div>
    <div class="product-meta"><div class="product-meta-top"><div class="eyebrow">${esc(p.sku)}</div><span class="availability">${p.available} ready to ship</span></div><h3>${esc(p.name)}</h3><p>${esc(p.detail || `${p.collection || "Silk House collection"} · QR traceable`)}</p><div class="product-buy"><div><small>From</small><strong>${money(p.price)}</strong></div><button class="btn primary" data-view-piece="${esc(p.id)}">View the piece <span>→</span></button></div></div>
  </article>`).join("");
  document.querySelectorAll("[data-view-piece]").forEach((button) => button.addEventListener("click", () => openProduct(productById(button.dataset.viewPiece))));
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
  render(products); updateBagCount();
}

function openProduct(product) {
  if (!product) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="store-modal"><div class="modal product-detail-modal"><div class="product-detail-art tone-${product.tone || "ruby"}"><span>${esc(product.collection || "THE EDIT")}</span><b>${initials(product.name)}</b><small>${esc(product.material || "Pure silk")} · ${esc(product.colour || "Hand-finished")}</small></div><div class="product-detail-copy"><button class="close" data-close aria-label="Close">×</button><div class="eyebrow">${esc(product.sku)} · QR TRACEABLE</div><h2>${esc(product.name)}</h2><p>${esc(product.detail || "Hand-finished silk from the SLNS collection.")}</p><div class="detail-facts"><span><b>${money(product.price)}</b><small>Price inclusive of GST</small></span><span><b>${product.available}</b><small>Ready to ship</small></span></div><div class="detail-actions"><label>Quantity <input id="detail-qty" type="number" min="1" max="${product.available}" value="1" /></label><button class="btn" data-add="${esc(product.id)}">Add to bag</button><button class="btn primary" data-buy-now="${esc(product.id)}">Buy now <span>→</span></button></div></div></div></div>`);
  document.querySelectorAll("#store-modal [data-close]").forEach((element) => element.addEventListener("click", () => document.querySelector("#store-modal")?.remove()));
  document.querySelector("#store-modal [data-add]").addEventListener("click", () => { addToBag(product, Number(document.querySelector("#detail-qty").value)); document.querySelector("#store-modal")?.remove(); showToast(`${product.name} added to your bag`); });
  document.querySelector("#store-modal [data-buy-now]").addEventListener("click", () => { addToBag(product, Number(document.querySelector("#detail-qty").value)); document.querySelector("#store-modal")?.remove(); openCheckout(); });
}

function addToBag(product, qty = 1) {
  const quantity = Math.max(1, Math.min(Number(qty) || 1, Number(product.available || 1)));
  const existing = bag.find((item) => item.productId === product.id);
  if (existing) existing.qty = Math.min(existing.qty + quantity, Number(product.available || existing.qty + quantity));
  else bag.push({ productId: product.id, qty: quantity });
  persistBag();
}

function openBag() {
  const items = bag.map((item) => ({ ...item, product: productById(item.productId) })).filter((item) => item.product);
  const total = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="store-modal"><div class="modal bag-modal"><div class="modal-head"><div><div class="eyebrow">YOUR SILK BAG</div><h2 class="panel-title">Ready when you are.</h2></div><button class="close" data-close aria-label="Close">×</button></div>${items.length ? `<div class="bag-items">${items.map((item) => `<div class="bag-item"><div class="bag-swatch tone-${item.product.tone || "ruby"}">${initials(item.product.name)}</div><div><strong>${esc(item.product.name)}</strong><small>${item.qty} × ${money(item.product.price)}</small></div><b>${money(item.product.price * item.qty)}</b><button class="bag-remove" data-remove="${esc(item.product.id)}" aria-label="Remove ${esc(item.product.name)}">×</button></div>`).join("")}</div><div class="bag-total"><span>Collection total</span><strong>${money(total)}</strong></div><button class="btn primary bag-checkout" data-checkout>Continue to delivery <span>→</span></button>` : `<div class="empty">Your bag is waiting for its first beautiful piece.</div><a class="btn primary bag-checkout" href="#collection" data-close>Explore the collection</a>`}</div></div>`);
  document.querySelectorAll("#store-modal [data-close]").forEach((element) => element.addEventListener("click", () => document.querySelector("#store-modal")?.remove()));
  document.querySelectorAll("#store-modal [data-remove]").forEach((element) => element.addEventListener("click", () => { bag = bag.filter((item) => item.productId !== element.dataset.remove); persistBag(); document.querySelector("#store-modal")?.remove(); openBag(); }));
  document.querySelector("#store-modal [data-checkout]")?.addEventListener("click", () => { document.querySelector("#store-modal")?.remove(); openCheckout(); });
}

function openCheckout() {
  if (!bag.length) return openBag();
  const items = bag.map((item) => ({ ...item, product: productById(item.productId) })).filter((item) => item.product);
  const total = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="store-modal"><div class="modal store-checkout"><div class="checkout-intro"><div class="checkout-swatch tone-${items[0].product.tone || "ruby"}"><span>${initials(items[0].product.name)}</span></div><div><div class="eyebrow">STEP 1 OF 2 · DELIVERY</div><h2>Make it yours.</h2><p>${items.length} piece${items.length === 1 ? "" : "s"} · ${money(total)}</p></div><button class="close" data-close aria-label="Close">×</button></div><div class="checkout-summary">${items.map((item) => `<span>${esc(item.product.name)} <b>×${item.qty}</b></span>`).join("")}</div><form id="store-form"><div class="form-grid"><div class="field full"><label>Full name</label><input name="customerName" autocomplete="name" placeholder="Your name" required /></div><div class="field"><label>Email</label><input type="email" name="email" autocomplete="email" placeholder="you@example.com" required /></div><div class="field"><label>Phone</label><input name="phone" autocomplete="tel" inputmode="tel" placeholder="10-digit mobile number" required /></div><div class="field full"><label>Delivery address</label><textarea name="address" rows="2" autocomplete="street-address" placeholder="House number, street, area" required></textarea></div><div class="field"><label>City</label><input name="city" autocomplete="address-level2" required /></div><div class="field"><label>PIN code</label><input name="pincode" inputmode="numeric" pattern="[0-9]{6}" placeholder="560001" required /></div><div class="field full payment-choice"><label>Payment method</label><div class="payment-options"><label><input type="radio" name="paymentMode" value="Prepaid" checked /> <span><b>Pay online</b><small>UPI, card or net banking</small></span></label><label><input type="radio" name="paymentMode" value="COD" /> <span><b>Cash on delivery</b><small>Pay when it arrives</small></span></label></div></div><div class="field full consent"><label><input type="checkbox" name="marketingConsent" value="true" /> I’d like occasional notes from the silk house.</label></div></div><div class="checkout-actions"><button type="button" class="btn" data-close>Keep browsing</button><button class="btn primary">Review payment <span>→</span></button></div></form></div></div>`);
  document.querySelectorAll("#store-modal [data-close]").forEach((element) => element.addEventListener("click", () => document.querySelector("#store-modal")?.remove()));
  document.querySelector("#store-form").addEventListener("submit", async (event) => { event.preventDefault(); const payload = Object.fromEntries(new FormData(event.currentTarget)); payload.marketingConsent = payload.marketingConsent === "true"; await placeOrders(items, payload); });
}

async function placeOrders(items, payload) {
  const button = document.querySelector("#store-form button.primary"); if (button) { button.disabled = true; button.textContent = "Creating your order…"; }
  try {
    const orders = []; const payments = [];
    for (const item of items) {
      const orderResponse = await fetch("/api/storefront/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, productId: item.product.id, qty: item.qty }) });
      const order = await orderResponse.json(); if (!orderResponse.ok) throw new Error(order.error || "We could not create your order");
      orders.push(order);
      if (payload.paymentMode === "Prepaid") { const paymentResponse = await fetch("/api/storefront/payment-intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.orderId, amount: order.amount, email: payload.email, idempotencyKey: `web-payment-${order.orderId}` }) }); const payment = await paymentResponse.json(); if (!paymentResponse.ok) throw new Error(payment.error || "Payment could not be started"); payments.push(payment.paymentIntent); }
    }
    bag = []; persistBag(); document.querySelector("#store-modal")?.remove();
    if (payload.paymentMode === "Prepaid") showPayment(orders, payments, payload); else showConfirmation(orders, payload, "COD order reserved");
  } catch (error) { if (button) { button.disabled = false; button.textContent = "Review payment →"; } showToast(error.message, true); }
}

function showPayment(orders, payments, payload) {
  const total = payments.reduce((sum, intent) => sum + intent.amount, 0);
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="store-modal"><div class="modal payment-modal"><div class="checkout-intro"><div class="payment-lock">⌁</div><div><div class="eyebrow">STEP 2 OF 2 · SECURE PAYMENT</div><h2>Complete your payment.</h2><p>${orders.map((order) => esc(order.orderId)).join(" · ")} · ${money(total)}</p></div><button class="close" data-close aria-label="Close">×</button></div><div class="payment-method-tabs"><button class="active" type="button">UPI</button><button type="button">Card</button><button type="button">Net banking</button></div><form id="payment-form"><div class="field"><label>Payment reference</label><input name="reference" placeholder="UPI ID or card reference" required /></div><div class="payment-trust"><span>✓</span><div><b>Demo payment environment</b><small>Your order is securely linked to your verified email. No card details are stored by SLNS.</small></div></div><button class="btn primary payment-submit">Pay ${money(total)} securely <span>→</span></button></form></div></div>`);
  document.querySelectorAll("#store-modal [data-close]").forEach((element) => element.addEventListener("click", () => document.querySelector("#store-modal")?.remove()));
  document.querySelectorAll(".payment-method-tabs button").forEach((tab) => tab.addEventListener("click", () => { document.querySelectorAll(".payment-method-tabs button").forEach((item) => item.classList.remove("active")); tab.classList.add("active"); }));
  document.querySelector("#payment-form").addEventListener("submit", async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button"); button.disabled = true; button.textContent = "Confirming payment…"; try { const paymentMethod = document.querySelector(".payment-method-tabs button.active").textContent; for (const intent of payments) { const response = await fetch("/api/storefront/payment-confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentIntentId: intent.id, email: payload.email, paymentMethod, reference: event.currentTarget.reference.value }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Payment confirmation failed"); } document.querySelector("#store-modal")?.remove(); showConfirmation(orders, payload, "Payment captured"); } catch (error) { button.disabled = false; button.textContent = `Pay ${money(total)} securely →`; showToast(error.message, true); } });
}

function showConfirmation(orders, payload, paymentStatus) {
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="store-modal"><div class="modal success-modal"><div class="success-mark">✓</div><div class="eyebrow">ORDER CONFIRMED</div><h2>It’s on its way to becoming yours.</h2><p class="success-lead">${paymentStatus}. We’ve sent the details to <b>${esc(payload.email)}</b>.</p><div class="order-confirmation-list">${orders.map((order) => `<div><span>Order number</span><strong>${esc(order.orderId)}</strong><small>${esc(order.status)} · ${money(order.amount)}</small></div>`).join("")}</div><form id="track-form"><label>Track your order</label><div class="track-fields"><input name="orderId" placeholder="Order number" value="${esc(orders[0].orderId)}" required /><input name="email" type="email" placeholder="Email" value="${esc(payload.email)}" required /><button class="btn">Check status</button></div><div id="track-result"></div></form><button class="btn primary success-close" data-close>Continue browsing <span>→</span></button></div></div>`);
  document.querySelector("#store-modal [data-close]").addEventListener("click", () => document.querySelector("#store-modal")?.remove());
  document.querySelector("#track-form").addEventListener("submit", async (event) => { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)); const result = document.querySelector("#track-result"); result.textContent = "Checking your order…"; try { const response = await fetch(`/api/storefront/order-status?orderId=${encodeURIComponent(form.orderId)}&email=${encodeURIComponent(form.email)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Order not found"); result.innerHTML = `<span class="track-success">${esc(data.status)}${data.tracking ? ` · Tracking ${esc(data.tracking)}` : ""}</span>`; } catch (error) { result.innerHTML = `<span class="track-error">${esc(error.message)}</span>`; } });
}

function showToast(message, error = false) { toast.textContent = message; toast.classList.toggle("toast-error", error); toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 4000); }
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active")); button.classList.add("active"); const filter = button.dataset.filter; render(filter === "all" ? products : products.filter((p) => p.category === filter)); }));
document.querySelector("#bag-button")?.addEventListener("click", openBag);
document.querySelector(".store-menu")?.addEventListener("click", () => document.querySelector(".store-nav")?.classList.toggle("open"));
const renderConfirmation = showConfirmation;
showConfirmation = (orders, payload, paymentStatus) => renderConfirmation(orders.map((order) => ({ ...order, status: paymentStatus === "Payment captured" ? "Confirmed" : order.status })), payload, paymentStatus);
load();
