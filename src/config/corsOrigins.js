const parseOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/** Same origin list for Express CORS and Socket.IO (keep in sync). */
export function getAllowedOrigins() {
  return [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:3000",
    ...parseOrigins(process.env.CLIENT_URL),
    ...parseOrigins(process.env.CLIENT_URLS),
    ...parseOrigins(process.env.EMPLOYER_URL),
    ...parseOrigins(process.env.EMPLOYEE_URL),
    ...parseOrigins(process.env.ADMIN_URL),
  ].filter(Boolean);
}
