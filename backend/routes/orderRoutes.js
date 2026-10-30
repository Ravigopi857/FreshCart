const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const Order = require("../models/Order");
const Product = require("../models/Product");
const PaymentAttempt = require("../models/PaymentAttempt");
const User = require("../models/User");
const {
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
} = require("../utils/emailService");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

function paymentClientReady(res) {
  if (!razorpay) {
    res.status(500).json({
      message: "Razorpay is not configured. Check backend environment variables.",
    });
    return false;
  }
  return true;
}

// ─── POST: Create Razorpay payment order ─────────────────────────────────────
router.post("/payment/create-order", protect, async (req, res) => {
  if (!paymentClientReady(res)) return;

  const {
    items,
    deliveryAddress,
    city,
    state,
    pincode,
    customerName,
    customerPhone,
    deliverySlot,
    deliveryInstructions,
  } = req.body;

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    !deliveryAddress?.trim() ||
    !/^\d{6}$/.test(String(pincode || ""))
  ) {
    return res.status(400).json({
      message: "Valid items, delivery address, and 6-digit pincode are required.",
    });
  }

  if (
    items.some(
      (item) =>
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
    )
  ) {
    return res.status(400).json({
      message: "Each item must have a valid product ID and positive integer quantity.",
    });
  }

  try {
    // Combine duplicate product IDs and validate stock & price against database
    const quantities = new Map();
    for (const item of items) {
      const id = String(item.productId);
      quantities.set(id, (quantities.get(id) || 0) + item.quantity);
    }

    const attemptItems = [];
    let subtotal = 0;

    for (const [productId, quantity] of quantities) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          message: "A product in your cart was not found. Please refresh and try again.",
        });
      }

      if (product.stock < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}.`,
        });
      }

      const price = Number(product.price);
      attemptItems.push({
        productId: product._id,
        name: product.name,
        price,
        quantity,
        image: product.image || "",
      });

      subtotal += price * quantity;
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const deliveryFee = subtotal >= 499 ? 0 : 40;
    const totalAmount = Math.round((subtotal + deliveryFee) * 100) / 100;

    const amountInPaise = Math.round(totalAmount * 100);
    const receipt = `fc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: String(req.user.id),
      },
    });

    await PaymentAttempt.create({
      user: req.user.id,
      customerName: (customerName || "").trim(),
      customerPhone: (customerPhone || "").trim(),
      items: attemptItems,
      deliveryAddress: deliveryAddress.trim(),
      city: (city || "").trim(),
      state: (state || "").trim(),
      pincode: String(pincode),
      deliverySlot: deliverySlot || "Express Delivery (within 2 hours)",
      deliveryInstructions: (deliveryInstructions || "").trim(),
      subtotal,
      deliveryFee,
      totalAmount,
      razorpayOrderId: razorpayOrder.id,
      status: "Pending",
    });

    return res.status(201).json({
      message: "Payment order created.",
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      subtotal,
      deliveryFee,
      totalAmount,
    });
  } catch (error) {
    console.error("Create payment order error:", error);
    return res.status(500).json({
      message: "Unable to create payment order with payment gateway.",
    });
  }
});

