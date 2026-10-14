
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function resetAdminPassword() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD is missing from .env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();

    const admin = await User.findOne({
      email,
      role: "admin",
    });

    if (!admin) {
      throw new Error("Admin account not found for ADMIN_EMAIL.");
    }

    admin.password = await bcrypt.hash(
      process.env.ADMIN_PASSWORD,
      12
    );

    await admin.save();

    console.log("Admin password reset successfully.");
    console.log("Admin email:", admin.email);
  } catch (error) {
    console.error("Password reset failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

resetAdminPassword();
