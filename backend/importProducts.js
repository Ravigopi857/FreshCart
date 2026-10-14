
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Product = require("./models/Product");

async function importProducts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const filePath = path.join(
      __dirname,
      "FreshCart_Products_MongoDB_Import.json"
    );

    const products = JSON.parse(fs.readFileSync(filePath, "utf8"));

    let added = 0;
    let skipped = 0;

    for (const product of products) {
      const exists = await Product.findOne({
        name: product.name,
        category: product.category,
      });

      if (exists) {
        skipped++;
        continue;
      }

      await Product.create(product);
      added++;
    }

    console.log(`Import complete. Added: ${added}, Skipped: ${skipped}`);
  } catch (error) {
    console.error("Import failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

importProducts();
