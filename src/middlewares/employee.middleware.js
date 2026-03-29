/** Requires JWT user with role `employee`. */
export default function requireEmployee(req, res, next) {
  if (req.user?.role !== "employee") {
    return res.status(403).json({ success: false, message: "Employee access required." });
  }
  next();
}
