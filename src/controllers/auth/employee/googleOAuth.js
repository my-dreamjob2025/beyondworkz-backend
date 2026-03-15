import User from "../../../models/user.model.js";
import EmployeeProfile from "../../../models/employeeProfile.model.js";
import { sendResponse } from "../../../utils/response.js";
import { signAccess, signRefresh } from "../../../utils/jwt.js";

const PANEL = "employee";
const SCOPES = ["email", "profile", "openid"];

/**
 * Build Google OAuth authorization URL and redirect user
 * GET /auth/google?intent=login|register&employeeType=whitecollar|bluecollar
 */
export const redirectToGoogle = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId) {
    return sendResponse(res, 503, false, {
      message: "Google sign-in is not configured. Please use email OTP.",
    });
  }

  const intent = req.query.intent || "login";
  const employeeType = req.query.employeeType || "whitecollar";
  const from = req.query.from || "/dashboard";

  const state = Buffer.from(
    JSON.stringify({ intent, employeeType, from })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.redirect(authUrl);
};

/**
 * Handle Google OAuth callback - exchange code for tokens, find/create user
 * GET /auth/google/callback?code=...&state=...
 */
export const handleGoogleCallback = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
  const baseUrl = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return res.redirect(`${clientUrl}/login?error=oauth_not_configured`);
  }

  const { code, state, error } = req.query;

  if (error) {
    const msg = encodeURIComponent(error === "access_denied" ? "Sign-in was cancelled." : "Google sign-in failed.");
    return res.redirect(`${clientUrl}/login?error=${msg}`);
  }

  if (!code) {
    return res.redirect(`${clientUrl}/login?error=missing_code`);
  }

  let parsedState = { intent: "login", employeeType: "whitecollar", from: "/dashboard" };
  try {
    if (state) {
      parsedState = JSON.parse(Buffer.from(state, "base64url").toString());
    }
  } catch {
    // use defaults
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      console.error("Google token exchange error:", errData);
      return res.redirect(`${clientUrl}/login?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;

    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!userInfoRes.ok) {
      return res.redirect(`${clientUrl}/login?error=userinfo_failed`);
    }

    const googleUser = await userInfoRes.json();
    const email = (googleUser.email || "").toLowerCase().trim();
    const googleId = googleUser.id;

    if (!email) {
      return res.redirect(`${clientUrl}/login?error=no_email`);
    }

    let user = await User.findOne({
      $or: [{ email }, { googleId }],
    }).select("+googleId");

    if (user) {
      if (user.role !== "employee") {
        return res.redirect(`${clientUrl}/login?error=not_employee`);
      }
      if (user.isBlocked) {
        return res.redirect(`${clientUrl}/login?error=account_blocked`);
      }
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // New user from Google: create with employeeType null; they'll select in profile completion
      user = await User.create({
        email,
        firstName: googleUser.given_name || "",
        lastName: googleUser.family_name || "",
        googleId,
        role: "employee",
        employeeType: null,
        isEmailVerified: true,
        profileCompletion: 0,
      });
      // EmployeeProfile created when user selects type in complete-profile flow
    }

    const refreshToken = signRefresh({ id: user._id, role: user.role, panel: PANEL });
    const jwtAccess = signAccess({
      id: user._id,
      email: user.email,
      role: user.role,
      employeeType: user.employeeType,
      profileCompletion: user.profileCompletion || 0,
    });

    const userPayload = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      employeeType: user.employeeType,
      profileCompletion: user.profileCompletion || 0,
    };

    const params = new URLSearchParams({
      accessToken: jwtAccess,
      refreshToken,
      user: JSON.stringify(userPayload),
    });
    if (parsedState.from) params.set("from", parsedState.from);

    res.redirect(`${clientUrl}/auth/callback?${params}`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.redirect(`${clientUrl}/login?error=server_error`);
  }
};
