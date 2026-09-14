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
    st.sidebar.subheader("SLNS Silk House")
    if not api_url():
        st.sidebar.caption("Customer collection")
        return
    st.sidebar.subheader("Staff access")
    with st.sidebar.form("login"):
        username = st.text_input("Username", value="priya")
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

    summary = live_or_demo("/api/reports", "summary")
    if not isinstance(summary, dict):
        summary = DEMO["summary"]
    columns = st.columns(6)
    metrics = [
        ("Sales", f"₹{summary.get('sales', 0):,.0f}"),
        ("Collections", f"₹{summary.get('collections', 0):,.0f}"),
        ("Inventory", f"₹{summary.get('inventoryValue', 0):,.0f}"),
        ("WIP", f"₹{summary.get('wipValue', 0):,.0f}"),
        ("Margin", f"{summary.get('contributionMargin', 0):.1f}%"),
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
        sku = st.selectbox("SKU", [item.get("sku") for item in products])
        quantity = st.number_input("Quantity", min_value=1, value=1, step=1)
        submitted = st.form_submit_button("Post receipt")
    if submitted:
        result, error = api_post("/api/actions/receive", {"sku": sku, "quantity": quantity, "type": "Finished goods"})
        if result:
            st.success("Receipt posted to the Node backend.")
            st.json(result)
        else:
            st.info(error)


def show_orders():
    st.title("Orders & commerce")
    orders = live_or_demo("/api/orders", "orders")
    st.dataframe(orders, use_container_width=True, hide_index=True)
    st.link_button("Open customer storefront", f"{api_url()}/storefront.html" if api_url() else "http://localhost:3000/storefront.html")


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
    page = st.sidebar.radio("Workspace", ["Control tower", "Inventory", "Orders & commerce"])
else:
    page = st.sidebar.radio("Explore", ["Silk collection", "Our craft"])

if page == "Control tower":
    show_dashboard()
elif page == "Inventory":
    show_inventory()
elif page == "Orders & commerce":
    show_orders()
elif page == "Silk collection":
    show_collection()
else:
    show_craft()
