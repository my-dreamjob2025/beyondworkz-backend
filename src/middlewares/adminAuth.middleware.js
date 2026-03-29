import { verifyAccess } from "../utils/jwt.js";

/**
 * Requires a valid Bearer access token with role `admin`.
 */
export const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized: token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccess(token);
    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required." });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthorized: token invalid or expired" });
  }
};
