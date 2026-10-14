import "./Auth.css";
import { useState } from "react";
import axios from "axios";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";

const API_URL = "http://localhost:5000/api/auth";

export default function Auth({ onClose, onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? "/login" : "/register";

      const response = await axios.post(`${API_URL}${endpoint}`, {
        ...(isLogin ? {} : { name: form.name.trim() }),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (isLogin) {
        const { token, user } = response.data;

        // Keep the token for authenticated API requests.
        sessionStorage.setItem("freshcart_token", token);
        sessionStorage.setItem("freshcart_user", JSON.stringify(user));

        setSuccess("Login successful!");

        if (onLoginSuccess) {
          onLoginSuccess(user);
        }
      } else {
        setSuccess("Account created! You can now log in.");
        setIsLogin(true);
        setForm((current) => ({
          ...current,
          password: "",
        }));
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to connect. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-card">
        <button
          type="button"
          className="auth-back"
          onClick={onClose}
        >
          <ArrowLeft size={18} />
          Back to FreshCart
        </button>

        <div className="auth-brand">
          <span className="auth-brand-icon">
            <Leaf size={25} />
          </span>
          <span>
            <strong>FreshCart</strong>
            <small>GOOD FOOD. GOOD MOOD.</small>
          </span>
        </div>

        <div className="auth-heading">
          <span className="auth-eyebrow">FRESHNESS STARTS HERE</span>
          <h1>{isLogin ? "Welcome back!" : "Create your account"}</h1>
          <p>
            {isLogin
              ? "Log in to continue your fresh shopping."
              : "Join FreshCart for a fresher way to shop."}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={isLogin ? "active" : ""}
            onClick={() => {
              setIsLogin(true);
              setError("");
              setSuccess("");
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={!isLogin ? "active" : ""}
            onClick={() => {
              setIsLogin(false);
              setError("");
              setSuccess("");
            }}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <label>
              Full name
              <span className="auth-input-wrap">
                <UserRound size={18} />
                <input
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
              </span>
            </label>
          )}

          <label>
            Email address
            <span className="auth-input-wrap">
              <Mail size={18} />
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </span>
          </label>

          <label>
            Password
            <span className="auth-input-wrap">
              <LockKeyhole size={18} />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={form.password}
                onChange={handleChange}
                autoComplete={
                  isLogin ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {error && <p className="auth-message error">{error}</p>}
          {success && <p className="auth-message success">{success}</p>}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isLogin
                ? "Login to FreshCart"
                : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          Fresh groceries, delivered with care.
        </p>
      </section>
    </div>
  );
}
