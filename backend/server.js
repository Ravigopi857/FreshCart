
// ─── Environment configuration ──────────────────────────────────────────────
require("dotenv").config();

const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];

const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(
    `[FreshCart] Missing required environment variables: ${missingEnv.join(", ")}`
  );
  process.exit(1);
}

const RECOMMENDED_ENV = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
];

const missingRecommended = RECOMMENDED_ENV.filter(
  (key) => !process.env[key]
);

if (missingRecommended.length > 0) {
  console.warn(
    `[FreshCart] Optional environment variables not set: ${missingRecommended.join(", ")}`
  );
}

// ─── Imports ─────────────────────────────────────────────────────────────────
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const { protect, adminOnly } = require("./middleware/authMiddleware");

const app = express();

// ─── CORS CONFIGURATION ──────────────────────────────────────────────────────

// Always allow the deployed FreshCart frontend.
const allowedOrigins = [
  "https://fresh-cart-mocha-two.vercel.app",
];

// Allow an additional frontend URL configured in Render.
if (process.env.FRONTEND_ORIGIN) {
  allowedOrigins.push(
    process.env.FRONTEND_ORIGIN.trim().replace(/\/$/, "")
  );
}

// Allow localhost only during development.
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push(
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000"
  );
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an Origin header (curl, server-to-server).
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow localhost variants during development only.
      if (
        process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }

      console.error(`[FreshCart] Blocked CORS origin: ${origin}`);

      return callback(
        new Error(`CORS: origin '${origin}' is not allowed.`)
      );
    },
    credentials: true,
  })
);

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));

// ─── Global rate limiter ────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again later.",
  },
});

app.use(globalLimiter);

// ─── Authentication rate limiter ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many authentication attempts. Please wait 15 minutes before trying again.",
  },
});

// ─── API routes ──────────────────────────────────────────────────────────────
app.use("/api/products", productRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/orders", orderRoutes);

// ─── Authentication test ────────────────────────────────────────────────────
app.get("/api/auth-test", protect, (req, res) => {
  res.json({
    message: "Authentication successful!",
    user: req.user,
  });
});

// ─── Admin test ─────────────────────────────────────────────────────────────
app.get("/api/admin-test", protect, adminOnly, (req, res) => {
  res.json({
    message: "Admin access successful!",
  });
});

// ─── Home route ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("FreshCart API is running!");
});

// ─── Error handler ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[FreshCart] Server error:", err.message);

  if (err.message && err.message.startsWith("CORS:")) {
    return res.status(403).json({
      message: "Frontend origin is not allowed.",
    });
  }

  res.status(500).json({
    message: "Internal server error.",
  });
});

// ─── Start server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FreshCart server running on port ${PORT}`);
      console.log("Allowed CORS origins:", allowedOrigins);
    });
  })
  .catch((error) => {
    console.error("Failed to start FreshCart:", error.message);
    process.exit(1);
  });
