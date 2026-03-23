import User from "../../../models/user.model.js";
import { sendResponse } from "../../../utils/response.js";
import { verifyRefresh, signAccess } from "../../../utils/jwt.js";
import { avatarWithPresignedUrl } from "../../../config/s3.config.js";

export const refresh = async (req, res) => {
  try {
    const { refreshToken: token, panel } = req.body;

    if (!token) {
      return sendResponse(res, 400, false, { message: "Refresh token is required." });
    }

    const panelType = panel || "employee";

    let payload;
    try {
      payload = verifyRefresh(token);
    } catch {
      return sendResponse(res, 401, false, { message: "Refresh token expired or invalid." });
    }

    const { id, role, panel: tokenPanel } = payload;
    if (!id || tokenPanel !== panelType) {
      return sendResponse(res, 401, false, { message: "Invalid refresh token." });
    }

    const user = await User.findById(id).select(
      "email firstName lastName role employeeType profileCompletion avatar phone city jobTitle department timezone"
    );
    if (!user || user.role !== role) {
      return sendResponse(res, 403, false, { message: "User not found or invalid." });
    }

    if (user.isBlocked) {
      return sendResponse(res, 403, false, { message: "Account has been blocked." });
    }

    const accessToken = signAccess({
      id: user._id,
      email: user.email,
      role: user.role,
      employeeType: user.employeeType,
      profileCompletion: user.profileCompletion || 0,
    });

    const avatar = user.avatar ? await avatarWithPresignedUrl(user.avatar) : null;

    return sendResponse(res, 200, true, {
      accessToken,
      expiresIn: 900,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        employeeType: user.employeeType,
        profileCompletion: user.profileCompletion || 0,
        avatar,
        phone: user.phone,
        city: user.city,
        jobTitle: user.jobTitle,
        department: user.department,
        timezone: user.timezone,
      },
    });
  } catch (err) {
    console.error("refresh error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};
