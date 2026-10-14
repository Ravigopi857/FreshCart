# FreshCart — MERN Grocery Store

FreshCart is a full-stack online grocery shopping application built using the MERN stack.

## Features

- Customer registration and login with JWT authentication
- Product browsing, search, and category filtering
- Shopping cart with quantity management and local persistence
- Checkout and order placement
- Razorpay test-mode payment integration
- Customer order history and order status tracking
- Admin dashboard for product and inventory management
- Admin order management and status updates
- Email notifications using Brevo SMTP and Nodemailer
- MongoDB Atlas database integration

## Tech Stack

**Frontend:** React.js, Vite, JavaScript, CSS, Tailwind CSS

**Backend:** Node.js, Express.js

**Database:** MongoDB Atlas, Mongoose

**Authentication:** JSON Web Tokens (JWT), bcryptjs

**Payments:** Razorpay (test mode)

**Email:** Nodemailer, Brevo SMTP

## Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/Ravigopi857/FreshCart.git
cd FreshCart
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

Configure your backend environment variables using a local `.env` file.

### 3. Start the backend

Use the start command defined in `backend/package.json`.

### 4. Install frontend dependencies

Open another terminal:

```bash
cd frontend
npm install
```

Configure the frontend API URL for your local backend, then run:

```bash
npm run dev
```

## Security

Do not commit `.env` files, passwords, API keys, or private customer data.

## Project Status

Development completed. Production deployment and live-environment testing are separate steps.

## Author

Developed as a full-stack MERN portfolio project.
