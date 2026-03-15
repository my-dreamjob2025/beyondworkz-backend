import { sendResponse } from "../../../utils/response.js";

export const logout = async (req, res) => {
  try {
    return sendResponse(res, 200, true, { message: "Logged out successfully." });
  } catch (err) {
    console.error("logout error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};
