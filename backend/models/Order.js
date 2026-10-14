
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "An order must contain at least one product.",
      },
    },
    deliveryAddress: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      match: /^\d{6}$/,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
        paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "NotRequired"],
      default: "NotRequired",
    },

    paymentProvider: {
      type: String,
      enum: ["Razorpay", "COD"],
      default: undefined,
    },

    razorpayOrderId: {
      type: String,
      default: undefined,
    },

    razorpayPaymentId: {
      type: String,
      default: undefined,
    },
    status: {
      type: String,
      enum: ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"],
      default: "Placed",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
