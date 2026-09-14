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
    page_title="SLNS Silk Operations",
    page_icon="🧵",
    layout="wide",
    initial_sidebar_state="expanded",
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
    st.sidebar.subheader("Backend login")
    if not api_url():
        st.sidebar.info("Demo mode. Add SLNS_API_URL for live data.")
        return
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


def show_coverage():
    st.title("Blueprint and PRD coverage")
    blueprint = api_get("/api/blueprint") or {"modules": ["Masters", "Procurement", "Manufacturing", "Inventory", "Sales", "Finance", "Reports"]}
    enhanced = api_get("/api/enhancements") or {"features": ["QR traceability", "Offline POS queue", "Weaver ledger", "Omnichannel storefront", "DPDP controls"]}
    prd = api_get("/api/prd") or {"acceptance": [{"area": "Core operations", "status": "Implemented locally"}, {"area": "External integrations", "status": "Configure providers"}]}
    st.subheader("Blueprint modules")
    st.write(blueprint.get("modules", blueprint))
    st.subheader("Enhanced capabilities")
    st.write(enhanced.get("features", enhanced))
    st.subheader("PRD acceptance")
    st.dataframe(prd.get("acceptance", prd), use_container_width=True, hide_index=True)


login_panel()
page = st.sidebar.radio("Workspace", ["Control tower", "Inventory", "Orders & commerce", "Blueprint / PRD"])
if page == "Control tower":
    show_dashboard()
elif page == "Inventory":
    show_inventory()
elif page == "Orders & commerce":
    show_orders()
else:
    show_coverage()
