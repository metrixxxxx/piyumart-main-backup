"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

const NAV = [
  { key: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "orders", label: "Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { key: "products", label: "Products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { key: "users", label: "Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
];

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
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
  }, []);

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

  async function handleDeleteProduct(id) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
    setSelectedProducts((prev) => prev.filter((sid) => String(sid) !== String(id)));
  }

  async function handleBulkDeleteProducts() {
    if (!selectedProducts.length || !confirm(`Delete ${selectedProducts.length} product(s)?`)) return;
    await Promise.all(selectedProducts.map((id) => fetch(`/api/admin/products/${id}`, { method: "DELETE" })));
    setProducts((prev) => prev.filter((p) => !selectedProducts.map(String).includes(String(p.id))));
    setSelectedProducts([]);
  }

  function toggleSelectProduct(id) {
    setSelectedProducts((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  function toggleSelectAll() {
    setSelectedProducts(selectedProducts.length === products.length ? [] : products.map((p) => p.id));
  }

  async function handleDeleteUser(id) {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchData();
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
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <p className="text-gray-400 text-sm">Loading dashboard...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white">PIYUMART</h1>
          <p className="text-xs text-gray-500 mt-0.5">Admin Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition w-full text-left ${
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
        <div className="px-3 py-4 border-t border-gray-800">
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
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-sm font-medium text-gray-300 capitalize">{activeTab}</h2>
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
              <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
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
        <main className="flex-1 p-6 overflow-auto">

          {/* Overview */}
          {activeTab === "overview" && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-6">
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
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
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
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
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
                  <button onClick={handleBulkDeleteProducts}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">
                    Delete Selected ({selectedProducts.length})
                  </button>
                </div>
              )}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
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
                            <button onClick={() => handleDeleteProduct(product.id)}
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
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
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
                        {user.role !== "admin" && (
                          <button onClick={() => handleDeleteUser(user.id)}
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
        </main>
      </div>
    </div>
  );
}