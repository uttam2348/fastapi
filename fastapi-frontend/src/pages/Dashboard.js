import React, { useState, useEffect, useCallback, Suspense } from "react";
import API from "../api";

// Lazy load heavy components
const StatsCards = React.lazy(() => import("../components/StatsCards"));
const CartPanel = React.lazy(() => import("../components/CartPanel"));

export default function Dashboard() {
  console.log("Dashboard component rendered");
  
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState({ username: "", items: [] });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshCountdown, setRefreshCountdown] = useState(604800);
  const [message, setMessage] = useState({ text: "", type: "", show: false });
  const [userRole, setUserRole] = useState("");
  
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    brand: "",
    name: "",
    price: "",
    quantity: "",
    description: ""
  });

  // API instance handles auth headers

  // Show message function
  const showMessage = (text, type = "success") => {
    setMessage({ text, type, show: true });
    setTimeout(() => setMessage({ text: "", type: "", show: false }), 5000);
  };

  // (moved below after function definitions)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsRes, statsRes, notificationsRes] = await Promise.all([
        API.get("/items"),
        API.get("/items/count"),
        API.get("/notifications")
      ]);

      setItems(itemsRes.data);
      setStats(statsRes.data);
      setNotifications(notificationsRes.data.notifications || []);
      setLastRefresh(new Date());
      setRefreshCountdown(604800);
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 403) {
        // User doesn't have permission for notifications
        setNotifications([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRole = useCallback(async () => {
    try {
      const res = await API.get("/auth/me");
      setUserRole(res.data?.role || "");
    } catch (e) {
      // ignore; role will remain empty
    }
  }, []);

  // -------- CART API --------
  const fetchCart = useCallback(async () => {
    try {
      const res = await API.get("/cart");
      setCart(res.data);
    } catch (error) {
      console.error("Error fetching cart:", error);
    }
  }, []);

  const addToCart = async (brand, quantity = 1) => {
    try {
      await API.post(`/cart/add?brand=${encodeURIComponent(brand)}&quantity=${quantity}`);
      await fetchCart();
      showMessage(`Added ${brand} to cart`);
      setIsCartOpen(true);
    } catch (error) {
      console.error("Error adding to cart:", error);
      showMessage(error.response?.data?.detail || "Error adding to cart", "error");
    }
  };

  // Fetch all data on component mount (after callbacks are defined)
  useEffect(() => {
    fetchData();
    fetchCart();
    fetchRole();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          fetchData();
          return 604800;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchData, fetchCart, fetchRole]);

  const updateCartQty = async (brand, quantity) => {
    try {
      await API.post(`/cart/update?brand=${encodeURIComponent(brand)}&quantity=${quantity}`);
      await fetchCart();
    } catch (error) {
      console.error("Error updating cart:", error);
      showMessage(error.response?.data?.detail || "Error updating cart", "error");
    }
  };

  const clearCart = async () => {
    try {
      await API.post("/cart/clear");
      await fetchCart();
      showMessage("Cart cleared");
    } catch (error) {
      console.error("Error clearing cart:", error);
      showMessage(error.response?.data?.detail || "Error clearing cart", "error");
    }
  };

  const checkoutCart = async () => {
    try {
      const res = await API.post("/cart/checkout");
      await fetchCart();
      await fetchData();
      const ok = (res.data?.results || []).filter(r => r.status === "ok").length;
      const total = (res.data?.results || []).length;
      showMessage(`Checkout complete: ${ok}/${total} items purchased`);
    } catch (error) {
      console.error("Error on checkout:", error);
      showMessage(error.response?.data?.detail || "Error on checkout", "error");
    }
  };

  // -------- PAYMENTS (ADMIN/SUPERADMIN) --------
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");
  const [quote, setQuote] = useState(null);

  const buildCartItemsForPayment = () => {
    return (cart.items || []).map(ci => ({
      item_id: ci.item_id || "",
      brand: ci.brand,
      name: ci.name,
      price: ci.price,
      quantity: ci.quantity || 1
    }));
  };

  const getQuote = async () => {
    try {
      const payload = { items: buildCartItemsForPayment(), tax_rate: Number(taxRate) || 0, discount: Number(discount) || 0 };
      const res = await API.post("/payments/quote", payload);
      setQuote(res.data);
    } catch (e) {
      setQuote(null);
      showMessage(e.response?.data?.detail || "Error getting quote", "error");
    }
  };

  const chargePayment = async () => {
    try {
      const payload = { items: buildCartItemsForPayment(), tax_rate: Number(taxRate) || 0, discount: Number(discount) || 0, method: payMethod };
      const res = await API.post("/payments/charge", payload);
      showMessage(`Payment recorded: ${res.data?.payment_id}`);
      setQuote(null);
      setIsPayOpen(false);
    } catch (e) {
      showMessage(e.response?.data?.detail || "Payment failed", "error");
    }
  };

  // Create new item
  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      const response = await API.post("/items", formData);

      setItems([...items, response.data]);
      setShowCreateForm(false);
      setFormData({ brand: "", name: "", price: "", quantity: "", description: "" });
      fetchData(); // Refresh stats
      showMessage("Item created successfully!");
    } catch (error) {
      console.error("Error creating item:", error);
      showMessage(error.response?.data?.detail || "Error creating item", "error");
    }
  };

  // Update item
  const handleUpdateItem = async (e) => {
    e.preventDefault();
    try {
      const response = await API.put(`/items/${editingItem.brand}`, formData);

      setItems(items.map(item =>
        item.brand === editingItem.brand ? response.data.after_update : item
      ));
      setShowEditForm(false);
      setEditingItem(null);
      setFormData({ brand: "", name: "", price: "", quantity: "", description: "" });
      fetchData(); // Refresh stats
      showMessage("Item updated successfully!");
    } catch (error) {
      console.error("Error updating item:", error);
      showMessage(error.response?.data?.detail || "Error updating item", "error");
    }
  };

  // Delete item
  const handleDeleteItem = async (brand) => {
    if (window.confirm(`Are you sure you want to delete ${brand}?`)) {
      try {
        await API.delete(`/items/${brand}`);

        setItems(items.filter(item => item.brand !== brand));
        fetchData(); // Refresh stats
        showMessage("Item deleted successfully!");
      } catch (error) {
        console.error("Error deleting item:", error);
        showMessage(error.response?.data?.detail || "Error deleting item", "error");
      }
    }
  };

  // Buy item
  const handleBuyItem = async (brand) => {
    try {
      const response = await API.post(`/items/buy/${brand}`);
      showMessage(response.data.msg);
      fetchData(); // Refresh data to show updated quantities
    } catch (error) {
      console.error("Error buying item:", error);
      showMessage(error.response?.data?.detail || "Error buying item", "error");
    }
  };

  // Search items
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await API.get(`/items/search?q=${searchQuery}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error("Error searching items:", error);
      setSearchResults([]);
    }
  };

  // Clear all notifications from database
  const handleClearAllNotifications = async () => {
    if (!window.confirm("⚠️ WARNING: This will delete ALL notifications from the database. Are you sure you want to continue?")) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Clear notifications using backend endpoint
      const response = await API.delete("/notifications/clear");
      
      // Clear local state
      setNotifications([]);
      
      // Refresh data to update stats
      await fetchData();
      
      showMessage(response.data.msg);
    } catch (error) {
      console.error("Error clearing notifications:", error);
      showMessage(error.response?.data?.detail || "Error clearing notifications", "error");
    } finally {
      setLoading(false);
    }
  };

  // Clear all items data (admin/superadmin only)
  const handleClearAllItems = async () => {
    if (!window.confirm("⚠️ WARNING: This will delete ALL items from the database. Users will remain intact. Are you sure you want to continue?")) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Get all items first
      const itemsResponse = await API.get("/items");
      const allItems = itemsResponse.data;

      // Delete each item one by one
      for (const item of allItems) {
        try {
          await API.delete(`/items/${item.brand}`);
        } catch (error) {
          console.error(`Error deleting item ${item.brand}:`, error);
        }
      }
      
      // Clear local state
      setItems([]);
      setSearchResults([]);
      
      // Refresh data to update stats
      await fetchData();
      
      showMessage("All items have been cleared successfully! Users remain intact.");
    } catch (error) {
      console.error("Error clearing items:", error);
      showMessage("Error clearing items. Please check console for details.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Clear search results
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  // Edit item form
  const openEditForm = (item) => {
    setEditingItem(item);
    setFormData({
      brand: item.brand,
      name: item.name,
      price: item.price.toString(),
      quantity: item.quantity.toString(),
      description: item.description
    });
    setShowEditForm(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({ brand: "", name: "", price: "", quantity: "", description: "" });
    setShowCreateForm(false);
    setShowEditForm(false);
    setEditingItem(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-indigo-100 to-purple-200 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-700">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-indigo-100 to-purple-200 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Message Display */}
        {message.show && (
          <div className={`mb-6 p-4 rounded-lg border-l-4 ${
            message.type === "error" 
              ? "bg-red-50 border-red-400 text-red-700" 
              : "bg-green-50 border-green-400 text-green-700"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {message.type === "error" ? (
                  <span className="text-red-500 mr-2">⚠️</span>
                ) : (
                  <span className="text-green-500 mr-2">✅</span>
                )}
                <span className="font-medium">{message.text}</span>
              </div>
              <button
                onClick={() => setMessage({ text: "", type: "", show: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                ✖️
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-4xl font-bold text-gray-800">Inventory Dashboard</h1>
            <div className="text-right">
              <p className="text-sm text-gray-600">
                Last refresh: {lastRefresh.toLocaleTimeString()}
              </p>
              <p className="text-sm text-gray-500">
                Auto-refresh in: {refreshCountdown}s
              </p>
            </div>
          </div>
          
          {/* Stats Cards */}
          <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-gray-100 p-4 rounded-xl animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>}>
            <StatsCards stats={stats} notifications={notifications} />
          </Suspense>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              + Create New Item
            </button>
            <button
              onClick={fetchData}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
            >
              🔄 Refresh Data
            </button>
            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition"
            >
              🛒 Open Cart ({cart.items?.length || 0})
            </button>
            <button
              onClick={handleClearAllItems}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition"
              disabled={stats.total_items === 0}
            >
              🧹 Clear All Items
            </button>
            <button
              onClick={handleClearAllNotifications}
              className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition"
              disabled={notifications.length === 0}
            >
              🧹 Clear All Notifications
            </button>
            {(userRole === "admin" || userRole === "superadmin") && (
              <button
                onClick={() => setIsPayOpen(true)}
                className="bg-violet-600 text-white px-6 py-3 rounded-lg hover:bg-violet-700 transition"
              >
                💳 Pay
              </button>
            )}
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Search Items</h2>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search by brand, name, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleSearch}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition"
            >
              🔍 Search
            </button>
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition"
              >
                ✖️ Clear Search
              </button>
            )}
          </div>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Search Results:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((item, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold">{item.brand}</h4>
                    <p className="text-gray-600">{item.name}</p>
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">All Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left">Brand</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Price</th>
                  <th className="p-3 text-left">Quantity</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-semibold">{item.brand}</td>
                    <td className="p-3">{item.name}</td>
                    <td className="p-3">${item.price}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.in_stock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.in_stock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => addToCart(item.brand, 1)}
                          className="bg-amber-600 text-white px-3 py-1 rounded text-sm hover:bg-amber-700"
                        >
                          Add to Cart
                        </button>
                        <button
                          onClick={() => handleBuyItem(item.brand)}
                          disabled={!item.in_stock}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Buy
                        </button>
                        <button
                          onClick={() => openEditForm(item)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.brand)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Notifications</h2>
            <div className="space-y-3">
              {notifications.map((notification, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    notification.quantity < 3
                      ? "bg-red-100 border-red-500"
                      : "bg-green-100 border-green-500"
                  }`}
                >
                  <p
                    className={`font-semibold ${
                      notification.quantity < 3
                        ? "text-red-800"
                        : "text-green-800"
                    }`}
                  >
                    {notification.msg}
                  </p>
                  <p
                    className={`text-sm ${
                      notification.quantity < 3
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {notification.brand} - {notification.name} (Qty:{" "}
                    {notification.quantity})
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Item Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Create New Item</h2>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <input
                  type="text"
                  placeholder="Brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  rows="3"
                  required
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
                  >
                    Create Item
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {showEditForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Edit Item: {editingItem?.brand}</h2>
              <form onSubmit={handleUpdateItem} className="space-y-4">
                <input
                  type="text"
                  placeholder="Brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  rows="3"
                  required
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
                  >
                    Update Item
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cart Panel */}
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg">Loading cart...</div>
        </div>}>
          <CartPanel
            isCartOpen={isCartOpen}
            setIsCartOpen={setIsCartOpen}
            cart={cart}
            updateCartQty={updateCartQty}
            clearCart={clearCart}
            checkoutCart={checkoutCart}
            items={items}
            addToCart={addToCart}
          />
        </Suspense>

        {/* Pay Panel (Admin/Superadmin) */}
        {isPayOpen && (userRole === "admin" || userRole === "superadmin") && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-end z-50">
            <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Payment</h2>
                <button onClick={() => setIsPayOpen(false)} className="text-gray-500 hover:text-gray-700">✖️</button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Using items from your cart.</p>

              {/* Calculator */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium">Tax rate (%)</label>
                  <input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Discount (absolute)</label>
                  <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Method</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full p-2 border rounded">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={getQuote} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Get Quote</button>
                  <button onClick={chargePayment} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700" disabled={!quote}>Charge</button>
                </div>
              </div>

              {/* Quote details */}
              {quote && (
                <div className="bg-gray-50 rounded p-4 space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>${quote.subtotal}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span>${quote.tax}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>-${quote.discount}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total</span><span>${quote.total}</span></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
