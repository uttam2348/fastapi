import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

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
  const [refreshCountdown, setRefreshCountdown] = useState(30);
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

  // Get token for API calls (memoized)
  const getAuthHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json"
  }), []);

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
        axios.get("http://127.0.0.1:8000/items"),
        axios.get("http://127.0.0.1:8000/items/count"),
        axios.get("http://127.0.0.1:8000/notifications", { headers: getAuthHeaders() })
      ]);
      
      setItems(itemsRes.data);
      setStats(statsRes.data);
      setNotifications(notificationsRes.data.notifications || []);
      setLastRefresh(new Date());
      setRefreshCountdown(30);
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 403) {
        // User doesn't have permission for notifications
        setNotifications([]);
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchRole = useCallback(async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/auth/me", { headers: getAuthHeaders() });
      setUserRole(res.data?.role || "");
    } catch (e) {
      // ignore; role will remain empty
    }
  }, [getAuthHeaders]);

  // -------- CART API --------
  const fetchCart = useCallback(async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/cart", { headers: getAuthHeaders() });
      setCart(res.data);
    } catch (error) {
      console.error("Error fetching cart:", error);
    }
  }, [getAuthHeaders]);

  const addToCart = async (brand, quantity = 1) => {
    try {
      await axios.post(`http://127.0.0.1:8000/cart/add?brand=${encodeURIComponent(brand)}&quantity=${quantity}`, null, {
        headers: getAuthHeaders()
      });
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
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchData, fetchCart, fetchRole]);

  const updateCartQty = async (brand, quantity) => {
    try {
      await axios.post(`http://127.0.0.1:8000/cart/update?brand=${encodeURIComponent(brand)}&quantity=${quantity}`, null, {
        headers: getAuthHeaders()
      });
      await fetchCart();
    } catch (error) {
      console.error("Error updating cart:", error);
      showMessage(error.response?.data?.detail || "Error updating cart", "error");
    }
  };

  const clearCart = async () => {
    try {
      await axios.post("http://127.0.0.1:8000/cart/clear", null, { headers: getAuthHeaders() });
      await fetchCart();
      showMessage("Cart cleared");
    } catch (error) {
      console.error("Error clearing cart:", error);
      showMessage(error.response?.data?.detail || "Error clearing cart", "error");
    }
  };

  const checkoutCart = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:8000/cart/checkout", null, { headers: getAuthHeaders() });
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
      const res = await axios.post("http://127.0.0.1:8000/payments/quote", payload, { headers: getAuthHeaders() });
      setQuote(res.data);
    } catch (e) {
      setQuote(null);
      showMessage(e.response?.data?.detail || "Error getting quote", "error");
    }
  };

  const chargePayment = async () => {
    try {
      const payload = { items: buildCartItemsForPayment(), tax_rate: Number(taxRate) || 0, discount: Number(discount) || 0, method: payMethod };
      const res = await axios.post("http://127.0.0.1:8000/payments/charge", payload, { headers: getAuthHeaders() });
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
      const response = await axios.post("http://127.0.0.1:8000/items", formData, {
        headers: getAuthHeaders()
      });
      
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
      const response = await axios.put(`http://127.0.0.1:8000/items/${editingItem.brand}`, formData, {
        headers: getAuthHeaders()
      });
      
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
        await axios.delete(`http://127.0.0.1:8000/items/${brand}`, {
          headers: getAuthHeaders()
        });
        
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
      const response = await axios.post(`http://127.0.0.1:8000/items/buy/${brand}`);
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
      const response = await axios.get(`http://127.0.0.1:8000/items/search?q=${searchQuery}`);
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
      const response = await axios.delete("http://127.0.0.1:8000/notifications/clear", { 
        headers: getAuthHeaders() 
      });
      
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
      const itemsResponse = await axios.get("http://127.0.0.1:8000/items");
      const allItems = itemsResponse.data;
      
      // Delete each item one by one
      for (const item of allItems) {
        try {
          await axios.delete(`http://127.0.0.1:8000/items/${item.brand}`, {
            headers: getAuthHeaders()
          });
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-100 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-blue-800">Total Items</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.total_items || 0}</p>
            </div>
            <div className="bg-green-100 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-green-800">In Stock</h3>
              <p className="text-3xl font-bold text-green-600">{stats.in_stock || 0}</p>
            </div>
            <div className="bg-red-100 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-red-800">Out of Stock</h3>
              <p className="text-3xl font-bold text-red-600">{stats.out_of_stock || 0}</p>
            </div>
            <div className="bg-purple-100 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-purple-800">Notifications</h3>
              <p className="text-3xl font-bold text-purple-600">{notifications.length}</p>
            </div>
          </div>

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
                <div key={index} className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                  <p className="font-semibold text-yellow-800">{notification.msg}</p>
                  <p className="text-sm text-yellow-600">
                    {notification.brand} - {notification.name} (Qty: {notification.quantity})
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
        {isCartOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-end z-50">
            <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Your Cart</h2>
                <button onClick={() => setIsCartOpen(false)} className="text-gray-500 hover:text-gray-700">✖️</button>
              </div>
              {(!cart.items || cart.items.length === 0) ? (
                <p className="text-gray-600">Your cart is empty.</p>
              ) : (
                <div className="space-y-4">
                  {cart.items.map((ci, idx) => (
                    <div key={idx} className="border rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{ci.brand}</p>
                        <p className="text-sm text-gray-500">{ci.name}</p>
                        <p className="text-sm text-gray-700">${ci.price}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQty(ci.brand, Math.max(0, (ci.quantity || 1) - 1))}
                          className="px-2 py-1 bg-gray-200 rounded"
                        >-</button>
                        <input
                          type="number"
                          min="0"
                          value={ci.quantity}
                          onChange={(e) => updateCartQty(ci.brand, Math.max(0, parseInt(e.target.value || '0', 10)))}
                          className="w-16 p-1 border rounded text-center"
                        />
                        <button
                          onClick={() => updateCartQty(ci.brand, (ci.quantity || 1) + 1)}
                          className="px-2 py-1 bg-gray-200 rounded"
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button onClick={clearCart} className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700">Clear Cart</button>
                <button onClick={checkoutCart} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">Checkout</button>
              </div>
            </div>
          </div>
        )}

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
