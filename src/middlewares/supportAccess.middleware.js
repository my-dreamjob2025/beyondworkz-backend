/** JWT must be employee or employer (support tickets). */
export default function requireEmployeeOrEmployer(req, res, next) {
  const role = req.user?.role;
  if (role !== "employee" && role !== "employer") {
    return res.status(403).json({ success: false, message: "Support is only available for job seekers and employers." });
  }
  next();
}
