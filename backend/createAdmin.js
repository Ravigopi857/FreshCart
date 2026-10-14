
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function createAdmin() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error(
        "Add ADMIN_EMAIL and ADMIN_PASSWORD to your .env file first."
      );
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected.");

    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    let admin = await User.findOne({ email });

    if (admin && admin.role !== "admin") {
      throw new Error(
        "This email belongs to a customer. Use a different admin email."
      );
    }

    if (admin) {
      console.log("This admin account already exists. No changes made.");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    admin = await User.create({
      name: "FreshCart Admin",
      email,
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin account created successfully.");
    console.log("Admin email:", admin.email);
    console.log("Role:", admin.role);
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
