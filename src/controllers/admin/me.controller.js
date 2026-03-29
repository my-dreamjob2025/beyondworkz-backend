import User from "../../models/user.model.js";
import { sendResponse } from "../../utils/response.js";

export const adminMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "email firstName lastName role createdAt"
    );
    if (!user || user.role !== "admin") {
      return sendResponse(res, 403, false, { message: "Forbidden." });
    }
    return sendResponse(res, 200, true, {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("adminMe error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};
