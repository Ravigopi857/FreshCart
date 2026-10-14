
const nodemailer = require("nodemailer");

const configured = Boolean(
  process.env.BREVO_SMTP_USER &&
  process.env.BREVO_SMTP_KEY &&
  process.env.BREVO_SENDER_EMAIL
);

const transporter = configured
  ? nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port: Number(process.env.BREVO_SMTP_PORT || 587),
      secure: Number(process.env.BREVO_SMTP_PORT || 587) === 465,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    })
  : null;

async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    console.error("Brevo is not configured. Check backend/.env.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: {
        name: process.env.BREVO_SENDER_NAME || "FreshCart",
        address: process.env.BREVO_SENDER_EMAIL,
      },
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent successfully to:", to);
    return true;
  } catch (error) {
    console.error("Email sending failed:", error.message);
    return false;
  }
}

async function sendOrderConfirmationEmail(order, customer) {
  if (!customer?.email) return false;

  const items = (order.items || [])
    .map(
      (item) =>
        `${item.name} x ${item.quantity} - Rs. ${(
          Number(item.price) * Number(item.quantity)
        ).toFixed(2)}`
    )
    .join("\n");

  return sendEmail({
    to: customer.email,
    subject: `FreshCart order confirmation - ${order._id}`,
    text: `Hello ${customer.name || "Customer"},

Your FreshCart order has been placed successfully.

Order ID: ${order._id}
Status: ${order.status}
Payment: ${order.paymentStatus}

Items:
${items}

Total: Rs. ${Number(order.totalAmount).toFixed(2)}

Thank you for shopping with FreshCart!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#16803c">FreshCart</h2>
        <h3>Order confirmed!</h3>
        <p>Hello ${customer.name || "Customer"},</p>
        <p>Your order has been placed successfully.</p>
        <p><b>Order ID:</b> ${order._id}</p>
        <p><b>Order status:</b> ${order.status}</p>
        <p><b>Payment status:</b> ${order.paymentStatus}</p>
        <pre style="white-space:pre-wrap">${items}</pre>
        <h3>Total: Rs. ${Number(order.totalAmount).toFixed(2)}</h3>
        <p>Thank you for shopping with FreshCart!</p>
      </div>`,
  });
}

async function sendOrderStatusEmail(order, customer, previousStatus) {
  if (!customer?.email) return false;

  return sendEmail({
    to: customer.email,
    subject: `FreshCart order update - ${order.status}`,
    text: `Hello ${customer.name || "Customer"},

Your FreshCart order ${order._id} has been updated.

Previous status: ${previousStatus}
New status: ${order.status}

Thank you for shopping with FreshCart!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#16803c">FreshCart</h2>
        <h3>Your order status has changed</h3>
        <p>Hello ${customer.name || "Customer"},</p>
        <p>Order ID: ${order._id}</p>
        <p>Previous status: ${previousStatus}</p>
        <p><b>New status: ${order.status}</b></p>
        <p>Thank you for shopping with FreshCart!</p>
      </div>`,
  });
}

module.exports = {
  transporter,
  sendEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
};
