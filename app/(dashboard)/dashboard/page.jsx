"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import ConfirmModal from "@/components/ui/ConfirmModal";

const NAV = [
  { key: "finance", label: "Payments & Cashouts", icon: "M3 7h18v14H3zM3 7l12-4v4m-2 6h8" },
  { key: "seller-applications", label: "Seller Applications", icon: "M9 12l2 2 4-4M5 3h14v18H5z" },
  { key: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "orders", label: "Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { key: "products", label: "Products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { key: "users", label: "Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { key: "bao-accounts", label: "BAO Accounts", icon: "M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4zm5-9h2v2h-2zm1 3h2v2h-2zm-1 3h2v2h-2z" },
];

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [baoAccounts, setBaoAccounts] = useState([]);
  const [baoUsers, setBaoUsers] = useState([]);
  const [baoSearchInput, setBaoSearchInput] = useState("");
  const [baoSearch, setBaoSearch] = useState("");
  const [baoPage, setBaoPage] = useState(1);
  const [baoPageInfo, setBaoPageInfo] = useState(null);
  const [baoLoading, setBaoLoading] = useState(true);
  const [baoError, setBaoError] = useState("");
  const [baoNotice, setBaoNotice] = useState("");
  const [baoRefresh, setBaoRefresh] = useState(0);
  const [baoActionPending, setBaoActionPending] = useState(null);
  const router = useRouter();

  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch("/api/admin/me");
        const data = await res.json();
        if (!data.admin) { router.push("/admin/login"); return; }
        setAdmin(data.admin);
        fetchData();
      } catch { router.push("/admin/login"); }
    }
    checkAdmin();

    const socket = getSocket();
    socket.on("connect", () => console.log("✅ Admin socket connected:", socket.id));
    socket.on("connect_error", (err) => console.log("❌ Socket error:", err.message));
    socket.on("orders:new", (order) => {
      setOrders((prev) => [{ ...order, id: order.orderId, status: "pending" }, ...prev]);
      setNotifications((prev) => [{
        id: Date.now(), type: "order", is_read: 0,
        message: `New order #${order.orderId} from ${order.name} — ₱${Number(order.total).toLocaleString()}`,
        created_at: new Date(),
      }, ...prev]);
    });
    socket.on("products:new", (product) => setProducts((prev) => [product, ...prev]));
    socket.on("products:deleted", ({ id }) =>
      setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)))
    );
    socket.on("products:updated", (updated) =>
      setProducts((prev) => prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p))
    );

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("orders:new");
      socket.off("products:new");
      socket.off("products:deleted");
      socket.off("products:updated");
    };
  }, [router]);

  useEffect(() => {
    if (activeTab !== "bao-accounts") return;

    let active = true;
    const params = new URLSearchParams({ page: String(baoPage) });
    if (baoSearch) params.set("search", baoSearch);

    fetch(`/api/admin/bao-accounts?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load BAO accounts.");
        if (!active) return;
        setBaoAccounts(data.baoAccounts);
        setBaoUsers(data.users);
        setBaoPageInfo(data.page);
        setBaoError("");
      })
      .catch((error) => {
        console.error("BAO account list request failed:", error);
        if (active) setBaoError(error.message || "Unable to load BAO accounts.");
      })
      .finally(() => {
        if (active) setBaoLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTab, baoPage, baoRefresh, baoSearch]);

  async function fetchData() {
    const [productsRes, usersRes, ordersRes] = await Promise.all([
      fetch("/api/admin/products"),
      fetch("/api/admin/users"),
      fetch("/api/admin/orders"),
    ]);
    const [p, u, o] = await Promise.all([
      productsRes.ok ? productsRes.json() : [],
      usersRes.ok ? usersRes.json() : [],
      ordersRes.ok ? ordersRes.json() : [],
    ]);
    setProducts(Array.isArray(p) ? p : []);
    setUsers(Array.isArray(u) ? u : []);
    setOrders(Array.isArray(o) ? o : []);
    setLoading(false);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function openDeleteProductModal(id) {
    setConfirmModal({
      title: "Delete this product?",
      description: "This will permanently remove the product from the platform.",
      confirmText: "Delete product",
      cancelText: "Keep product",
      onConfirm: async () => {
        await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
        setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
        setSelectedProducts((prev) => prev.filter((sid) => String(sid) !== String(id)));
      },
    });
  }

  function openBulkDeleteProductsModal() {
    if (!selectedProducts.length) return;
    setConfirmModal({
      title: `Delete ${selectedProducts.length} product(s)?`,
      description: "This will permanently remove the selected product listings.",
      confirmText: "Delete selected",
      cancelText: "Keep selected",
      onConfirm: async () => {
        await Promise.all(selectedProducts.map((id) => fetch(`/api/admin/products/${id}`, { method: "DELETE" })));
        setProducts((prev) => prev.filter((p) => !selectedProducts.map(String).includes(String(p.id))));
        setSelectedProducts([]);
      },
    });
  }

  function toggleSelectProduct(id) {
    setSelectedProducts((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  function toggleSelectAll() {
    setSelectedProducts(selectedProducts.length === products.length ? [] : products.map((p) => p.id));
  }

  function openDeleteUserModal(id) {
    setConfirmModal({
      title: "Delete this user?",
      description: "This will remove the user account and all associated access.",
      confirmText: "Delete user",
      cancelText: "Keep user",
      onConfirm: async () => {
        await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
        fetchData();
      },
    });
  }

  function openBaoRoleModal(user, action) {
    const assigning = action === "assign";
    setBaoError("");
    setBaoNotice("");
    setConfirmModal({
      title: assigning ? "Grant BAO access?" : "Revoke BAO access?",
      description: assigning
        ? `Grant ${user.name || user.email} access to BAO management? The account must already be active and email-verified; its status will not be changed.`
        : `Remove BAO access from ${user.name || user.email}? The account and its data will remain, and its role will return to user.`,
      confirmText: assigning ? "Grant access" : "Revoke access",
      cancelText: "Cancel",
      onConfirm: async () => {
        setBaoActionPending(user.id);
        setBaoLoading(true);
        try {
          const response = await fetch(`/api/admin/bao-accounts/${user.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Unable to update BAO access.");
          }

          setUsers((current) =>
            current.map((item) =>
              item.id === user.id ? { ...item, role: data.user.role } : item
            )
          );
          setBaoNotice(
            assigning
              ? "BAO access granted. The account status was unchanged."
              : "BAO access revoked. The account and its data were preserved."
          );
          setBaoRefresh((current) => current + 1);
        } catch (error) {
          console.error("BAO account update failed:", error);
          setBaoError(error.message || "Unable to update BAO access.");
        } finally {
          setBaoActionPending(null);
        }
      },
    });
  }

  function submitBaoSearch(event) {
    event.preventDefault();
    const nextSearch = baoSearchInput.trim();
    if (nextSearch === baoSearch && baoPage === 1) return;
    setBaoLoading(true);
    setBaoPage(1);
    setBaoSearch(nextSearch);
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  }

  function clearNotifs() {
    setNotifications([]);
    setNotifOpen(false);
  }

  const iconMap = { order: "🛒", order_placed: "✅", order_status: "📦", low_stock: "⚠️", message: "💬" };

  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#070b14]">
      <p className="text-gray-400 text-sm">Loading dashboard...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] text-white md:flex-row">
      {/* Sidebar */}
      <aside className="w-full bg-gray-900 border-b border-gray-800 flex flex-col md:w-56 md:border-b-0 md:border-r md:sticky md:top-0 md:h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white">PIYUMART</h1>
          <p className="text-xs text-gray-500 mt-0.5">Admin Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 flex gap-1 overflow-x-auto md:py-4 md:flex-col md:overflow-x-visible">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                if (item.key === "seller-applications") { router.push("/dashboard/seller-applications"); return; }
                if (item.key === "finance") { router.push("/dashboard/finance"); return; }
                if (item.key === "bao-accounts") setBaoLoading(true);
                setActiveTab(item.key);
              }}
              className={`flex shrink-0 items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition md:w-full text-left ${
                activeTab === item.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
              {item.key === "orders" && pendingOrders > 0 && (
                <span className="ml-auto text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded-full font-bold">
                  {pendingOrders}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Admin info + logout */}
        <div className="hidden px-3 py-4 border-t border-gray-800 md:block">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
              {admin?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">{admin?.name}</p>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-gray-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-sm font-medium text-gray-300">
            {NAV.find((item) => item.key === activeTab)?.label || activeTab}
          </h2>
          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen && unread > 0) markAllRead(); }}
              className="relative p-2 text-gray-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                  <span className="text-sm font-medium text-white">
                    Notifications
                    {unread > 0 && (
                      <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unread}</span>
                    )}
                  </span>
                  <div className="flex gap-3">
                    {unread > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">
                        Mark read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={clearNotifs} className="text-xs text-red-400 hover:text-red-300">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`px-4 py-3 border-b border-gray-800 text-sm ${!n.is_read ? "bg-gray-800/60" : ""}`}>
                        <div className="flex gap-2">
                          <span>{iconMap[n.type] || "🔔"}</span>
                          <div>
                            <p className="text-gray-200">{n.message}</p>
                            <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">

          {/* Overview */}
          {activeTab === "overview" && (
            <div>
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
                <div onClick={() => setActiveTab("products")} className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center cursor-pointer hover:border-blue-500 transition">
                  <p className="text-3xl font-bold text-blue-400">{products.length}</p>
                  <p className="text-gray-400 text-sm mt-1">Total Products</p>
                </div>
                <div onClick={() => setActiveTab("users")} className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center cursor-pointer hover:border-green-500 transition">
                  <p className="text-3xl font-bold text-green-400">{users.length}</p>
                  <p className="text-gray-400 text-sm mt-1">Total Users</p>
                </div>
                <div onClick={() => setActiveTab("orders")} className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center cursor-pointer hover:border-yellow-500 transition">
                  <p className="text-3xl font-bold text-yellow-400">{orders.length}</p>
                  <p className="text-gray-400 text-sm mt-1">Total Orders</p>
                </div>
              </div>

              {/* Recent orders */}
              <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Orders</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-gray-800">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Order</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Buyer</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Total</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                        <td className="px-4 py-3 font-mono text-gray-400">#{order.id}</td>
                        <td className="px-4 py-3 text-gray-200">{order.name}</td>
                        <td className="px-4 py-3 font-medium text-white">₱{Number(order.total).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === "pending" ? "bg-yellow-900/50 text-yellow-400"
                            : order.status === "otw" ? "bg-blue-900/50 text-blue-400"
                            : "bg-green-900/50 text-green-400"
                          }`}>{order.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders */}
          {activeTab === "orders" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-gray-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Order ID</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Buyer</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Address</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Total</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Payment</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                      <td className="px-4 py-3 font-mono text-gray-400">#{order.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{order.name}</p>
                        <p className="text-gray-500 text-xs">{order.buyer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[140px] truncate">{order.address}</td>
                      <td className="px-4 py-3 font-bold text-white">₱{Number(order.total).toLocaleString()}</td>
                      <td className="px-4 py-3 uppercase text-xs text-gray-400">{order.payment_method}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
  order.status === "pending"    ? "bg-yellow-900/50 text-yellow-400"
  : order.status === "confirmed"  ? "bg-purple-900/50 text-purple-400"
  : order.status === "processing" ? "bg-blue-900/50 text-blue-400"
  : order.status === "shipped"    ? "bg-indigo-900/50 text-indigo-400"
  : order.status === "completed"  ? "bg-green-900/50 text-green-400"
  : "bg-red-900/50 text-red-400"
}`}>
  {order.status}
</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Products */}
          {activeTab === "products" && (
            <div>
              {selectedProducts.length > 0 && (
                <div className="flex justify-end mb-3">
                  <button onClick={openBulkDeleteProductsModal}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">
                    Delete Selected ({selectedProducts.length})
                  </button>
                </div>
              )}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-gray-800">
                    <tr>
                      <th className="p-4 w-8">
                        <input type="checkbox"
                          checked={selectedProducts.length === products.length && products.length > 0}
                          onChange={toggleSelectAll}
                          className="accent-blue-500"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Product</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Price</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Seller</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}
                        className={`border-b border-gray-800 hover:bg-gray-800/50 transition ${selectedProducts.includes(product.id) ? "bg-red-900/20" : ""}`}>
                        <td className="p-4">
                          <input type="checkbox" checked={selectedProducts.includes(product.id)}
                            onChange={() => toggleSelectProduct(product.id)} className="accent-blue-500" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={product.image_url || "/placeholder.png"} className="w-9 h-9 rounded-lg object-cover" />
                            <span className="font-medium text-white">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">₱{Number(product.price).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-400">{product.seller_name || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openDeleteProductModal(product.id)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/70 transition">
                              Delete
                            </button>
                            <button
                              onClick={async () => {
                                await fetch("/api/admin/products/feature", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: product.id }),
                                });
                                fetchData();
                              }}
                              className={`text-xs px-3 py-1.5 rounded-lg transition ${
                                product.is_featured
                                  ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                              }`}>
                              {product.is_featured ? "⭐ Featured" : "Feature"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Users */}
          {activeTab === "users" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-gray-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Role</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                      <td className="px-4 py-3 font-medium text-white">{user.name}</td>
                      <td className="px-4 py-3 text-gray-400">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === "admin" ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"
                        }`}>{user.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        {user.role !== "admin" && user.role !== "bao" && (
                          <button onClick={() => openDeleteUserModal(user.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/70 transition">
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "bao-accounts" && (
            <section className="space-y-5">
              <div className="rounded-xl border border-[#c9a028]/40 bg-[#1a2a6c]/30 p-4 text-sm text-gray-200">
                BAO access is limited to existing LSPU accounts that are already active and email-verified.
                Granting or revoking access does not change account status or remove user data.
              </div>

              {baoNotice ? (
                <div role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">
                  {baoNotice}
                </div>
              ) : null}
              {baoError ? (
                <div role="alert" className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">
                  {baoError}
                </div>
              ) : null}

              <section className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-4">
                  <div>
                    <h3 className="font-semibold text-white">Current BAO accounts</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {baoAccounts.length} account(s); access is rechecked on every BAO request.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-gray-800 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Account status</th>
                        <th className="px-4 py-3">Email verification</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baoLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading BAO accounts...</td>
                        </tr>
                      ) : baoAccounts.length ? baoAccounts.map((user) => (
                        <tr key={user.id} className="border-b border-gray-800 last:border-0">
                          <td className="px-4 py-3 font-medium text-white">
                            {[user.name, user.last_name].filter(Boolean).join(" ") || `User ${user.id}`}
                          </td>
                          <td className="px-4 py-3 text-gray-400">{user.email}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                              user.status === "active"
                                ? "bg-green-900/50 text-green-300"
                                : "bg-amber-900/50 text-amber-300"
                            }`}>
                              {user.status || "Unknown"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {user.is_verified === true ? "Verified" : "Not verified"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              disabled={baoActionPending === user.id}
                              onClick={() => openBaoRoleModal(user, "revoke")}
                              className="rounded-lg border border-red-800 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-950/60 disabled:opacity-50"
                            >
                              Revoke access
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No BAO accounts have been assigned.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
                <div className="border-b border-gray-800 px-4 py-4">
                  <h3 className="font-semibold text-white">Find an existing user</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Search by name or email. Admin accounts cannot be promoted.
                  </p>
                  <form onSubmit={submitBaoSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <label className="sr-only" htmlFor="bao-user-search">Search users by name or email</label>
                    <input
                      id="bao-user-search"
                      type="search"
                      value={baoSearchInput}
                      onChange={(event) => setBaoSearchInput(event.target.value)}
                      maxLength={200}
                      placeholder="Name or email"
                      className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9a028]"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#1a2a6c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24377f]"
                    >
                      Search users
                    </button>
                  </form>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="border-b border-gray-800 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Verified</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baoLoading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading users...</td>
                        </tr>
                      ) : baoUsers.length ? baoUsers.map((user) => (
                        <tr key={user.id} className="border-b border-gray-800 last:border-0">
                          <td className="px-4 py-3 font-medium text-white">
                            {[user.name, user.last_name].filter(Boolean).join(" ") || `User ${user.id}`}
                          </td>
                          <td className="px-4 py-3 text-gray-400">{user.email}</td>
                          <td className="px-4 py-3 capitalize text-gray-300">{user.role || "user"}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                              user.status === "active"
                                ? "bg-green-900/50 text-green-300"
                                : "bg-amber-900/50 text-amber-300"
                            }`}>
                              {user.status || "Unknown"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {user.is_verified === true ? "Yes" : "No"}
                          </td>
                          <td className="px-4 py-3">
                            {user.role === "admin" ? (
                              <span className="text-xs text-gray-500">Protected admin account</span>
                            ) : user.role === "bao" ? (
                              <span className="text-xs text-gray-500">Already assigned</span>
                            ) : user.eligible_for_bao ? (
                              <button
                                type="button"
                                disabled={baoActionPending === user.id}
                                onClick={() => openBaoRoleModal(user, "assign")}
                                className="rounded-lg bg-[#c9a028] px-3 py-1.5 text-xs font-bold text-[#1a2a6c] transition hover:bg-[#dfb93f] disabled:opacity-50"
                              >
                                Assign BAO
                              </button>
                            ) : (
                              <span className="text-xs text-amber-300">
                                {user.role !== "user"
                                  ? "Only regular users are eligible"
                                  : user.status !== "active"
                                    ? "Account must already be active"
                                    : user.is_verified !== true
                                      ? "Email verification required"
                                      : "LSPU email required"}
                              </span>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            No users found. Try a different name or email.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {baoPageInfo?.totalPages > 1 ? (
                  <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3 text-xs text-gray-400">
                    <button
                      type="button"
                      disabled={baoLoading || baoPageInfo.current <= 1}
                      onClick={() => {
                        setBaoLoading(true);
                        setBaoPage((current) => Math.max(1, current - 1));
                      }}
                      className="rounded-lg border border-gray-700 px-3 py-2 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span>Page {baoPageInfo.current} of {baoPageInfo.totalPages}</span>
                    <button
                      type="button"
                      disabled={baoLoading || baoPageInfo.current >= baoPageInfo.totalPages}
                      onClick={() => {
                        setBaoLoading(true);
                        setBaoPage((current) => current + 1);
                      }}
                      className="rounded-lg border border-gray-700 px-3 py-2 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </section>
            </section>
          )}
        </main>

        <ConfirmModal
          open={Boolean(confirmModal)}
          title={confirmModal?.title || "Confirm action"}
          description={confirmModal?.description || "Are you sure?"}
          confirmText={confirmModal?.confirmText || "Confirm"}
          cancelText={confirmModal?.cancelText || "Cancel"}
          onCancel={() => setConfirmModal(null)}
          onConfirm={async () => {
            if (!confirmModal?.onConfirm) return;
            const action = confirmModal.onConfirm;
            setConfirmModal(null);
            await action();
          }}
        />
      </div>
    </div>
  );
}
