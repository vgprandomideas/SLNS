"""Streamlit operator console for the SLNS silk operations platform.

The Node service remains the transactional backend. Set SLNS_API_URL to connect
this UI to it; without that setting the app opens in a clearly labelled demo
mode so it is still previewable on Streamlit Cloud.
"""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import streamlit as st


st.set_page_config(
    page_title="SLNS Silk House",
    page_icon="🧵",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    @media (max-width: 640px) {
      [data-testid="stAppViewContainer"] .block-container { padding: 1rem 0.75rem 2rem; }
      [data-testid="stMetricValue"] { font-size: 1.25rem; }
      [data-testid="stMetricLabel"] { font-size: 0.72rem; }
      [data-testid="stDataFrame"] { max-width: 100%; overflow-x: auto; }
      .stButton > button, .stLinkButton > a { min-height: 2.75rem; width: 100%; }
      section[data-testid="stSidebar"] .stRadio label { padding: 0.45rem 0; }
    }
    .store-kicker { color:#a77454; font-size:.72rem; font-weight:800; letter-spacing:.18em; margin-bottom:.5rem; }
    .stream-product { overflow:hidden; border:1px solid #e0d6c5; border-radius:8px; background:#fffdf8; box-shadow:0 12px 28px rgba(75,55,27,.08); margin-bottom:.65rem; }
    .stream-swatch { display:grid; place-items:center; min-height:180px; color:#f4d88e; background:linear-gradient(145deg, var(--tone), #b2824d); }
    .stream-swatch span { font:500 4rem Georgia,serif; opacity:.72; }
    .stream-meta { padding:1rem; }
    .stream-meta small { color:#a37a50; letter-spacing:.12em; }
    .stream-meta h3 { margin:.35rem 0; font-family:Georgia,serif; }
    .stream-meta p { color:#8a938c; font-size:.85rem; }
    .stream-meta strong { color:#244b3c; font:600 1.15rem Georgia,serif; }
    .side-brand { display:flex; align-items:center; gap:.7rem; padding:.25rem .15rem .9rem; border-bottom:1px solid rgba(183,150,94,.25); margin-bottom:1rem; }
    .side-brand-mark { display:grid; place-items:center; width:2.2rem; height:2.2rem; border:1px solid #c6a566; border-radius:50%; color:#d7b777; font:500 1.2rem Georgia,serif; }
    .side-brand-name { color:#f8f1df; font:600 1.08rem Georgia,serif; letter-spacing:.04em; }
    .side-brand-name small { display:block; margin-top:.12rem; color:#a8b8ad; font:700 .56rem sans-serif; letter-spacing:.19em; text-transform:uppercase; }
    .side-section-label { margin:.25rem .1rem .5rem; color:#91aa9e; font:700 .62rem sans-serif; letter-spacing:.18em; text-transform:uppercase; }
    [data-testid="stSidebar"] [role="radiogroup"] { gap:.38rem; }
    [data-testid="stSidebar"] [role="radiogroup"] > label { margin:0; padding:.63rem .72rem !important; border:1px solid transparent; border-radius:.72rem; color:#b7c8bf; cursor:pointer; transition:background .2s ease, border-color .2s ease, color .2s ease, transform .2s ease, box-shadow .2s ease; }
    [data-testid="stSidebar"] [role="radiogroup"] > label:hover { transform:translateX(3px); background:rgba(255,255,255,.07); border-color:rgba(198,165,102,.25); color:#fff; }
    [data-testid="stSidebar"] [role="radiogroup"] > label:has(input:checked) { background:linear-gradient(100deg,#d7b66e,#b78a46); border-color:#efd795; color:#18382e; box-shadow:0 8px 18px rgba(0,0,0,.18); font-weight:800; }
    [data-testid="stSidebar"] [role="radiogroup"] > label:has(input:checked) p { color:#18382e; }
    [data-testid="stSidebar"] [role="radiogroup"] input { accent-color:#d6b56c; }
    [data-testid="stSidebar"] .stAlert { border-radius:.75rem; border:1px solid rgba(117,171,143,.25); }
    </style>
    """,
    unsafe_allow_html=True,
)


DEMO = {
    "summary": {
        "sales": 186500,
        "collections": 92000,
        "inventoryValue": 2780000,
        "wipValue": 384000,
        "contributionMargin": 31.4,
        "openOrders": 12,
    },
    "products": [
        {"sku": "SLN-KAN-001", "name": "Kanchipuram Zari Silk", "category": "Saree", "onHand": 18, "reserved": 4, "price": 28500},
        {"sku": "SLN-BAN-002", "name": "Banarasi Tissue Silk", "category": "Saree", "onHand": 11, "reserved": 2, "price": 19500},
        {"sku": "SLN-RAW-001", "name": "Mulberry Silk Yarn", "category": "Raw material", "onHand": 240, "reserved": 90, "price": 820},
        {"sku": "SLN-RAW-002", "name": "Gold Zari  zari", "category": "Raw material", "onHand": 84, "reserved": 18, "price": 1460},
    ],
    "orders": [
        {"orderNo": "SO-1008", "customer": "Ananya Rao", "status": "Reserved", "total": 57000, "channel": "Web"},
        {"orderNo": "SO-1007", "customer": "Meera Silks", "status": "Packed", "total": 28500, "channel": "Retail"},
        {"orderNo": "SO-1006", "customer": "Nandini Iyer", "status": "Payment pending", "total": 19500, "channel": "Instagram"},
    ],
    "alerts": [
        {"severity": "High", "message": "2 purchase orders awaiting approval"},
        {"severity": "Medium", "message": "1 bank transaction needs reconciliation"},
        {"severity": "Medium", "message": "3 shipments are approaching SLA"},
    ],
}


def api_url() -> str:
    return os.getenv("SLNS_API_URL", "").rstrip("/")


def api_get(path: str):
    """Read a backend resource; return None when the optional backend is offline."""
    base = api_url()
    if not base:
        return None
    headers = {}
    token = st.session_state.get("token") or os.getenv("SLNS_API_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        request = Request(f"{base}{path}", headers=headers, method="GET")
        with urlopen(request, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError):
        return None


def api_post(path: str, payload: dict):
    base = api_url()
    if not base:
        return None, "Set SLNS_API_URL to enable live transactions."
    headers = {"Content-Type": "application/json"}
    token = st.session_state.get("token") or os.getenv("SLNS_API_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        request = Request(
            f"{base}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urlopen(request, timeout=8) as response:
            return json.loads(response.read().decode("utf-8")), ""
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        return None, str(error)


def live_or_demo(path: str, key: str):
    result = api_get(path)
    if result is None:
        return DEMO.get(key, [])
    if isinstance(result, dict) and key in result:
        return result[key]
    return result


def login_panel():
    st.sidebar.markdown('<div class="side-brand"><div class="side-brand-mark">S</div><div class="side-brand-name">SLNS<small>Silk House</small></div></div>', unsafe_allow_html=True)
    if not api_url():
        st.sidebar.markdown('<div class="side-section-label">Customer experience</div>', unsafe_allow_html=True)
        return
    st.sidebar.markdown('<div class="side-section-label">Staff access</div>', unsafe_allow_html=True)
    if st.session_state.get("token"):
        user = st.session_state.get("user", {})
        st.sidebar.success(f"Signed in · {user.get('name', 'staff')}")
        if st.sidebar.button("Sign out", use_container_width=True):
            st.session_state.pop("token", None)
            st.session_state.pop("user", None)
            st.rerun()
        return
    with st.sidebar.form("login"):
        username = st.text_input("Username", value="SLNS")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Sign in")
    if submitted:
        result, error = api_post("/api/auth/login", {"username": username, "password": password})
        if result and result.get("token"):
            st.session_state["token"] = result["token"]
            st.session_state["user"] = result.get("user", {})
            st.sidebar.success("Signed in")
            st.rerun()
        st.sidebar.error(error or "Login failed")


def show_dashboard():
    st.title("SLNS Silk Operations Platform")
    st.caption("Control tower for procurement, production, inventory, commerce, logistics and finance")
    if api_url() and api_get("/api/health") is None:
        st.warning("The configured Node backend is not reachable. Showing demo data.")
    elif not api_url():
        st.warning("Demo mode: configure `SLNS_API_URL` to use live relational data and transactions.")

    summary = live_or_demo("/api/summary", "summary")
    if not isinstance(summary, dict):
        summary = DEMO["summary"]
    columns = st.columns(6)
    metrics = [
        ("Sales", f"₹{summary.get('salesValue', summary.get('sales', 0)):,.0f}"),
        ("Collections", f"₹{summary.get('collections', 0):,.0f}"),
        ("Inventory", f"₹{summary.get('inventoryValue', 0):,.0f}"),
        ("WIP", f"₹{summary.get('wip', summary.get('wipValue', 0)):,.0f}"),
        ("Margin", f"{summary.get('margin', summary.get('contributionMargin', 0)):.1f}%"),
        ("Open orders", str(summary.get("openOrders", 0))),
    ]
    for column, (label, value) in zip(columns, metrics):
        column.metric(label, value)

    left, right = st.columns([1.2, 1])
    with left:
        st.subheader("Recent orders")
        st.dataframe(live_or_demo("/api/orders", "orders"), use_container_width=True, hide_index=True)
    with right:
        st.subheader("Attention queue")
        for alert in live_or_demo("/api/alerts", "alerts"):
            st.write(f"**{alert.get('severity', 'Info')}** — {alert.get('message', alert)}")


def show_inventory():
    st.title("Inventory & catalog")
    products = live_or_demo("/api/products", "products")
    st.dataframe(products, use_container_width=True, hide_index=True)
    st.subheader("Receive stock")
    with st.form("receive"):
        product_options = [item for item in products if item.get("id")]
        selected_product = st.selectbox("SKU", product_options, format_func=lambda item: f"{item.get('sku', item.get('name'))} · {item.get('name', '')}") if product_options else None
        quantity = st.number_input("Quantity", min_value=1, value=1, step=1)
        submitted = st.form_submit_button("Post receipt")
    if submitted:
        if not selected_product:
            st.warning("Connect the backend to post a live receipt.")
            return
        result, error = api_post("/api/actions/receive", {"productId": selected_product["id"], "qty": quantity, "note": "Streamlit inventory receipt"})
        if result:
            st.success("Receipt posted to the Node backend.")
            st.json(result)
        else:
            st.info(error)


def show_orders():
    st.title("Orders & commerce")
    orders = live_or_demo("/api/orders", "orders")
    st.dataframe(orders, use_container_width=True, hide_index=True)
    st.link_button("Open customer storefront", f"{api_url()}/" if api_url() else "/")


def table_section(title, rows, key):
    st.subheader(title)
    if isinstance(rows, list) and rows:
        st.dataframe(rows, use_container_width=True, hide_index=True, key=key)
    else:
        st.caption("No records yet")


def show_procurement():
    st.title("Procurement & vendors")
    data = api_get("/api/procurement-full") or {}
    columns = st.columns(4)
    for column, label, key in zip(columns, ["Requisitions", "RFQs", "Quotations", "Vendor bills"], ["requisitions", "rfqs", "quotations", "vendorBills"]):
        column.metric(label, len(data.get(key, [])))
    for key, label in [("requisitions", "Purchase requisitions"), ("rfqs", "Requests for quotation"), ("quotations", "Vendor quotations"), ("grns", "Goods receipts"), ("vendorBills", "Vendor bills / 3-way match")]:
        table_section(label, data.get(key, []), f"proc-{key}")


def show_production():
    st.title("Production & job work")
    data = api_get("/api/manufacturing") or {}
    columns = st.columns(4)
    for column, label, key in zip(columns, ["Production orders", "BOMs", "Job work", "WIP records"], ["production", "boms", "jobWorks", "wip"]):
        column.metric(label, len(data.get(key, [])))
    for key, label in [("production", "Production orders"), ("boms", "Bills of material"), ("materialIssues", "Material issues"), ("jobWorks", "Job-work ledger"), ("wip", "Work in progress"), ("quality", "Quality inspections")]:
        table_section(label, data.get(key, []), f"prod-{key}")


def show_logistics():
    st.title("Logistics & fulfilment")
    data = api_get("/api/logistics") or {}
    columns = st.columns(3)
    for column, label, key in zip(columns, ["Invoices", "Shipments", "Receipts"], ["invoices", "shipments", "receipts"]):
        column.metric(label, len(data.get(key, [])))
    for key, label in [("invoices", "Invoice register"), ("shipments", "Shipment queue"), ("receipts", "Customer receipts")]:
        table_section(label, data.get(key, []), f"logistics-{key}")


def show_finance():
    st.title("Finance, GST & banking")
    finance = api_get("/api/finance") or {}; banking = api_get("/api/banking") or {}; ledger = api_get("/api/ledger") or {}; trial = api_get("/api/ledger/trial-balance") or {}
    columns = st.columns(4)
    columns[0].metric("Cash", f"₹{finance.get('cash', 0):,.0f}")
    columns[1].metric("Receivables", f"₹{sum(item.get('outstanding', 0) for item in finance.get('receivables', [])):,.0f}")
    columns[2].metric("Payables", f"₹{sum(item.get('value', 0) for item in finance.get('payables', [])):,.0f}")
    columns[3].metric("Trial balance", "Balanced" if trial.get("balanced") else "Review")
    table_section("Unmatched bank transactions", banking.get("unmatched", []), "finance-bank")
    table_section("General ledger postings", ledger.get("journalEntries", []), "finance-ledger")
    table_section("GST ledger", ledger.get("gstLedger", []), "finance-gst")
    table_section("Trial balance by account", trial.get("accounts", []), "finance-trial")


def show_masters():
    st.title("Masters & system setup")
    data = api_get("/api/masters") or {}
    st.subheader(data.get("organisation", {}).get("name", "SLNS Silk House"))
    columns = st.columns(4)
    for column, label, key in zip(columns, ["Products", "Customers", "Vendors", "Locations"], ["products", "customers", "vendors", "locations"]):
        column.metric(label, len(data.get(key, [])))
    for key, label in [("products", "Product master"), ("customers", "Customer master"), ("vendors", "Vendor master"), ("locations", "Warehouse locations"), ("roles", "Roles and permissions")]:
        table_section(label, data.get(key, []), f"master-{key}")


def show_blueprint():
    st.title("Blueprint coverage")
    data = api_get("/api/blueprint") or {}
    st.caption("Internal operations reference — visible only after staff authentication.")
    table_section("Operating modules", data.get("modules", []), "blueprint-modules")
    st.subheader("Canonical business flow")
    st.write("  →  ".join(data.get("canonicalFlow", [])))
    table_section("Implementation roadmap", [{"phase": index + 1, "name": value} for index, value in enumerate(data.get("roadmap", []))], "blueprint-roadmap")


def show_enhanced():
    st.title("Enhanced capabilities")
    data = api_get("/api/enhancements") or {}
    columns = st.columns(4)
    for column, label, key in zip(columns, ["Pieces", "Weaver ledgers", "POS queue", "Risks"], ["pieces", "weaverLedgers", "posSyncQueue", "risks"]):
        column.metric(label, len(data.get(key, [])))
    for key, label in [("pieces", "Piece-level QR traceability"), ("weaverLedgers", "Weaver ledger"), ("channels", "Channel economics"), ("seasonality", "Seasonality plan"), ("risks", "Risk register"), ("successTests", "Success tests")]:
        table_section(label, data.get(key, []), f"enhanced-{key}")


def show_prd():
    st.title("PRD acceptance")
    data = api_get("/api/prd") or {}
    acceptance = data.get("acceptance", [])
    ready = sum(item.get("status") == "Ready" for item in acceptance)
    st.metric("Acceptance areas ready", f"{ready}/{len(acceptance)}")
    table_section("Acceptance criteria", acceptance, "prd-acceptance")
    for key, label in [("procurement", "Procurement records"), ("manufacturing", "Manufacturing records"), ("commercial", "Commercial controls"), ("banking", "Banking controls"), ("experience", "Experience records")]:
        st.subheader(label)
        st.json(data.get(key, {}))


def show_audit():
    st.title("Audit trail")
    table_section("Immutable event history", api_get("/api/audit") or [], "audit-events")


def show_collection():
    st.markdown('<div class="store-kicker">SLNS SILK HOUSE · THE COLLECTION</div>', unsafe_allow_html=True)
    st.title("Made to be remembered.")
    st.write("Hand-finished silk sarees with one digital thread from loom to your door.")
    st.markdown("### The current edit")
    products = api_get("/api/storefront/products") or [item for item in DEMO["products"] if item["category"] != "Raw material"]
    columns = st.columns(min(3, max(1, len(products))))
    tones = ["#6d1e2b", "#102c46", "#285745"]
    for index, product in enumerate(products):
        with columns[index % len(columns)]:
            colour = tones[index % len(tones)]
            st.markdown(
                f"<div class='stream-product' style='--tone:{colour}'><div class='stream-swatch'><span>{product.get('name', 'Silk').split()[0][0]}{product.get('name', 'House').split()[-1][0]}</span></div><div class='stream-meta'><small>{product.get('sku', 'SLNS')}</small><h3>{product.get('name', 'Silk house piece')}</h3><p>{product.get('collection', 'The edit')} · QR traceable</p><strong>₹{int(product.get('price', 0)):,}</strong></div></div>",
                unsafe_allow_html=True,
            )
            if st.button("Reserve this piece", key=f"reserve-{index}", use_container_width=True):
                st.info("Reservations are completed from the connected SLNS storefront.")


def show_craft():
    st.markdown('<div class="store-kicker">THE HOUSE NOTE</div>', unsafe_allow_html=True)
    st.title("Rooted in the loom. Ready for tomorrow.")
    st.write("SLNS brings the warmth of a family silk house into a considered digital experience. Each saree is catalogued, quality-checked and connected to the people who made it.")
    columns = st.columns(3)
    for column, number, title, detail in zip(columns, ["01", "02", "03"], ["Pure silk, considered", "Craft, credited", "Delivered with care"], ["Materials selected for a lifetime of wear.", "Meet the hands behind every weave.", "Inspected, wrapped and shipped from our house."]):
        with column:
            st.markdown(f"**{number} · {title}**\n\n{detail}")


login_panel()
operator = bool(api_url() and (st.session_state.get("token") or os.getenv("SLNS_API_TOKEN")))
if operator:
    page_names = {"⌂  Control tower": "Control tower", "▦  Inventory": "Inventory", "◌  Orders & commerce": "Orders & commerce", "⇢  Procurement": "Procurement", "◒  Production": "Production", "▸  Logistics": "Logistics", "₹  Finance & GST": "Finance & GST", "◇  Masters & setup": "Masters & setup", "✦  Blueprint coverage": "Blueprint coverage", "✧  Enhanced features": "Enhanced features", "✓  PRD acceptance": "PRD acceptance", "≡  Audit trail": "Audit trail"}
    selected = st.sidebar.radio("Workspace", list(page_names), label_visibility="collapsed")
    page = page_names[selected]
else:
    page_names = {"✦  Silk collection": "Silk collection", "◈  Our craft": "Our craft"}
    selected = st.sidebar.radio("Explore", list(page_names), label_visibility="collapsed")
    page = page_names[selected]

if page == "Control tower":
    show_dashboard()
elif page == "Inventory":
    show_inventory()
elif page == "Orders & commerce":
    show_orders()
elif page == "Procurement":
    show_procurement()
elif page == "Production":
    show_production()
elif page == "Logistics":
    show_logistics()
elif page == "Finance & GST":
    show_finance()
elif page == "Masters & setup":
    show_masters()
elif page == "Blueprint coverage":
    show_blueprint()
elif page == "Enhanced features":
    show_enhanced()
elif page == "PRD acceptance":
    show_prd()
elif page == "Audit trail":
    show_audit()
elif page == "Silk collection":
    show_collection()
else:
    show_craft()
