import Session from "../../../models/session.model.js";
import { sendResponse } from "../../../utils/response.js";
import { verifyRefresh, signAccess } from "../../../utils/jwt.js";
import bcrypt from "bcryptjs";

export const refresh = async (req, res) => {
  try {
    const { panel } = req.body;

    if (!panel) {
      return sendResponse(res, 400, false, { message: "Panel is required." });
    }

    const RT = `rt_${panel}`;
    const SID = `sid_${panel}`;

    const refreshToken = req.cookies?.[RT];
    const sessionId = req.cookies?.[SID];

    if (!refreshToken || !sessionId) {
      return sendResponse(res, 401, false, { message: "No active session." });
    }

    let payload;
    try {
      payload = verifyRefresh(refreshToken);
    } catch {
      return sendResponse(res, 401, false, { message: "Refresh token expired or invalid." });
    }

    if (payload.sessionId !== sessionId) {
      return sendResponse(res, 401, false, { message: "Session mismatch." });
    }

    const session = await Session.findOne({ sessionId }).populate("user");
    if (!session || session.panel !== panel) {
      return sendResponse(res, 403, false, { message: "Invalid session." });
    }

    const valid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!valid) {
      await Session.deleteOne({ sessionId });
      return sendResponse(res, 401, false, { message: "Session expired. Please log in again." });
    }

    const user = session.user;

    const accessToken = signAccess({
      id: user._id,
      email: user.email,
      role: user.role,
      employeeType: user.employeeType,
      profileCompletion: user.profileCompletion || 0,
    });

    return sendResponse(res, 200, true, {
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        employeeType: user.employeeType,
        profileCompletion: user.profileCompletion || 0,
      },
    });
  } catch (err) {
    console.error("refresh error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};
