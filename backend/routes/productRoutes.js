const express = require("express");
const Product = require("../models/Product");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * Normalise a category string to Title Case and standard plural format.
 * Handles singular, plural, uppercase, and common typos.
 * e.g. "fruit", "FRUIT", "fruits" → "Fruits"
 *      "bevereges", "beverage"   → "Beverages"
 */
function normalizeCategory(raw) {
  if (!raw || typeof raw !== "string") return "Fruits";
  const trimmed = raw.trim().toLowerCase();

  if (trimmed === "fruit" || trimmed === "fruits") return "Fruits";
  if (trimmed === "vegetable" || trimmed === "vegetables") return "Vegetables";
  if (trimmed === "dairy") return "Dairy";
  if (trimmed === "bakery") return "Bakery";
  if (trimmed === "snack" || trimmed === "snacks") return "Snacks";
  if (trimmed === "beverage" || trimmed === "beverages" || trimmed === "bevereges") return "Beverages";

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// GET: Anyone can view products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error("Fetch products error:", error);
    res.status(500).json({ message: "Failed to fetch products." });
  }
});

// GET /:id: Get single product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: "Invalid product ID." });
  }
});

// POST: Only admins can add products
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { name, category, description, price, stock, image } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Product name is required." });
    }

    if (!category || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ message: "Product category is required." });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ message: "Valid positive price is required." });
    }

    const numStock = Number(stock);
    if (isNaN(numStock) || numStock < 0) {
      return res.status(400).json({ message: "Valid positive stock quantity is required." });
    }

    const normalizedCategory = normalizeCategory(category);

    const product = new Product({
      name: name.trim(),
      category: normalizedCategory,
      description: (description || "").trim(),
      price: Math.round(numPrice * 100) / 100,
      stock: Math.floor(numStock),
      image: (image || "").trim(),
    });

    const savedProduct = await product.save();

    // Verify read-after-write directly from MongoDB
    const verified = await Product.findById(savedProduct._id);
    if (!verified) {
      throw new Error("Product was saved but could not be read back from database.");
    }

    console.log(`[FreshCart] Admin ${req.user.id} added product "${verified.name}" (ID: ${verified._id})`);

    // Return the created product with full document structure
    return res.status(201).json(verified);
  } catch (error) {
    console.error("Add product error:", error);
    res.status(400).json({ message: error.message || "Failed to add product." });
  }
});

// PUT: Only admins can update products
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const { name, category, description, price, stock, image } = req.body;

    const updateData = {};
    if (name !== undefined) {
      if (!name || !name.trim()) return res.status(400).json({ message: "Product name cannot be empty." });
      updateData.name = name.trim();
    }
    if (category !== undefined) {
      if (!category || !category.trim()) return res.status(400).json({ message: "Category cannot be empty." });
      updateData.category = normalizeCategory(category);
    }
    if (description !== undefined) {
      updateData.description = description.trim();
    }
    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) return res.status(400).json({ message: "Valid positive price is required." });
      updateData.price = Math.round(numPrice * 100) / 100;
    }
    if (stock !== undefined) {
      const numStock = Number(stock);
      if (isNaN(numStock) || numStock < 0) return res.status(400).json({ message: "Valid positive stock is required." });
      updateData.stock = Math.floor(numStock);
    }
    if (image !== undefined) {
      updateData.image = image.trim();
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { returnDocument: "after", runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    console.log(`[FreshCart] Admin ${req.user.id} updated product "${product.name}" (ID: ${product._id})`);
    res.json(product);
  } catch (error) {
    console.error("Update product error:", error);
    res.status(400).json({ message: error.message || "Failed to update product." });
  }
});

// DELETE: Only admins can delete products
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    console.log(`[FreshCart] Admin ${req.user.id} deleted product "${product.name}" (ID: ${product._id})`);
    res.json({ message: "Product deleted successfully.", id: req.params.id });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(400).json({ message: error.message || "Failed to delete product." });
  }
});

module.exports = router;