// ─── POST: Verify Razorpay payment and create Order ─────────────────────────
router.post("/payment/verify", protect, async (req, res) => {
  if (!paymentClientReady(res)) return;

  const {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  } = req.body;

  if (
    typeof razorpayOrderId !== "string" ||
    typeof razorpayPaymentId !== "string" ||
    typeof razorpaySignature !== "string"
  ) {
    return res.status(400).json({
      message: "Payment verification details are incomplete.",
    });
  }

  try {
    const attempt = await PaymentAttempt.findOne({
      razorpayOrderId,
      user: req.user.id,
    });

    if (!attempt) {
      return res.status(404).json({
        message: "Payment attempt not found for this customer.",
      });
    }

    if (attempt.status === "Paid" && attempt.order) {
      const existingOrder = await Order.findById(attempt.order);
      return res.json({
        message: "Payment was already verified.",
        order: existingOrder,
      });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${attempt.razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(razorpaySignature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(400).json({
        message: "Payment signature verification failed.",
      });
    }

    let payment = await razorpay.payments.fetch(razorpayPaymentId);
    const expectedAmount = Math.round(attempt.totalAmount * 100);

    if (
      payment.order_id !== attempt.razorpayOrderId ||
      payment.amount !== expectedAmount ||
      payment.currency !== "INR"
    ) {
      return res.status(400).json({
        message: "Payment details do not match this order.",
      });
    }

    if (payment.status === "authorized") {
      await razorpay.payments.capture(
        razorpayPaymentId,
        expectedAmount,
        "INR"
      );
      payment = await razorpay.payments.fetch(razorpayPaymentId);
    }

    if (payment.status !== "captured") {
      return res.status(400).json({
        message: "Payment has not been captured.",
      });
    }

    const session = await mongoose.startSession();
    let savedOrder;
    let orderWasCreated = false;

    try {
      await session.withTransaction(async () => {
        const currentAttempt = await PaymentAttempt.findOne({
          _id: attempt._id,
          user: req.user.id,
        }).session(session);

        if (!currentAttempt) {
          throw new Error("PAYMENT_ATTEMPT_NOT_FOUND");
        }

        if (currentAttempt.status === "Paid" && currentAttempt.order) {
          savedOrder = await Order.findById(currentAttempt.order).session(session);
          return;
        }

        const orderItems = [];
        let verifiedSubtotal = 0;

        for (const item of currentAttempt.items) {
          const product = await Product.findById(item.productId).session(session);
          if (!product || product.stock < item.quantity) {
            throw new Error("STOCK_UNAVAILABLE_AFTER_PAYMENT");
          }

          orderItems.push({
            product: product._id,
            name: product.name,
            price: item.price,
            quantity: item.quantity,
            image: product.image || "",
          });

          verifiedSubtotal += item.price * item.quantity;
        }

        verifiedSubtotal = Math.round(verifiedSubtotal * 100) / 100;
        const deliveryFee = currentAttempt.deliveryFee || (verifiedSubtotal >= 499 ? 0 : 40);
        const verifiedTotal = Math.round((verifiedSubtotal + deliveryFee) * 100) / 100;

        // Atomically decrease stock
        for (const item of orderItems) {
          const result = await Product.updateOne(
            {
              _id: item.product,
              stock: { $gte: item.quantity },
            },
            { $inc: { stock: -item.quantity } },
            { session }
          );

          if (result.modifiedCount !== 1) {
            throw new Error("STOCK_UNAVAILABLE_AFTER_PAYMENT");
          }
        }

        const [order] = await Order.create(
          [
            {
              user: currentAttempt.user,
              customerName: currentAttempt.customerName,
              customerPhone: currentAttempt.customerPhone,
              items: orderItems,
              deliveryAddress: currentAttempt.deliveryAddress,
              city: currentAttempt.city,
              state: currentAttempt.state,
              pincode: currentAttempt.pincode,
              deliverySlot: currentAttempt.deliverySlot,
              deliveryInstructions: currentAttempt.deliveryInstructions,
              subtotal: verifiedSubtotal,
              deliveryFee,
              totalAmount: verifiedTotal,
              status: "Placed",
              paymentStatus: "Paid",
              paymentProvider: "Razorpay",
              razorpayOrderId: currentAttempt.razorpayOrderId,
              razorpayPaymentId,
            },
          ],
          { session }
        );

        currentAttempt.status = "Paid";
        currentAttempt.razorpayPaymentId = razorpayPaymentId;
        currentAttempt.order = order._id;
        await currentAttempt.save({ session });

        savedOrder = order;
        orderWasCreated = true;
      });
    } finally {
      await session.endSession();
    }

    if (orderWasCreated && savedOrder) {
      try {
        const customer = await User.findById(savedOrder.user).select("name email");
        if (customer?.email) {
          await sendOrderConfirmationEmail(savedOrder, customer);
        }
      } catch (emailError) {
        console.error("Order confirmation email error:", emailError);
      }
    }

    return res.json({
      message: "Payment verified and order placed successfully.",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    if (error.message === "PAYMENT_ATTEMPT_NOT_FOUND") {
      return res.status(404).json({ message: "Payment attempt not found." });
    }
    if (error.message === "STOCK_UNAVAILABLE_AFTER_PAYMENT") {
      return res.status(409).json({
        message: "Payment was captured, but some stock is unavailable. Contact support for assistance.",
      });
    }
    return res.status(500).json({
      message: "Unable to complete payment verification.",
    });
  }
});

// ─── POST: Place Order (Cash on Delivery or Standard Checkout) ──────────────
router.post("/", protect, async (req, res) => {
  const {
    items,
    deliveryAddress,
    city,
    state,
    pincode,
    customerName,
    customerPhone,
    deliverySlot,
    deliveryInstructions,
    paymentMethod,
  } = req.body;

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    !deliveryAddress?.trim() ||
    !/^\d{6}$/.test(String(pincode || ""))
  ) {
    return res.status(400).json({
      message: "Valid items, delivery address, and 6-digit pincode are required.",
    });
  }

  if (
    items.some(
      (item) =>
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
    )
  ) {
    return res.status(400).json({
      message: "Each item must have a valid product ID and positive integer quantity.",
    });
  }

  const session = await mongoose.startSession();

  try {
    let createdOrder;

    await session.withTransaction(async () => {
      const quantities = new Map();
      for (const item of items) {
        const id = String(item.productId);
        quantities.set(id, (quantities.get(id) || 0) + item.quantity);
      }

      const orderItems = [];
      let subtotal = 0;

      for (const [productId, quantity] of quantities) {
        const product = await Product.findById(productId).session(session);
        if (!product) throw new Error("PRODUCT_NOT_FOUND");

        if (product.stock < quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}:${product.stock}`);
        }

        orderItems.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity,
          image: product.image || "",
        });

        subtotal += product.price * quantity;
      }

      subtotal = Math.round(subtotal * 100) / 100;
      const deliveryFee = subtotal >= 499 ? 0 : 40;
      const totalAmount = Math.round((subtotal + deliveryFee) * 100) / 100;

      // Deduct stock atomically
      for (const item of orderItems) {
        const updated = await Product.updateOne(
          {
            _id: item.product,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { session }
        );

        if (updated.modifiedCount !== 1) throw new Error("STOCK_CHANGED");
      }

      const isCOD = paymentMethod === "COD" || !paymentMethod;

      const [order] = await Order.create(
        [
          {
            user: req.user.id,
            customerName: (customerName || "").trim(),
            customerPhone: (customerPhone || "").trim(),
            items: orderItems,
            deliveryAddress: deliveryAddress.trim(),
            city: (city || "").trim(),
            state: (state || "").trim(),
            pincode: String(pincode),
            deliverySlot: deliverySlot || "Express Delivery (within 2 hours)",
            deliveryInstructions: (deliveryInstructions || "").trim(),
            subtotal,
            deliveryFee,
            totalAmount,
            status: "Placed",
            paymentStatus: isCOD ? "Pending" : "NotRequired",
            paymentProvider: isCOD ? "COD" : "COD",
          },
        ],
        { session }
      );

      createdOrder = order;
    });

    // Send confirmation email
    if (createdOrder) {
      try {
        const customer = await User.findById(createdOrder.user).select("name email");
        if (customer?.email) {
          await sendOrderConfirmationEmail(createdOrder, customer);
        }
      } catch (emailError) {
        console.error("Order confirmation email error:", emailError);
      }
    }

    return res.status(201).json({
      message: "Order placed successfully.",
      order: createdOrder,
    });
  } catch (error) {
    console.error("Place order error:", error);

    if (error.message === "PRODUCT_NOT_FOUND") {
      return res.status(404).json({ message: "A product in your cart was not found." });
    }
    if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
      const parts = error.message.split(":");
      return res.status(400).json({
        message: `Insufficient stock for "${parts[1]}". Only ${parts[2]} available.`,
      });
    }
    if (error.message === "STOCK_CHANGED") {
      return res.status(409).json({
        message: "Stock availability changed while processing. Please review your cart.",
      });
    }

    return res.status(500).json({ message: "Unable to place order. Please try again." });
  } finally {
    await session.endSession();
  }
});

// ─── GET: Logged-in customer's orders ────────────────────────────────────────
router.get("/my-orders", protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (error) {
    console.error("Fetch customer orders error:", error);
    res.status(500).json({ message: "Unable to fetch your orders." });
  }
});

// ─── GET: All orders (admin only) ───────────────────────────────────────────
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Fetch all orders error:", error);
    res.status(500).json({ message: "Unable to fetch orders." });
  }
});

// ─── PATCH: Update order status (admin only) ────────────────────────────────
router.patch("/:id/status", protect, adminOnly, async (req, res) => {
  const allowedStatuses = [
    "Placed",
    "Confirmed",
    "Shipped",
    "Delivered",
    "Cancelled",
  ];

  const { status } = req.body;

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid order ID." });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid order status." });
  }

  try {
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    const previousStatus = existingOrder.status;
    existingOrder.status = status;
    await existingOrder.save();

    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email"
    );

    if (previousStatus !== status && order?.user?.email) {
      try {
        await sendOrderStatusEmail(order, order.user, previousStatus);
      } catch (emailError) {
        console.error("Order status email error:", emailError);
      }
    }

    return res.json({
      message: "Order status updated successfully.",
      order,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({
      message: "Unable to update order status.",
    });
  }
});

module.exports = router;
