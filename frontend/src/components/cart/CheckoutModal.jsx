import { useState } from "react";
import {
  X,
  ShieldCheck,
  Truck,
  CreditCard,
  Banknote,
  Clock,
  CheckCircle2,
  ArrowRight,
  Loader2,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import "./CheckoutModal.css";
import { placeOrderCOD, createPaymentOrder, verifyPayment } from "../../services/api";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const DELIVERY_SLOTS = [
  {
    id: "express",
    label: "Express Delivery",
    time: "Within 2 Hours",
    tag: "Fastest",
  },
  {
    id: "evening",
    label: "Today Evening",
    time: "5:00 PM – 8:00 PM",
    tag: "Popular",
  },
  {
    id: "morning",
    label: "Tomorrow Morning",
    time: "7:00 AM – 10:00 AM",
    tag: "Fresh Batch",
  },
];

export default function CheckoutModal({
  user,
  cart,
  initialAddress = "",
  initialPincode = "",
  onClose,
  onOrderSuccess,
}) {
  const [customerName, setCustomerName] = useState(
    user?.name || user?.fullName || ""
  );
  const [customerEmail, setCustomerEmail] = useState(user?.email || "");
  const [customerPhone, setCustomerPhone] = useState(user?.phone || "");

  // Address
  const [flatNumber, setFlatNumber] = useState("");
  const [streetAddress, setStreetAddress] = useState(
    initialAddress.split(" - ")[0] || ""
  );
  const [city, setCity] = useState("Hyderabad");
  const [stateName, setStateName] = useState("Telangana");
  const [pincode, setPincode] = useState(
    initialPincode ||
      (initialAddress.includes(" - ")
        ? initialAddress.split(" - ")[1]
        : "500001")
  );

  // Delivery options
  const [selectedSlot, setSelectedSlot] = useState("express");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");

  // Payment method: "razorpay" | "cod"
  const [paymentMethod, setPaymentMethod] = useState("cod");

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [completedOrder, setCompletedOrder] = useState(null);

  // Calculations
  const subtotal = cart.reduce(
    (total, item) => total + Number(item.price) * Number(item.quantity),
    0
  );
  const deliveryFee = subtotal >= 499 ? 0 : 40;
  const finalTotal = subtotal + deliveryFee;
  const freeDeliveryShortfall = 499 - subtotal;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setErrorMessage("");

    // Validation
    if (!customerName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, "").length < 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!streetAddress.trim()) {
      setErrorMessage("Please enter your street address / landmark.");
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setErrorMessage("Please enter a valid 6-digit Indian PIN code.");
      return;
    }

    if (cart.length === 0) {
      setErrorMessage("Your cart is empty.");
      return;
    }

    const fullAddress = [
      flatNumber.trim(),
      streetAddress.trim(),
      city.trim(),
      stateName.trim(),
    ]
      .filter(Boolean)
      .join(", ");

    const slotLabel =
      DELIVERY_SLOTS.find((s) => s.id === selectedSlot)?.label +
      " (" +
      DELIVERY_SLOTS.find((s) => s.id === selectedSlot)?.time +
      ")";

    setSubmitting(true);

    if (paymentMethod === "cod") {
      // ── Cash on Delivery Workflow ──
      try {
        const response = await placeOrderCOD({
          items: cart.map((item) => ({
            productId: item._id,
            quantity: item.quantity,
          })),
          deliveryAddress: fullAddress,
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliverySlot: slotLabel,
          deliveryInstructions: deliveryInstructions.trim(),
          paymentMethod: "COD",
        });

        const createdOrder = response.data?.order;
        setCompletedOrder(createdOrder);
        if (onOrderSuccess) onOrderSuccess(createdOrder);
      } catch (err) {
        setErrorMessage(
          err.response?.data?.message ||
            "Unable to place Cash on Delivery order. Please try again."
        );
      } finally {
        setSubmitting(false);
      }
    } else {
      // ── Razorpay Online Payment Workflow ──
      try {
        const createRes = await createPaymentOrder({
          items: cart.map((item) => ({
            productId: item._id,
            quantity: item.quantity,
          })),
          deliveryAddress: fullAddress,
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliverySlot: slotLabel,
          deliveryInstructions: deliveryInstructions.trim(),
        });

        const { keyId, razorpayOrderId, amount, currency } =
          createRes.data || {};

        if (!keyId || !razorpayOrderId) {
          throw new Error("Payment server returned incomplete order details.");
        }

        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded || !window.Razorpay) {
          throw new Error(
            "Razorpay Checkout failed to load. Check your internet connection."
          );
        }

        const options = {
          key: keyId,
          amount,
          currency: currency || "INR",
          name: "FreshCart Grocery",
          description: "Fresh Farm Groceries Order",
          order_id: razorpayOrderId,
          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone,
          },
          notes: {
            deliveryPincode: pincode,
          },
          theme: {
            color: "#18864b",
          },
          handler: async (paymentResponse) => {
            setSubmitting(true);
            try {
              const verifyRes = await verifyPayment({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
              });

              const order = verifyRes.data?.order;
              setCompletedOrder(order);
              if (onOrderSuccess) onOrderSuccess(order);
            } catch (vErr) {
              setErrorMessage(
                vErr.response?.data?.message ||
                  "Payment received but order confirmation failed. Please contact support."
              );
            } finally {
              setSubmitting(false);
            }
          },
          modal: {
            ondismiss: () => {
              setSubmitting(false);
            },
            escape: true,
          },
        };

        const razorpayInstance = new window.Razorpay(options);
        razorpayInstance.on("payment.failed", (failRes) => {
          setSubmitting(false);
          setErrorMessage(
            failRes.error?.description ||
              "Payment failed. Your cart has been saved. Please try again."
          );
        });

        setSubmitting(false);
        razorpayInstance.open();
      } catch (err) {
        setErrorMessage(
          err.response?.data?.message ||
            err.message ||
            "Unable to start online payment. You can choose Cash on Delivery instead."
        );
        setSubmitting(false);
      }
    }
  };

  // ── Success State Screen ──────────────────────────────────────────────────
  if (completedOrder) {
    return (
      <div className="checkout-overlay" role="dialog" aria-modal="true">
        <div className="checkout-success-card">
          <div className="success-icon-wrap">
            <CheckCircle2 size={54} />
          </div>
          <span className="success-eyebrow">ORDER CONFIRMED</span>
          <h2>Thank you for your order!</h2>
          <p className="success-message">
            Your groceries are being handpicked with care and will be delivered
            soon.
          </p>

          <div className="success-details-box">
            <div className="success-detail-row">
              <span>Order ID</span>
              <strong>#{String(completedOrder._id || "").slice(-8).toUpperCase()}</strong>
            </div>
            <div className="success-detail-row">
              <span>Payment Method</span>
              <strong>
                {completedOrder.paymentProvider === "COD"
                  ? "Cash on Delivery"
                  : "Razorpay (Online)"}
              </strong>
            </div>
            <div className="success-detail-row">
              <span>Total Paid / Payable</span>
              <strong className="success-total">
                ₹{Number(completedOrder.totalAmount || finalTotal).toLocaleString("en-IN")}
              </strong>
            </div>
            <div className="success-detail-row">
              <span>Deliver To</span>
              <span>{completedOrder.deliveryAddress} - {completedOrder.pincode}</span>
            </div>
          </div>

          <div className="success-actions">
            <button
              type="button"
              className="checkout-primary-btn"
              onClick={onClose}
            >
              <ShoppingBag size={17} /> Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Checkout Modal Screen ────────────────────────────────────────────
  return (
    <div
      className="checkout-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="checkout-modal-container">
        {/* Header */}
        <header className="checkout-header">
          <div className="checkout-header-title">
            <div className="checkout-badge">
              <ShieldCheck size={16} /> 256-Bit Secure Checkout
            </div>
            <h1>Complete Your Order</h1>
          </div>
          <button
            type="button"
            className="checkout-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close checkout"
          >
            <X size={20} />
          </button>
        </header>

        {errorMessage && (
          <div className="checkout-error-banner" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Two-Column Form Body */}
        <form className="checkout-form-grid" onSubmit={handleSubmit}>
          {/* Left Column: Customer & Delivery Details */}
          <div className="checkout-left-col">
            {/* 1. Contact Information */}
            <section className="checkout-card">
              <div className="checkout-card-header">
                <span className="checkout-step-number">1</span>
                <div>
                  <h3>Contact Information</h3>
                  <p>Order receipt and live delivery updates will be sent here</p>
                </div>
              </div>

              <div className="checkout-inputs-row">
                <label className="checkout-input-label">
                  <span>
                    <User size={15} /> Full Name *
                  </span>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                    disabled={submitting}
                  />
                </label>

                <label className="checkout-input-label">
                  <span>
                    <Mail size={15} /> Email Address *
                  </span>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="e.g. rahul@example.com"
                    required
                    disabled={submitting}
                  />
                </label>
              </div>

              <label className="checkout-input-label">
                <span>
                  <Phone size={15} /> Mobile Phone Number *
                </span>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) =>
                    setCustomerPhone(
                      e.target.value.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                  placeholder="10-digit mobile number"
                  required
                  disabled={submitting}
                />
              </label>
            </section>

            {/* 2. Delivery Address */}
            <section className="checkout-card">
              <div className="checkout-card-header">
                <span className="checkout-step-number">2</span>
                <div>
                  <h3>Delivery Address</h3>
                  <p>Where should our delivery partner bring your groceries?</p>
                </div>
              </div>

              <div className="checkout-inputs-row">
                <label className="checkout-input-label">
                  <span>House / Flat / Block No.</span>
                  <input
                    type="text"
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                    placeholder="e.g. Apt 4B, Green Towers"
                    disabled={submitting}
                  />
                </label>

                <label className="checkout-input-label">
                  <span>PIN Code *</span>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) =>
                      setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit PIN code"
                    maxLength={6}
                    required
                    disabled={submitting}
                  />
                </label>
              </div>

              <label className="checkout-input-label">
                <span>
                  <MapPin size={15} /> Street, Area, Landmark *
                </span>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. Near Community Park, Hitech City Main Road"
                  required
                  disabled={submitting}
                />
              </label>

              <div className="checkout-inputs-row">
                <label className="checkout-input-label">
                  <span>City *</span>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    required
                    disabled={submitting}
                  />
                </label>

                <label className="checkout-input-label">
                  <span>State *</span>
                  <input
                    type="text"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="State"
                    required
                    disabled={submitting}
                  />
                </label>
              </div>
            </section>

            {/* 3. Delivery Preferences */}
            <section className="checkout-card">
              <div className="checkout-card-header">
                <span className="checkout-step-number">3</span>
                <div>
                  <h3>Delivery Slot & Instructions</h3>
                  <p>Pick a time that best suits your schedule</p>
                </div>
              </div>

              <div className="checkout-slots-grid">
                {DELIVERY_SLOTS.map((slot) => {
                  const isSelected = selectedSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`checkout-slot-card ${
                        isSelected ? "active" : ""
                      }`}
                      onClick={() => setSelectedSlot(slot.id)}
                      disabled={submitting}
                    >
                      <div className="slot-card-top">
                        <Clock size={16} />
                        <span className="slot-badge">{slot.tag}</span>
                      </div>
                      <strong>{slot.label}</strong>
                      <small>{slot.time}</small>
                    </button>
                  );
                })}
              </div>

              <label className="checkout-input-label" style={{ marginTop: 14 }}>
                <span>
                  <FileText size={15} /> Delivery Instructions (Optional)
                </span>
                <input
                  type="text"
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  placeholder="e.g. Leave with security, ring bell twice"
                  disabled={submitting}
                />
              </label>
            </section>

            {/* 4. Payment Method Selection */}
            <section className="checkout-card">
              <div className="checkout-card-header">
                <span className="checkout-step-number">4</span>
                <div>
                  <h3>Payment Method</h3>
                  <p>Choose your preferred payment option</p>
                </div>
              </div>

              <div className="checkout-payment-options">
                <label
                  className={`checkout-payment-option ${
                    paymentMethod === "cod" ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    disabled={submitting}
                  />
                  <div className="payment-option-content">
                    <div className="payment-icon-wrap green">
                      <Banknote size={22} />
                    </div>
                    <div>
                      <strong>Cash on Delivery (COD)</strong>
                      <p>Pay cash or scan UPI upon doorstep delivery</p>
                    </div>
                  </div>
                  <span className="payment-recommend-badge">Most Convenient</span>
                </label>

                <label
                  className={`checkout-payment-option ${
                    paymentMethod === "razorpay" ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="razorpay"
                    checked={paymentMethod === "razorpay"}
                    onChange={() => setPaymentMethod("razorpay")}
                    disabled={submitting}
                  />
                  <div className="payment-option-content">
                    <div className="payment-icon-wrap blue">
                      <CreditCard size={22} />
                    </div>
                    <div>
                      <strong>Online Payment (Razorpay)</strong>
                      <p>UPI (GPay/PhonePe), Credit/Debit Cards, NetBanking</p>
                    </div>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* Right Column: Order Summary */}
          <div className="checkout-right-col">
            <div className="checkout-summary-card">
              <h3>Order Summary ({cart.length} items)</h3>

              {/* Items List */}
              <div className="checkout-items-list">
                {cart.map((item) => (
                  <div className="checkout-item-row" key={item._id}>
                    <img
                      src={
                        item.image ||
                        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&auto=format&fit=crop&q=80"
                      }
                      alt={item.name}
                      className="checkout-item-img"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          "https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&auto=format&fit=crop&q=80";
                      }}
                    />
                    <div className="checkout-item-details">
                      <strong>{item.name}</strong>
                      <small>
                        Qty: {item.quantity} × ₹
                        {Number(item.price).toLocaleString("en-IN")}
                      </small>
                    </div>
                    <div className="checkout-item-price">
                      ₹
                      {(
                        Number(item.price) * Number(item.quantity)
                      ).toLocaleString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>

              {/* Free delivery prompt */}
              {submitting ? null : freeDeliveryShortfall > 0 ? (
                <div className="delivery-upsell-banner">
                  <Truck size={17} />
                  <span>
                    Add <strong>₹{freeDeliveryShortfall}</strong> more to unlock{" "}
                    <strong>FREE Delivery</strong>!
                  </span>
                </div>
              ) : (
                <div className="free-delivery-banner">
                  <Sparkles size={17} />
                  <span>Yay! You unlocked <strong>FREE Delivery</strong></span>
                </div>
              )}

              {/* Bill Breakdown */}
              <div className="checkout-bill-breakdown">
                <div className="bill-row">
                  <span>Items Subtotal</span>
                  <strong>₹{subtotal.toLocaleString("en-IN")}</strong>
                </div>

                <div className="bill-row">
                  <span>Delivery Fee</span>
                  <span>
                    {deliveryFee === 0 ? (
                      <span className="free-badge">FREE</span>
                    ) : (
                      `₹${deliveryFee}`
                    )}
                  </span>
                </div>

                <div className="bill-row">
                  <span>Packaging & Handling</span>
                  <span className="free-badge">FREE</span>
                </div>

                <div className="bill-divider" />

                <div className="bill-row total-row">
                  <span>Total Amount</span>
                  <strong>₹{finalTotal.toLocaleString("en-IN")}</strong>
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="checkout-primary-btn"
                disabled={submitting || cart.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="checkout-spin" /> Processing
                    Order…
                  </>
                ) : paymentMethod === "razorpay" ? (
                  <>
                    <CreditCard size={18} /> Pay ₹{finalTotal.toLocaleString("en-IN")}{" "}
                    via Razorpay <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    <ShoppingBag size={18} /> Place Order (Cash on Delivery){" "}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="checkout-trust-footer">
                <span>
                  <ShieldCheck size={14} /> 100% Satisfaction Guarantee
                </span>
                <span>
                  <Truck size={14} /> Contactless Safe Delivery
                </span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

