import Session from "../../../models/session.model.js";
import { sendResponse } from "../../../utils/response.js";

export const logout = async (req, res) => {
  try {
    const { panel } = req.body;

    if (!panel) {
      return sendResponse(res, 400, false, { message: "Panel is required." });
    }

    const RT = `rt_${panel}`;
    const SID = `sid_${panel}`;

    const sessionId = req.cookies?.[SID];

    if (sessionId) {
      await Session.deleteOne({ sessionId, panel });
    }

    const isProd = process.env.NODE_ENV === "production";
    const cookieOpts = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
    };

    res.clearCookie(RT, cookieOpts);
    res.clearCookie(SID, cookieOpts);

    return sendResponse(res, 200, true, { message: "Logged out successfully." });
  } catch (err) {
    console.error("logout error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};
