const jwt = require("jsonwebtoken");
 
const JWT_SECRET = process.env.JWT_SECRET;
 
/**
 * verifyAdminToken
 * Validates the Bearer JWT from Authorization header.
 * Attaches decoded payload to req.user.
 * Enforces role === 'admin'.
 */
const verifyAdminToken = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
 
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing or malformed",
      });
    }
 
    const token = authHeader.split(" ")[1];
 
    const decoded = jwt.verify(token, JWT_SECRET);
 
    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins only.",
      });
    }
 
    req.user = decoded; // { user_id, role, mobile_number, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again.",
      });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Token verification failed",
    });
  }
};
 
module.exports = { verifyAdminToken };