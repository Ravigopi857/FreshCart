
// ─── Environment variable validation ────────────────────────────────────────
// Fail fast so a missing config never causes a cryptic mid-request crash.
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];

const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  // Load .env first so the check below is accurate even on a fresh clone.
  require("dotenv").config();
}

// Re-check after loading .env
require("dotenv").config();

const stillMissing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (stillMissing.length > 0) {
  console.error(
    `[FreshCart] Missing required environment variables: ${stillMissing.join(", ")}\n` +
    `Please copy backend/.env.example to backend/.env and fill in the values.`
  );
  process.exit(1);
}

// Warn (don't crash) about optional but recommended vars
const RECOMMENDED_ENV = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "FRONTEND_ORIGIN",
];
const missingRecommended = RECOMMENDED_ENV.filter((key) => !process.env[key]);
if (missingRecommended.length > 0) {
  console.warn(
    `[FreshCart] Optional environment variables not set: ${missingRecommended.join(", ")}. ` +
    `Some features (payments, CORS restrictions) may not work as expected.`
  );
}

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const { protect, adminOnly } = require("./middleware/authMiddleware");

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
// Allow the configured frontend origin (and localhost for development).
const allowedOrigins = [];

if (process.env.FRONTEND_ORIGIN) {
  allowedOrigins.push(process.env.FRONTEND_ORIGIN.trim());
}

// Always allow localhost variants in development
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
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development without FRONTEND_ORIGIN set, allow any localhost origin
      if (
        process.env.NODE_ENV !== "production" &&
        !process.env.FRONTEND_ORIGIN &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS: origin '${origin}' is not allowed.`));
    },
    credentials: true,
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));

// ─── Global rate limiter (all routes) ────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
app.use(globalLimiter);

// ─── Strict rate limiter for auth routes ─────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login/register attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many authentication attempts. Please wait 15 minutes before trying again.",
  },
  // Skip successful requests from the count so legitimate users aren't blocked
  skipSuccessfulRequests: false,
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/products", productRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/orders", orderRoutes);

app.get("/api/auth-test", protect, (req, res) => {
  res.json({
    message: "Authentication successful!",
    user: req.user,
  });
});

app.get("/api/admin-test", protect, adminOnly, (req, res) => {
  res.json({
    message: "Admin access successful!",
  });
});

// Home route
app.get("/", (req, res) => {
  res.send("FreshCart API is running!");
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FreshCart server running on port ${PORT}`);
      console.log(
        `Allowed CORS origins: ${allowedOrigins.length ? allowedOrigins.join(", ") : "any localhost (dev mode)"}`
      );
    });
  })
  .catch((error) => {
    console.error("Failed to start FreshCart:", error.message);
    process.exit(1);
  });
