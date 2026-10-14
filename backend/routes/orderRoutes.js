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

// POST: Create Razorpay payment order

router.post("/payment/create-order", protect, async (req, res) => {

  if (!paymentClientReady(res)) return;

  const { items, deliveryAddress, pincode } = req.body;

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

      message: "Each item must have a valid product ID and quantity.",

    });

  }

  try {

    // Combine duplicate product IDs and validate all products.

    const quantities = new Map();

    for (const item of items) {

      const id = String(item.productId);

      quantities.set(id, (quantities.get(id) || 0) + item.quantity);

    }

    const attemptItems = [];

    let totalAmount = 0;

    for (const [productId, quantity] of quantities) {

      const product = await Product.findById(productId);

      if (!product) {

        return res.status(404).json({

          message: "A product was not found. Refresh your cart and try again.",

        });

      }

      if (product.stock < quantity) {

        return res.status(400).json({

          message: `Insufficient stock for ${product.name}.`,

        });

      }

      const price = Number(product.price);

      if (!Number.isFinite(price) || price < 0) {

        return res.status(400).json({

          message: `Invalid price for ${product.name}.`,

        });

      }

      attemptItems.push({

        productId: product._id,

        name: product.name,

        price,

        quantity,

      });

      totalAmount += price * quantity;

    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {

      return res.status(400).json({

        message: "The order total must be greater than zero.",

      });

    }

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

      items: attemptItems,

      deliveryAddress: deliveryAddress.trim(),

      pincode: String(pincode),

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

    });

  } catch (error) {

    console.error("Create payment order error:", error);

    return res.status(500).json({

      message: "Unable to create the payment order.",

    });

  }

});

// POST: Verify Razorpay payment and create the FreshCart order

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

    // Repeated verification must not create a duplicate order.

    if (attempt.status === "Paid" && attempt.order) {

      return res.json({

        message: "Payment was already verified.",

        order: attempt.order,

      });

    }

    // Verify the signature using the server's Razorpay order ID.

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

    // Verify the payment belongs to this Razorpay order and has the right amount.

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

    // Capture an authorized payment when automatic capture has not occurred.

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

        message: "Payment has not been captured. Please check its status.",

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

        // Handle a retry safely if a previous request already completed.

        if (currentAttempt.status === "Paid" && currentAttempt.order) {

          savedOrder = await Order.findById(currentAttempt.order).session(session);

          return;

        }

        const orderItems = [];

        let verifiedTotal = 0;

        for (const item of currentAttempt.items) {

          const product = await Product.findById(item.productId).session(session);

          if (!product || product.stock < item.quantity) {

            throw new Error("STOCK_UNAVAILABLE_AFTER_PAYMENT");

          }

          // The price snapshot must still match the amount paid.

          orderItems.push({

            product: product._id,

            name: item.name,

            price: item.price,

            quantity: item.quantity,

          });

          verifiedTotal += item.price * item.quantity;

        }

        verifiedTotal = Math.round(verifiedTotal * 100) / 100;

        if (Math.round(verifiedTotal * 100) !== expectedAmount) {

          throw new Error("PAYMENT_AMOUNT_MISMATCH");

        }

        // Reduce stock atomically within the database transaction.

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

              items: orderItems,

              deliveryAddress: currentAttempt.deliveryAddress,

              pincode: currentAttempt.pincode,

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

    
    // Send confirmation email without affecting order success.
    if (orderWasCreated && savedOrder) {
      try {
        const customer = await User.findById(savedOrder.user).select(
          "name email"
        );

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

      return res.status(404).json({

        message: "Payment attempt not found.",

      });

    }

    if (error.message === "STOCK_UNAVAILABLE_AFTER_PAYMENT") {

      return res.status(409).json({

        message:

          "Payment was captured, but stock is unavailable. Contact the store administrator to arrange a refund.",

      });

    }

    if (error.message === "PAYMENT_AMOUNT_MISMATCH") {

      return res.status(409).json({

        message:

          "The paid amount does not match the order. Contact the store administrator.",

      });

    }

    return res.status(500).json({

      message: "Unable to complete payment verification.",

    });

  }

});

// Existing: Place a regular order (for current compatibility)

router.post("/", protect, async (req, res) => {

  const { items, deliveryAddress, pincode } = req.body;

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

      message: "Each item must have a valid product ID and quantity.",

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

      let totalAmount = 0;

      for (const [productId, quantity] of quantities) {

        const product = await Product.findById(productId).session(session);

        if (!product) throw new Error("PRODUCT_NOT_FOUND");

        if (product.stock < quantity) {

          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);

        }

        orderItems.push({

          product: product._id,

          name: product.name,

          price: product.price,

          quantity,

        });

        totalAmount += product.price * quantity;

      }

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

      const [order] = await Order.create(

        [

          {

            user: req.user.id,

            items: orderItems,

            deliveryAddress: deliveryAddress.trim(),

            pincode: String(pincode),

            totalAmount,

          },

        ],

        { session }

      );

      createdOrder = order;

    });

    res.status(201).json({

      message: "Order placed successfully.",

      order: createdOrder,

    });

  } catch (error) {

    console.error("Place order error:", error);

    if (error.message === "PRODUCT_NOT_FOUND") {

      return res.status(404).json({ message: "A product was not found." });

    }

    if (error.message.startsWith("INSUFFICIENT_STOCK:")) {

      return res.status(400).json({

        message: `Insufficient stock for ${error.message.split(":")[1]}.`,

      });

    }

    if (error.message === "STOCK_CHANGED") {

      return res.status(409).json({

        message: "Stock changed. Please review your cart and try again.",

      });

    }

    res.status(500).json({ message: "Unable to place order." });

  } finally {

    await session.endSession();

  }

});

// GET: Logged-in customer's orders

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

// GET: All orders (admin only)

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


// PATCH: Update an order's status (admin only)

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
