import { useEffect, useState } from "react";

import axios from "axios";

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
} from "lucide-react";

import "./AdminDashboard.css";

const API_URL = "http://localhost:5000/api/products";
const ORDERS_API_URL = "http://localhost:5000/api/orders";
const ORDER_STATUSES = [
  "Placed",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Cancelled",
];

function AdminDashboard({ onBack, onLogout }) {

  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [editingId, setEditingId] = useState(null);

  // Customer order management
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersMessage, setOrdersMessage] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const [form, setForm] = useState({

    name: "",

    category: "",

    description: "",

    price: "",

    stock: "",

    image: "",

  });

  const token = sessionStorage.getItem("freshcart_token");

  const loadProducts = async () => {

    setLoading(true);

    setError("");

    try {

      const response = await axios.get(API_URL);

      setProducts(response.data);

    } catch (err) {

      setError("Unable to load products. Check whether the backend is running.");

    } finally {

      setLoading(false);

    }

  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const response = await axios.get(ORDERS_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setOrdersError(
        err.response?.data?.message ||
          "Unable to load orders. Check that you are logged in as an admin."
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    setOrdersError("");
    setOrdersMessage("");
    setUpdatingOrderId(orderId);

    try {
      const response = await axios.patch(
        `${ORDERS_API_URL}/${orderId}/status`,
        { status },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedOrder = response.data.order;

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
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

  useEffect(() => {
    loadProducts();
    loadOrders();
  }, []);

  const handleChange = (event) => {

    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));

  };

  const addProduct = async (event) => {

    event.preventDefault();

    setError("");

    setMessage("");

    try {

      await axios.post(

        API_URL,

        {

          ...form,

          price: Number(form.price),

          stock: Number(form.stock),

        },

        {

          headers: {

            Authorization: `Bearer ${token}`,

          },

        }

      );

      setForm({

        name: "",

        category: "",

        description: "",

        price: "",

        stock: "",

        image: "",

      });

      setMessage("Product added successfully.");

      await loadProducts();

    } catch (err) {

      setError(

        err.response?.data?.message ||

          "Could not add product. Check the backend and admin permissions."

      );

    }

  };

const editProduct = (product) => {

  setEditingId(product._id);

  setForm({

    name: product.name || "",

    category: product.category || "",

    description: product.description || "",

    price: product.price ?? "",

    stock: product.stock ?? "",

    image: product.image || "",

  });

  setMessage("Editing product: " + product.name);

  setError("");

  window.scrollTo({ top: 0, behavior: "smooth" });

};

const updateProduct = async (event) => {

  event.preventDefault();

  setError("");

  setMessage("");

  try {

    await axios.put(

      `${API_URL}/${editingId}`,

      {

        ...form,

        price: Number(form.price),

        stock: Number(form.stock),

      },

      {

        headers: {

          Authorization: `Bearer ${token}`,

        },

      }

    );

    setEditingId(null);

    setForm({

      name: "",

      category: "",

      description: "",

      price: "",

      stock: "",

      image: "",

    });

    setMessage("Product updated successfully.");

    await loadProducts();

  } catch (err) {

    setError(

      err.response?.data?.message || "Could not update product."

    );

  }

};

const cancelEdit = () => {

  setEditingId(null);

  setForm({

    name: "",

    category: "",

    description: "",

    price: "",

    stock: "",

    image: "",

  });

  setMessage("");

  setError("");

};

  const deleteProduct = async (productId) => {

    const confirmed = window.confirm(

      "Are you sure you want to delete this product?"

    );

    if (!confirmed) return;

    setError("");

    setMessage("");

    try {

      await axios.delete(`${API_URL}/${productId}`, {

        headers: {

          Authorization: `Bearer ${token}`,

        },

      });

      setMessage("Product deleted successfully.");

      await loadProducts();

    } catch (err) {

      setError(

        err.response?.data?.message ||

          "Could not delete product. Check the backend route and admin permissions."

      );

    }

  };

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

          <p>Manage your grocery products</p>

        </div>

        <div className="admin-header-actions">

          <button type="button" onClick={onBack} className="admin-secondary-btn">

            <ArrowLeft size={17} /> Storefront

          </button>

          <button type="button" onClick={onLogout} className="admin-logout-btn">

            <LogOut size={17} /> Logout

          </button>

        </div>

      </header>

      <main className="admin-content">

        <section className="admin-stats">

          <article className="admin-stat-card">

            <Package size={25} />

            <div>

              <p>Total Products</p>

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

              <p>Stock Value</p>

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

        {error && <p className="admin-alert admin-error">{error}</p>}

        {message && <p className="admin-alert admin-success">{message}</p>}

        <section className="admin-panel">

          <h2>

            <Plus size={21} /> Add Product

          </h2>

          <form

  className="admin-product-form"

  onSubmit={editingId ? updateProduct : addProduct}

>

            <label>

              Product Name

              <input

                name="name"

                value={form.name}

                onChange={handleChange}

                required

                placeholder="e.g. Fresh Apples"

              />

            </label>

            <label>

              Category

              <input

                name="category"

                value={form.category}

                onChange={handleChange}

                required

                placeholder="e.g. Fruits"

              />

            </label>

            <label>

              Price (₹)

              <input

                name="price"

                type="number"

                min="0"

                step="0.01"

                value={form.price}

                onChange={handleChange}

                required

              />

            </label>

            <label>

              Stock

              <input

                name="stock"

                type="number"

                min="0"

                value={form.stock}

                onChange={handleChange}

                required

              />

            </label>

            <label className="admin-form-wide">

              Image URL

              <input

                name="image"

                type="url"

                value={form.image}

                onChange={handleChange}

                placeholder="https://example.com/product.jpg"

              />

            </label>

            <label className="admin-form-wide">

              Description

              <textarea

                name="description"

                value={form.description}

                onChange={handleChange}

                placeholder="Enter product details"

                rows="3"

              />

            </label>

            <button className="admin-primary-btn" type="submit">

  {editingId ? "Save Changes" : <><Plus size={18} /> Add Product</>}

</button>

{editingId && (

  <button

    className="admin-secondary-btn"

    type="button"

    onClick={cancelEdit}

  >

    Cancel Edit

  </button>

)}

          </form>

        </section>

        <section className="admin-panel">

          <div className="admin-products-heading">

            <h2>Product Inventory</h2>

            <button

              type="button"

              className="admin-secondary-btn"

              onClick={loadProducts}

            >

              <RefreshCw size={16} /> Refresh

            </button>

          </div>

          {loading ? (

            <p>Loading products...</p>

          ) : products.length === 0 ? (

            <p>No products found.</p>

          ) : (

            <div className="admin-table-wrapper">

              <table className="admin-table">

                <thead>

                  <tr>

                    <th>Product</th>

                    <th>Category</th>

                    <th>Price</th>

                    <th>Stock</th>

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

                            />

                          )}

                          <span>{product.name}</span>

                        </div>

                      </td>

                      <td>{product.category}</td>

                      <td>₹{Number(product.price || 0).toFixed(2)}</td>

                      <td>{product.stock}</td>

                      <td>

                        <button

  type="button"

  className="admin-secondary-btn"

  onClick={() => editProduct(product)}

>

  Edit

</button>

                        <button

                          type="button"

                          className="admin-delete-btn"

                          onClick={() => deleteProduct(product._id)}

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


        <section className="admin-panel">
          <div className="admin-products-heading">
            <h2>
              <ShoppingBag size={21} /> Customer Orders
            </h2>
            <button
              type="button"
              className="admin-secondary-btn"
              onClick={loadOrders}
              disabled={ordersLoading}
            >
              <RefreshCw size={16} />
              {ordersLoading ? "Refreshing..." : "Refresh orders"}
            </button>
          </div>

          {ordersError && (
            <p className="admin-alert admin-error">{ordersError}</p>
          )}
          {ordersMessage && (
            <p className="admin-alert admin-success">{ordersMessage}</p>
          )}

          {ordersLoading ? (
            <p>Loading customer orders...</p>
          ) : orders.length === 0 ? (
            <p>No customer orders found.</p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id}>
                      <td title={order._id}>
                        #{String(order._id).slice(-8)}
                      </td>
                      <td>
                        <strong>{order.user?.name || "Customer"}</strong>
                        <br />
                        <small>{order.user?.email || "Email unavailable"}</small>
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
                      <td>₹{Number(order.totalAmount || 0).toFixed(2)}</td>
                      <td>
                        <div>{order.paymentStatus || "Not recorded"}</div>
                        <small>{order.paymentProvider || "—"}</small>
                      </td>
                      <td>
                        <select
                          value={order.status}
                          disabled={updatingOrderId === order._id}
                          onChange={(event) =>
                            updateOrderStatus(order._id, event.target.value)
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
                          <small>Saving...</small>
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
