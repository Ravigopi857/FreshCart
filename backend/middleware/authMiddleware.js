
const jwt = require("jsonwebtoken");

function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required. Please log in.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support common user ID field names in the JWT payload.
    const userId = decoded.id || decoded._id || decoded.userId || decoded.sub;

    if (!userId) {
      return res.status(401).json({
        message: "Token does not contain a user ID. Please log in again.",
      });
    }

    req.user = {
      ...decoded,
      id: userId,
      _id: userId,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token. Please log in again.",
    });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required.",
    });
  }

  next();
}

module.exports = { protect, adminOnly };
