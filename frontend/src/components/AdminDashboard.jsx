import { useEffect, useState, useCallback } from "react";
import {
  Package,
  IndianRupee,
  Boxes,
  Plus,
  Trash2,
  RefreshCw,
  ArrowLeft,
  LogOut,
  ShoppingBag,
  Loader2,
  Database,
  CheckCircle2,
} from "lucide-react";
import "./AdminDashboard.css";

import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchAllOrders,
  updateOrderStatus as apiUpdateOrderStatus,
} from "../services/api";

const ORDER_STATUSES = [
  "Placed",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Cancelled",
];

const STANDARD_CATEGORIES = [
  "Fruits",
  "Vegetables",
  "Dairy",
  "Bakery",
  "Snacks",
  "Beverages",
];

const EMPTY_FORM = {
  name: "",
  category: "Fruits",
  customCategory: "",
  description: "",
  price: "",
  stock: "",
  image: "",
};

/**
 * AdminDashboard
 *
 * Props:
 *  onBack            — navigates to the storefront WITHOUT logging out.
 *  onLogout          — clears auth and sends back to storefront.
 *  onProductsChanged — callback to notify storefront of additions/updates/deletions.
 */
function AdminDashboard({ onBack, onLogout, onProductsChanged }) {
  // ── Products state ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Track in-flight request state
  const [submitting, setSubmitting] = useState(false);

  // ── Orders state ────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [ordersMessage, setOrdersMessage] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchProducts();
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch {
      setError("Unable to load products. Check whether the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const response = await fetchAllOrders();
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setOrdersError(
        err.response?.data?.message ||
          "Unable to load orders. Check that you are logged in as an admin."
      );
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function initDashboard() {
      try {
        const [prodRes, ordersRes] = await Promise.allSettled([
          fetchProducts(),
          fetchAllOrders(),
        ]);
        if (ignore) return;
        if (prodRes.status === "fulfilled") {
          setProducts(Array.isArray(prodRes.value.data) ? prodRes.value.data : []);
        } else {
          setError("Unable to load products from MongoDB. Check backend status.");
        }
        if (ordersRes.status === "fulfilled") {
          setOrders(Array.isArray(ordersRes.value.data) ? ordersRes.value.data : []);
        } else {
          setOrdersError(
            ordersRes.reason?.response?.data?.message ||
              "Unable to load orders. Check admin permissions."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setOrdersLoading(false);
        }
      }
    }
    initDashboard();
    return () => {
      ignore = true;
    };
  }, []);

  // ── Form handlers ───────────────────────────────────────────────────────────

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategorySelect = (event) => {
    const val = event.target.value;
    if (val === "__custom__") {
      setIsCustomCategory(true);
      setForm((prev) => ({ ...prev, category: prev.customCategory || "" }));
    } else {
      setIsCustomCategory(false);
      setForm((prev) => ({ ...prev, category: val }));
    }
  };

  /** Add a brand-new product with explicit DB persistence verification. */
  const addProduct = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setMessage("");

    const categoryToSave = isCustomCategory
      ? form.customCategory.trim()
      : form.category.trim();

    if (!categoryToSave) {
      setError("Please select or enter a valid category.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await createProduct({
        name: form.name.trim(),
        category: categoryToSave,
        description: (form.description || "").trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        image: (form.image || "").trim(),
      });

      const saved = response.data?.product || response.data;
      if (!saved || !saved._id) {
        throw new Error("Product was not saved to MongoDB Atlas.");
      }

      setForm(EMPTY_FORM);
      setIsCustomCategory(false);
      setMessage(
        `✓ Product "${saved.name}" added successfully (ID: ${saved._id}).`
      );

      await loadProducts()
      if (onProductsChanged) onProductsChanged();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not add product. Check backend connection and admin permissions."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Populate the form with an existing product's data for editing. */
  const editProduct = (product) => {
    setEditingId(product._id);
    const isStandard = STANDARD_CATEGORIES.includes(product.category);
    setIsCustomCategory(!isStandard);

    setForm({
      name: product.name || "",
      category: isStandard ? product.category : product.category,
      customCategory: isStandard ? "" : product.category,
      description: product.description || "",
      price: product.price ?? "",
      stock: product.stock ?? "",
      image: product.image || "",
    });
    setMessage(`Editing product: "${product.name}"`);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Save changes to an existing product in MongoDB. */
  const saveProduct = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setMessage("");

    const categoryToSave = isCustomCategory
      ? form.customCategory.trim()
      : form.category.trim();

    if (!categoryToSave) {
      setError("Please select or enter a valid category.");
      return;
    }

    setSubmitting(true);

    try {
      await updateProduct(editingId, {
        name: form.name.trim(),
        category: categoryToSave,
        description: (form.description || "").trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        image: (form.image || "").trim(),
      });

      setEditingId(null);
      setForm(EMPTY_FORM);
      setIsCustomCategory(false);
      setMessage("✓ Product updated successfully.");

      await loadProducts();
      if (onProductsChanged) onProductsChanged();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update product.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsCustomCategory(false);
    setMessage("");
    setError("");
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}" from MongoDB Atlas?`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await deleteProduct(productId);
      setMessage(`✓ Product "${productName}" deleted from DB.`);
      await loadProducts();
      if (onProductsChanged) onProductsChanged();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not delete product. Check backend route and permissions."
      );
    }
  };

  // ── Order handlers ──────────────────────────────────────────────────────────

  const handleUpdateOrderStatus = async (orderId, status) => {
    setOrdersError("");
    setOrdersMessage("");
    setUpdatingOrderId(orderId);

    try {
      const response = await apiUpdateOrderStatus(orderId, status);
      const updatedOrder = response.data.order;

      setOrders((current) =>
        current.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      );
      setOrdersMessage(response.data.message || "Order status updated.");
    } catch (err) {
      setOrdersError(
        err.response?.data?.message || "Unable to update order status."
      );
      await loadOrders();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalStock = products.reduce(
    (total, product) => total + Number(product.stock || 0),
    0
  );

  const totalValue = products.reduce(
    (total, product) =>
      total + Number(product.price || 0) * Number(product.stock || 0),
    0
  );

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>FreshCart Admin</h1>
          <p>Product Inventory & Customer Orders Management</p>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            onClick={onBack}
            className="admin-secondary-btn"
          >
            <ArrowLeft size={17} /> Storefront
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="admin-logout-btn"
          >
            <LogOut size={17} /> Logout
          </button>
        </div>
      </header>

      <main className="admin-content">
        {/* Stats */}
        <section className="admin-stats">
          <article className="admin-stat-card">
            <Package size={25} />
            <div>
              <p>Total Products (MongoDB)</p>
              <h2>{products.length}</h2>
            </div>
          </article>

          <article className="admin-stat-card">
            <Boxes size={25} />
            <div>
              <p>Total Stock Units</p>
              <h2>{totalStock}</h2>
            </div>
          </article>

          <article className="admin-stat-card">
            <IndianRupee size={25} />
            <div>
              <p>Total Inventory Value</p>
              <h2>
                {totalValue.toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 2,
                })}
              </h2>
            </div>
          </article>
        </section>

        {/* Global product alerts */}
        {error && <p className="admin-alert admin-error">{error}</p>}
        {message && (
          <p className="admin-alert admin-success">
            <CheckCircle2 size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {message}
          </p>
        )}

        {/* Add / Edit product form */}
        <section className="admin-panel">
          <h2>
            <Plus size={21} /> {editingId ? "Edit Product" : "Add New Product to MongoDB"}
          </h2>

          <form
            className="admin-product-form"
            onSubmit={editingId ? saveProduct : addProduct}
          >
            <label>
              Product Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. Kashmiri Apples"
                disabled={submitting}
              />
            </label>

            <label>
              Category *
              <select
                value={isCustomCategory ? "__custom__" : form.category}
                onChange={handleCategorySelect}
                disabled={submitting}
              >
                {STANDARD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__custom__">+ Other (Enter Custom Category)</option>
              </select>
            </label>

            {isCustomCategory && (
              <label>
                Custom Category Name *
                <input
                  name="customCategory"
                  value={form.customCategory}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Organic Herbs"
                  disabled={submitting}
                />
              </label>
            )}

            <label>
              Price (₹) *
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
                placeholder="0.00"
                disabled={submitting}
              />
            </label>

            <label>
              Stock Units Available *
              <input
                name="stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={handleChange}
                required
                placeholder="e.g. 50"
                disabled={submitting}
              />
            </label>

            <label className="admin-form-wide">
              Product Image URL
              <input
                name="image"
                type="url"
                value={form.image}
                onChange={handleChange}
                placeholder="https://images.unsplash.com/photo-..."
                disabled={submitting}
              />
            </label>

            <label className="admin-form-wide">
              Product Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Enter fresh grocery product description"
                rows="3"
                disabled={submitting}
              />
            </label>

            <div className="admin-form-actions admin-form-wide" style={{ display: "flex", gap: 10 }}>
              <button
                className="admin-primary-btn"
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={17} className="admin-spin" /> Saving to DB…
                  </>
                ) : editingId ? (
                  "Save Changes"
                ) : (
                  <>
                    <Database size={17} /> Save Product
                  </>
                )}
              </button>

              {editingId && (
                <button
                  className="admin-secondary-btn"
                  type="button"
                  onClick={cancelEdit}
                  disabled={submitting}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Product inventory table */}
        <section className="admin-panel">
          <div className="admin-products-heading">
            <h2>Product Inventory ({products.length} products in MongoDB)</h2>
            <button
              type="button"
              className="admin-secondary-btn"
              onClick={loadProducts}
              disabled={loading}
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loading ? (
            <p>Loading products from MongoDB Atlas…</p>
          ) : products.length === 0 ? (
            <p>No products found in MongoDB. Add your first product above.</p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>MongoDB ID</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product._id || product.id}>
                      <td>
                        <div className="admin-product-cell">
                          {product.image && (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="admin-product-image"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src =
                                  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&auto=format&fit=crop&q=80";
                              }}
                            />
                          )}
                          <strong>{product.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="admin-category-badge">{product.category}</span>
                      </td>
                      <td>₹{Number(product.price || 0).toFixed(2)}</td>
                      <td>
                        <span
                          style={{
                            color: product.stock > 0 ? "#166e3e" : "#b91c1c",
                            fontWeight: 700,
                          }}
                        >
                          {product.stock} {product.stock === 0 ? "(Out of stock)" : "units"}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: 11, background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                          {String(product._id || "").slice(-8)}
                        </code>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-secondary-btn"
                          onClick={() => editProduct(product)}
                          style={{ marginRight: 6 }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-delete-btn"
                          onClick={() => handleDeleteProduct(product._id, product.name)}
                          disabled={!product._id}
                          aria-label={`Delete ${product.name}`}
                        >
                          <Trash2 size={17} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Customer orders panel */}
        <section className="admin-panel">
          <div className="admin-products-heading">
            <h2>
              <ShoppingBag size={21} /> Customer Orders ({orders.length})
            </h2>
            <button
              type="button"
              className="admin-secondary-btn"
              onClick={loadOrders}
              disabled={ordersLoading}
            >
              <RefreshCw size={16} />
              {ordersLoading ? "Refreshing…" : "Refresh orders"}
            </button>
          </div>

          {ordersError && (
            <p className="admin-alert admin-error">{ordersError}</p>
          )}
          {ordersMessage && (
            <p className="admin-alert admin-success">{ordersMessage}</p>
          )}

          {ordersLoading ? (
            <p>Loading customer orders from MongoDB…</p>
          ) : orders.length === 0 ? (
            <p>No customer orders placed yet.</p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Items Ordered</th>
                    <th>Date & Time</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Delivery Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id}>
                      <td>
                        <strong>#{String(order._id).slice(-8).toUpperCase()}</strong>
                      </td>
                      <td>
                        <strong>{order.customerName || order.user?.name || "Customer"}</strong>
                        <br />
                        <small>{order.customerPhone || order.user?.email || "No contact"}</small>
                      </td>
                      <td>
                        {Array.isArray(order.items) && order.items.length > 0
                          ? order.items
                              .map(
                                (item) =>
                                  `${item.name || "Product"} × ${item.quantity}`
                              )
                              .join(", ")
                          : "No item details"}
                      </td>
                      <td>
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString("en-IN")
                          : "—"}
                      </td>
                      <td>
                        <strong>₹{Number(order.totalAmount || 0).toFixed(2)}</strong>
                      </td>
                      <td>
                        <span
                          style={{
                            background: order.paymentStatus === "Paid" ? "#dcfce7" : "#fef3c7",
                            color: order.paymentStatus === "Paid" ? "#166e3e" : "#92400e",
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {order.paymentStatus || "Pending"}
                        </span>
                        <br />
                        <small>{order.paymentProvider || "COD"}</small>
                      </td>
                      <td>
                        <select
                          value={order.status}
                          disabled={updatingOrderId === order._id}
                          onChange={(event) =>
                            handleUpdateOrderStatus(
                              order._id,
                              event.target.value
                            )
                          }
                          aria-label={`Status for order ${String(order._id).slice(-8)}`}
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        {updatingOrderId === order._id && (
                          <small> Saving…</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminDashboard;
