import { verifyAccess } from "../utils/jwt.js";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized: token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccess(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthorized: token invalid or expired" });
  }
};

export default authMiddleware;
