
require("dotenv").config();

const { sendEmail, transporter } = require("./utils/emailService");

async function testEmail() {
  try {
    if (!transporter) {
      throw new Error("Brevo settings are missing from backend/.env");
    }

    await transporter.verify();
    console.log("Brevo SMTP connection successful.");

    const sent = await sendEmail({
      to: process.env.BREVO_SENDER_EMAIL,
      subject: "FreshCart email test",
      text: "Success! FreshCart is connected to Brevo.",
      html: "<h2>FreshCart</h2><p>Email integration is working!</p>",
    });

    if (!sent) {
      throw new Error("Email was not sent. Check the terminal error.");
    }

    console.log("Test email sent. Check your inbox and Spam folder.");
  } catch (error) {
    console.error("Brevo test failed:", error.message);
    process.exitCode = 1;
  }
}

testEmail();
