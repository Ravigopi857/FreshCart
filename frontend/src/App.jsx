import Auth from "./components/Auth";
import AdminDashboard from "./components/AdminDashboard";
import CheckoutModal from "./components/cart/CheckoutModal";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search,
  ShoppingCart,
  MapPin,
  ChevronDown,
  Leaf,
  Truck,
  ShieldCheck,
  Clock,
  Plus,
  Minus,
  X,
  Menu,
  Heart,
  ArrowRight,
  RefreshCw,
  ShoppingBasket,
  LayoutDashboard,
} from "lucide-react";
import "./App.css";

import {
  fetchProducts as apiFetchProducts,
  fetchMyOrders as apiFetchMyOrders,
} from "./services/api";
import { getSavedUser, clearAuth } from "./utils/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

const categories = [
  { name: "All", emoji: "🛒" },
  { name: "Fruits", emoji: "🍎" },
  { name: "Vegetables", emoji: "🥦" },
  { name: "Dairy", emoji: "🥛" },
  { name: "Bakery", emoji: "🥐" },
  { name: "Snacks", emoji: "🍪" },
  { name: "Beverages", emoji: "🥤" },
];

const fallbackProducts = [
  {
    _id: "demo-1",
    name: "Fresh Apples",
    category: "Fruits",
    description: "Crisp and naturally sweet",
    price: 150,
    stock: 30,
    image:
      "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80",
  },
  {
    _id: "demo-2",
    name: "Organic Broccoli",
    category: "Vegetables",
    description: "Fresh green goodness",
    price: 80,
    stock: 25,
    image:
      "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&auto=format&fit=crop&q=80",
  },
  {
    _id: "demo-3",
    name: "Farm Fresh Milk",
    category: "Dairy",
    description: "Fresh and creamy",
    price: 60,
    stock: 20,
    image:
      "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&auto=format&fit=crop&q=80",
  },
  {
    _id: "demo-4",
    name: "Sweet Oranges",
    category: "Fruits",
    description: "Juicy citrus freshness",
    price: 120,
    stock: 35,
    image:
      "https://images.unsplash.com/photo-1547514701-42782101795e?w=600&auto=format&fit=crop&q=80",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getImage(product) {
  if (product.image && !product.image.includes("example.com")) {
    return product.image;
  }
  const categoryImages = {
    fruits:
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&auto=format&fit=crop&q=80",
    vegetables:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
    dairy:
      "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&auto=format&fit=crop&q=80",
    bakery:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80",
    snacks:
      "https://images.unsplash.com/photo-1621939514649-280e2aa2c2a6?w=600&auto=format&fit=crop&q=80",
    beverages:
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&auto=format&fit=crop&q=80",
  };
  return (
    categoryImages[product.category?.toLowerCase()] ||
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80"
  );
}

function stripDemoItems(cartItems) {
  return cartItems.filter(
    (item) => item._id && !String(item._id).startsWith("demo-")
  );
}

function matchCategory(productCategory, activeCategory) {
  if (activeCategory === "All") return true;
  const pCat = (productCategory || "").trim().toLowerCase();
  const aCat = (activeCategory || "").trim().toLowerCase();

  if (pCat === aCat) return true;

  if (aCat === "fruits" && (pCat === "fruit" || pCat === "fruits")) return true;
  if (aCat === "vegetables" && (pCat === "vegetable" || pCat === "vegetables")) return true;
  if (aCat === "snacks" && (pCat === "snack" || pCat === "snacks")) return true;
  if (aCat === "beverages" && (pCat === "beverage" || pCat === "beverages" || pCat === "bevereges")) return true;

  return false;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [loggedInUser, setLoggedInUser] = useState(() => getSavedUser());
  const [showAuth, setShowAuth] = useState(false);
  const [adminViewingStorefront, setAdminViewingStorefront] = useState(false);

  // ── Products ──────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("freshcart_cart")) || [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);

  // ── Checkout Modal State ───────────────────────────────────────────────────
  const [showCheckout, setShowCheckout] = useState(false);

  // ── My Orders ─────────────────────────────────────────────────────────────
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);
  const [myOrdersError, setMyOrdersError] = useState("");

  // ── UI Misc ───────────────────────────────────────────────────────────────
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [notice, setNotice] = useState("");

  // ── Product Loader (Synchronizes Storefront with MongoDB Atlas) ───────────
  const reloadProducts = useCallback(async () => {
    try {
      const response = await apiFetchProducts();
      const realProducts = Array.isArray(response.data) ? response.data : [];
      setProducts(realProducts);
      setApiError(false);
      if (realProducts.length > 0) {
        setCart((prev) => stripDemoItems(prev));
      }
    } catch (err) {
      console.error("Failed to load products from API:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let ignore = false;
    async function loadInitialProducts() {
      try {
        const response = await apiFetchProducts();
        if (ignore) return;
        const realProducts = Array.isArray(response.data) ? response.data : [];
        setProducts(realProducts);
        setApiError(false);
        if (realProducts.length > 0) {
          setCart((prev) => stripDemoItems(prev));
        }
      } catch (err) {
        if (!ignore) {
          console.error("Failed to load initial products from API:", err);
          setApiError(true);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadInitialProducts();
    return () => {
      ignore = true;
    };
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("freshcart_cart", JSON.stringify(cart));
    } catch (error) {
      console.error("Unable to save FreshCart cart:", error);
    }
  }, [cart]);

  // Derived state
  const displayProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = apiError ? fallbackProducts : products;
    return source.filter((product) => {
      const name = (product.name || "").toLowerCase();
      const category = (product.category || "").toLowerCase();
      const description = (product.description || "").toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        category.includes(query) ||
        description.includes(query);

      const matchesCategory = matchCategory(product.category, activeCategory);
      return matchesSearch && matchesCategory;
    });
  }, [products, apiError, search, activeCategory]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  }

  // ── Cart Actions ──────────────────────────────────────────────────────────
  function addToCart(product) {
    if (product.stock <= 0) {
      showNotice("Sorry, this product is out of stock.");
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item._id === product._id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          showNotice("You have reached the available stock limit.");
          return current;
        }
        return current.map((item) =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    showNotice(`✓ ${product.name} added to cart`);
  }

  function changeQuantity(id, amount) {
    setCart((current) =>
      current
        .map((item) =>
          item._id === id
            ? {
                ...item,
                quantity: Math.min(
                  item.stock,
                  Math.max(0, item.quantity + amount)
                ),
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  // ── Auth Actions ──────────────────────────────────────────────────────────
  function handleLoginSuccess(user) {
    setLoggedInUser(user);
    setShowAuth(false);
    setAdminViewingStorefront(false);
    reloadProducts();
  }

  function handleLogout() {
    clearAuth();
    setLoggedInUser(null);
    setShowAuth(false);
    setAdminViewingStorefront(false);
    setCart([]);
    showNotice("You have been logged out.");
  }

  // ── My Orders ─────────────────────────────────────────────────────────────
  const openMyOrders = useCallback(async () => {
    if (!loggedInUser) {
      setShowAuth(true);
      showNotice("Please log in to view your orders.");
      return;
    }
    setShowMyOrders(true);
    setMyOrdersLoading(true);
    setMyOrdersError("");
    try {
      const response = await apiFetchMyOrders();
      setMyOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setMyOrdersError(
        error.response?.data?.message ||
          "Unable to load your orders. Please try again."
      );
    } finally {
      setMyOrdersLoading(false);
    }
  }, [loggedInUser]);

  // ── Views / Routing ───────────────────────────────────────────────────────
  if (
    loggedInUser?.role === "admin" &&
    !showAuth &&
    !adminViewingStorefront
  ) {
    return (
      <AdminDashboard
        onBack={() => {
          setAdminViewingStorefront(true);
          reloadProducts();
        }}
        onLogout={handleLogout}
        onProductsChanged={reloadProducts}
      />
    );
  }

  if (showAuth) {
    return (
      <Auth
        onClose={() => setShowAuth(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // ── Customer Storefront ───────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <div className="announcement">
        <Leaf size={15} />
        <span>Fresh groceries, happier days.</span>
        <span className="announcement-extra">Free delivery on orders over ₹499</span>
      </div>

      <header className="site-header">
        <div className="header-main page-container">
          <a className="brand" href="#home" aria-label="FreshCart home">
            <span className="brand-icon">
              <ShoppingBasket size={25} />
            </span>
            <span>
              Fresh<span>Cart</span>
              <small>GOOD FOOD. GOOD MOOD.</small>
            </span>
          </a>

          <button
            type="button"
            className="delivery-location"
            onClick={() => setLocationOpen(true)}
          >
            <MapPin size={19} />
            <div>
              <small>Delivering to</small>
              <strong>{deliveryAddress || "Your location"}</strong>
            </div>
            <ChevronDown size={16} />
          </button>

          <form
            className="search-box"
            onSubmit={(event) => {
              event.preventDefault();
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Search size={20} />
            <input
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                if (value.trim()) {
                  document
                    .getElementById("products")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              placeholder="Search fruits, vegetables, groceries…"
              aria-label="Search products"
            />
            {search && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={17} />
              </button>
            )}
          </form>

          {loggedInUser && loggedInUser.role !== "admin" && (
            <button
              type="button"
              className="cart-button"
              onClick={openMyOrders}
            >
              <span className="cart-button-text">My Orders</span>
            </button>
          )}

          {/* Admin Dashboard Quick-Switch Button */}
          {loggedInUser?.role === "admin" && adminViewingStorefront && (
            <button
              type="button"
              className="cart-button"
              style={{ background: "#e8f7ed", color: "#18864b", borderColor: "#bce2c7" }}
              onClick={() => {
                setAdminViewingStorefront(false);
                reloadProducts();
              }}
            >
              <LayoutDashboard size={17} />
              <span className="cart-button-text">Admin Dashboard</span>
            </button>
          )}

          <button
            className="cart-button"
            onClick={() => setCartOpen(true)}
            aria-label="Open shopping cart"
          >
            <ShoppingCart size={21} />
            <span className="cart-button-text">My Cart</span>
            <span className="cart-count">{cartCount}</span>
          </button>

          <button
            type="button"
            className="cart-button"
            onClick={() => {
              if (loggedInUser) {
                handleLogout();
              } else {
                setShowAuth(true);
              }
            }}
          >
            <span className="cart-button-text">
              {loggedInUser ? "Logout" : "Login / Sign up"}
            </span>
          </button>

          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <Menu />
          </button>
        </div>

        <nav className={`category-nav ${mobileMenuOpen ? "mobile-open" : ""}`}>
          <div className="page-container nav-inner">
            <a className="nav-home" href="#home">Home</a>
            {categories.slice(1).map((category) => (
              <button
                key={category.name}
                onClick={() => {
                  setActiveCategory(category.name);
                  setMobileMenuOpen(false);
                  document
                    .getElementById("products")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {category.name}
              </button>
            ))}
            <a className="offers-link" href="#offers">
              <Heart size={15} /> Today&apos;s offers
            </a>
          </div>
        </nav>
      </header>

      <main id="home">
        {/* Hero Section */}
        <section className="hero-section page-container">
          <div className="hero-copy">
            <div className="hero-pill">
              <Leaf size={15} /> FRESHNESS AT YOUR DOORSTEP
            </div>
            <h1>
              Good food.
              <br />
              <span>Good life.</span>
            </h1>
            <p>
              Farm-fresh fruits, crisp vegetables, and everyday essentials.
              Everything you love, delivered with care.
            </p>
            <a className="primary-button" href="#products">
              Shop groceries <ArrowRight size={18} />
            </a>
            <div className="hero-trust">
              <span>
                <ShieldCheck size={17} /> Quality checked
              </span>
              <span>
                <Leaf size={17} /> Fresh picks daily
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-frame">
              <img
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1100&auto=format&fit=crop&q=85"
                alt="Fresh colourful fruits and vegetables"
              />
            </div>
            <div className="floating-card floating-card-top">
              <span className="floating-icon">🌱</span>
              <div>
                <strong>100% Fresh</strong>
                <small>Handpicked for you</small>
              </div>
            </div>
            <div className="floating-card floating-card-bottom">
              <span className="delivery-icon">
                <Truck size={22} />
              </span>
              <div>
                <strong>Quick delivery</strong>
                <small>Freshness on the way</small>
              </div>
            </div>
            <div className="hero-decoration hero-decoration-one" />
            <div className="hero-decoration hero-decoration-two" />
          </div>
        </section>

        {/* Benefits Section */}
        <section className="benefits page-container" id="offers">
          <div className="benefit-item">
            <span className="benefit-icon green"><Truck size={22} /></span>
            <div>
              <strong>Convenient delivery</strong>
              <small>Grocery shopping made easy</small>
            </div>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon yellow"><Leaf size={22} /></span>
            <div>
              <strong>Freshness guaranteed</strong>
              <small>Carefully selected products</small>
            </div>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon pink"><ShieldCheck size={22} /></span>
            <div>
              <strong>Quality you can trust</strong>
              <small>Shopping with confidence</small>
            </div>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon blue"><Clock size={22} /></span>
            <div>
              <strong>Everyday essentials</strong>
              <small>All in one place</small>
            </div>
          </div>
        </section>

        {/* Category Section */}
        <section className="category-section page-container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EXPLORE OUR STORE</span>
              <h2>Shop by category</h2>
              <p>Your everyday favourites, all in one place.</p>
            </div>
            <a href="#products" className="text-link">
              Explore products <ArrowRight size={17} />
            </a>
          </div>
          <div className="category-grid">
            {categories.slice(1).map((category, index) => (
              <button
                key={category.name}
                className={`category-card category-color-${index + 1} ${
                  activeCategory === category.name ? "selected" : ""
                }`}
                onClick={() =>
                  setActiveCategory((current) =>
                    current === category.name ? "All" : category.name
                  )
                }
              >
                <span className="category-emoji">{category.emoji}</span>
                <strong>{category.name}</strong>
                <span className="category-arrow">
                  <ArrowRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Products Section */}
        <section className="products-section" id="products">
          <div className="page-container">
            <div className="section-heading product-heading">
              <div>
                <span className="eyebrow">PICKED FOR YOUR KITCHEN</span>
                <h2>Fresh finds for you</h2>
                <p>Good ingredients make great meals.</p>
              </div>
              <div className="product-filters">
                {categories.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    className={
                      activeCategory === category.name ? "filter-active" : ""
                    }
                    onClick={() => setActiveCategory(category.name)}
                  >
                    {category.name === "All" ? "All products" : category.name}
                  </button>
                ))}
              </div>
            </div>

            {apiError && (
              <div className="api-notice">
                <RefreshCw size={17} />
                The backend is unavailable. Showing sample products instead.
                Start your backend to load your MongoDB products.
              </div>
            )}

            {loading ? (
              <div className="loading-state">
                <RefreshCw className="spin" size={27} />
                <p>Finding your fresh favourites…</p>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="empty-products">
                <span>🥬</span>
                <h3>No products found</h3>
                <p>Try another search or choose a different category.</p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("All");
                  }}
                >
                  Show all products
                </button>
              </div>
            ) : (
              <div className="product-grid">
                {displayProducts.map((product) => {
                  const cartItem = cart.find((item) => item._id === product._id);
                  const outOfStock = product.stock <= 0;
                  return (
                    <article className="product-card" key={product._id}>
                      <div className="product-image-wrap">
                        <img
                          src={getImage(product)}
                          alt={product.name}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src =
                              "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80";
                          }}
                        />
                        <span className="fresh-tag">Fresh pick</span>
                      </div>
                      <div className="product-info">
                        <span className="product-category">
                          {product.category}
                        </span>
                        <h3>{product.name}</h3>
                        <p className="product-description">
                          {product.description || "Freshness in every bite"}
                        </p>
                        <div className="product-card-bottom">
                          <div className="product-price">
                            <strong>
                              ₹{Number(product.price).toLocaleString("en-IN")}
                            </strong>
                            <small> / unit</small>
                          </div>
                          {cartItem ? (
                            <div className="quantity-control">
                              <button
                                onClick={() => changeQuantity(product._id, -1)}
                                aria-label={`Remove one ${product.name}`}
                              >
                                <Minus size={15} />
                              </button>
                              <span>{cartItem.quantity}</span>
                              <button
                                onClick={() => addToCart(product)}
                                disabled={cartItem.quantity >= product.stock}
                                aria-label={`Add one ${product.name}`}
                              >
                                <Plus size={15} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="add-button"
                              disabled={outOfStock}
                              onClick={() => addToCart(product)}
                            >
                              <Plus size={17} />
                              {outOfStock ? "Sold out" : "Add"}
                            </button>
                          )}
                        </div>
                        <p className="stock-note">
                          {outOfStock
                            ? "Currently unavailable"
                            : `${product.stock} available`}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!loading && !apiError && products.length > 0 && (
              <p className="database-note">
                <span className="live-dot" />
                Showing {displayProducts.length} products loaded live from your MongoDB database
              </p>
            )}
          </div>
        </section>

        {/* Bottom Banner */}
        <section className="bottom-banner page-container">
          <div className="bottom-banner-copy">
            <span className="eyebrow">A LITTLE FRESHNESS GOES A LONG WAY</span>
            <h2>Make room for better groceries.</h2>
            <p>Discover your next kitchen favourite with FreshCart.</p>
            <a href="#products" className="banner-button">
              Start shopping <ArrowRight size={18} />
            </a>
          </div>
          <div className="banner-emoji" aria-hidden="true">
            🥑🍊🥦
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-container footer-inner">
          <a className="brand footer-brand" href="#home">
            <span className="brand-icon">
              <ShoppingBasket size={24} />
            </span>
            <span>
              Fresh<span>Cart</span>
              <small>GOOD FOOD. GOOD MOOD.</small>
            </span>
          </a>
          <p>Bringing a little more freshness to your everyday life.</p>
          <span className="copyright">© 2026 FreshCart</span>
        </div>
      </footer>

      {/* Toast Notice */}
      {notice && <div className="toast-message">{notice}</div>}

      {/* My Orders Modal */}
      {showMyOrders && (
        <div
          className="cart-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowMyOrders(false);
          }}
        >
          <section
            className="location-modal"
            style={{ width: "min(780px, 94vw)", maxHeight: "85vh", overflowY: "auto" }}
          >
            <div className="drawer-heading">
              <div>
                <span className="eyebrow">FRESHCART ACCOUNT</span>
                <h2>My Orders ({myOrders.length})</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowMyOrders(false)}
                aria-label="Close orders"
              >
                <X />
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button
                type="button"
                className="text-link"
                onClick={openMyOrders}
                disabled={myOrdersLoading}
              >
                <RefreshCw size={15} />{" "}
                {myOrdersLoading ? "Refreshing…" : "Refresh orders"}
              </button>
            </div>
            {myOrdersLoading ? (
              <div className="loading-state">
                <RefreshCw className="spin" size={25} />
                <p>Loading your orders from MongoDB…</p>
              </div>
            ) : myOrdersError ? (
              <div className="api-notice">
                <p>{myOrdersError}</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={openMyOrders}
                >
                  Try again
                </button>
              </div>
            ) : myOrders.length === 0 ? (
              <div className="empty-cart">
                <span>📦</span>
                <h3>No orders yet</h3>
                <p>Your completed grocery orders will appear here.</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setShowMyOrders(false)}
                >
                  Continue shopping
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {myOrders.map((order) => (
                  <article
                    key={order._id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 16,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <strong>
                          Order #{String(order._id || "").slice(-8).toUpperCase()}
                        </strong>
                        <p style={{ margin: "5px 0", color: "#6b7280", fontSize: 13 }}>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString("en-IN")
                            : "Date unavailable"}
                        </p>
                      </div>
                      <span
                        style={{
                          background:
                            order.status === "Delivered"
                              ? "#dcfce7"
                              : order.status === "Cancelled"
                              ? "#fee2e2"
                              : "#fef3c7",
                          color: "#374151",
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {order.status || "Placed"}
                      </span>
                    </div>
                    <div style={{ margin: "12px 0", display: "grid", gap: 7 }}>
                      {(order.items || []).map((item, index) => (
                        <div
                          key={`${item.product || item._id || item.name}-${index}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            fontSize: 14,
                          }}
                        >
                          <span>
                            {item.name || "Product"} × {item.quantity || 1}
                          </span>
                          <strong>
                            ₹
                            {(
                              Number(item.price) * Number(item.quantity || 1)
                            ).toLocaleString("en-IN")}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        borderTop: "1px solid #e5e7eb",
                        paddingTop: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ color: "#6b7280", fontSize: 13 }}>
                        Payment: {order.paymentStatus || "Pending"}
                        {order.paymentProvider ? ` · ${order.paymentProvider}` : ""}
                      </span>
                      <strong>
                        Total: ₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <p style={{ color: "#6b7280", fontSize: 13, margin: "9px 0 0" }}>
                      Delivery to: {order.deliveryAddress || "Address unavailable"}
                      {order.pincode ? `, PIN: ${order.pincode}` : ""}
                    </p>
                    {order.deliverySlot && (
                      <p style={{ color: "#18864b", fontSize: 12, margin: "4px 0 0", fontWeight: 600 }}>
                        Slot: {order.deliverySlot}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* NEW Professional Redesigned Checkout Modal */}
      {showCheckout && (
        <CheckoutModal
          user={loggedInUser}
          cart={cart}
          initialAddress={deliveryAddress}
          initialPincode={pincode}
          onClose={() => setShowCheckout(false)}
          onOrderSuccess={(order) => {
            setCart([]);
            showNotice(
              `✓ Order #${String(order?._id || "").slice(-8).toUpperCase()} placed successfully!`
            );
            reloadProducts();
          }}
        />
      )}

      {/* Delivery Location Quick Modal */}
      {locationOpen && (
        <div
          className="cart-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLocationOpen(false);
          }}
        >
          <section className="location-modal">
            <div className="drawer-heading">
              <div>
                <span className="eyebrow">DELIVERY DETAILS</span>
                <h2>Where should we deliver?</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setLocationOpen(false)}
                aria-label="Close location popup"
              >
                <X />
              </button>
            </div>
            <form
              className="location-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!/^\d{6}$/.test(pincode)) {
                  showNotice("Enter a valid 6-digit Indian pincode.");
                  return;
                }
                if (!deliveryAddress.trim()) {
                  showNotice("Please enter your delivery address.");
                  return;
                }
                setDeliveryAddress(`${deliveryAddress.trim()} - ${pincode}`);
                setLocationOpen(false);
                showNotice("Delivery address saved.");
              }}
            >
              <label htmlFor="delivery-address">
                House number, street, area
              </label>
              <input
                id="delivery-address"
                value={deliveryAddress.split(" - ")[0]}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                placeholder="Enter your delivery address"
                required
              />
              <label htmlFor="delivery-pincode">6-digit pincode</label>
              <input
                id="delivery-pincode"
                value={pincode}
                onChange={(event) =>
                  setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="e.g. 500001"
                inputMode="numeric"
                maxLength={6}
                required
              />
              <p className="location-help">
                This sets your delivery address for your current shopping session.
              </p>
              <button type="submit" className="checkout-button">
                Save delivery address
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div
          className="cart-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false);
          }}
        >
          <aside className="cart-drawer" aria-label="Shopping cart">
            <div className="drawer-heading">
              <div>
                <span className="eyebrow">YOUR SELECTION</span>
                <h2>My shopping cart ({cartCount})</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
              >
                <X />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <span>🛒</span>
                <h3>Your basket is waiting</h3>
                <p>Add a few fresh favourites to get started.</p>
                <button
                  className="primary-button"
                  onClick={() => setCartOpen(false)}
                >
                  Explore groceries
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item._id}>
                      <img src={getImage(item)} alt={item.name} />
                      <div className="cart-item-info">
                        <strong>{item.name}</strong>
                        <small>
                          ₹{Number(item.price).toLocaleString("en-IN")} / unit
                        </small>
                        <div className="quantity-control">
                          <button
                            onClick={() => changeQuantity(item._id, -1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() => addToCart(item)}
                            disabled={item.quantity >= item.stock}
                            aria-label="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      <strong className="cart-line-total">
                        ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>₹{cartTotal.toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <strong>{cartTotal >= 499 ? "FREE" : "₹40"}</strong>
                  </div>
                  <div className="cart-total">
                    <span>Total</span>
                    <strong>
                      ₹{(cartTotal + (cartTotal >= 499 ? 0 : 40)).toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <button
                    className="checkout-button"
                    onClick={() => {
                      if (!loggedInUser) {
                        setCartOpen(false);
                        setShowAuth(true);
                        showNotice("Please log in before checkout.");
                        return;
                      }
                      setCartOpen(false);
                      setShowCheckout(true);
                    }}
                  >
                    Proceed to Checkout <ArrowRight size={18} />
                  </button>
                  <p>Fast, contactless delivery right to your doorstep.</p>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;
