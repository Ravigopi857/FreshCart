
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const { protect, adminOnly } = require("./middleware/authMiddleware");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
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

// Start server after database connection
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FreshCart server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start FreshCart:", error.message);
    process.exit(1);
  });
