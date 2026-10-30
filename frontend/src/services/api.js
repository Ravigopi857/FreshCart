/**
 * api.js — Centralised Axios instance and API service functions.
 *
 * All API calls go through this module so that:
 *  - The base URL is configured in exactly one place.
 *  - The Authorization header is injected automatically.
 *  - Error handling follows a consistent pattern.
 */

import axios from "axios";
import { getToken } from "../utils/auth";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

/** Axios instance with base URL pre-configured. */
const api = axios.create({ baseURL: BASE_URL });

/**
 * Request interceptor — attach the Authorization header on every call
 * so callers never need to pass it manually.
 */
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Products ─────────────────────────────────────────────────────────────────

export const fetchProducts = () => api.get("/api/products");

export const fetchProductById = (id) => api.get(`/api/products/${id}`);

export const createProduct = (data) => api.post("/api/products", data);

export const updateProduct = (id, data) => api.put(`/api/products/${id}`, data);

export const deleteProduct = (id) => api.delete(`/api/products/${id}`);

// ─── Orders ───────────────────────────────────────────────────────────────────

export const fetchAllOrders = () => api.get("/api/orders");

export const fetchMyOrders = () => api.get("/api/orders/my-orders");

export const updateOrderStatus = (id, status) =>
  api.patch(`/api/orders/${id}/status`, { status });

export const placeOrderCOD = (payload) =>
  api.post("/api/orders", payload);

export const createPaymentOrder = (payload) =>
  api.post("/api/orders/payment/create-order", payload);

export const verifyPayment = (payload) =>
  api.post("/api/orders/payment/verify", payload);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginUser = (email, password) =>
  api.post("/api/auth/login", { email, password });

export const registerUser = (name, email, password) =>
  api.post("/api/auth/register", { name, email, password });

export default api;
