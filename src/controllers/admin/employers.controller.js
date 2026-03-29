import mongoose from "mongoose";
import User from "../../models/user.model.js";
import EmployerProfile from "../../models/employerProfile.model.js";
import { sendResponse } from "../../utils/response.js";

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const listEmployers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const q = { role: "employer" };

    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      const profileUserIds = await EmployerProfile.find({
        $or: [
          { "companyDetails.companyName": re },
          { "companyDetails.legalBusinessName": re },
        ],
      }).distinct("user");

      q.$or = [
        { email: re },
        { firstName: re },
        { lastName: re },
        ...(profileUserIds.length ? [{ _id: { $in: profileUserIds } }] : []),
      ];
    }

    const [raw, total] = await Promise.all([
      User.find(q)
        .select(
          "email firstName lastName phone jobTitle isBlocked profileCompletion isEmailVerified createdAt updatedAt companyProfile"
        )
        .populate({
          path: "companyProfile",
          select:
            "companyDetails.companyName companyDetails.industryType verified address.city hiringPreferences",
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(q),
    ]);

    const items = raw.map((u) => ({
      id: u._id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      jobTitle: u.jobTitle,
      isBlocked: u.isBlocked,
      profileCompletion: u.profileCompletion,
      isEmailVerified: u.isEmailVerified,
      createdAt: u.createdAt,
      companyName: u.companyProfile?.companyDetails?.companyName || null,
      industryType: u.companyProfile?.companyDetails?.industryType || null,
      companyVerified: u.companyProfile?.verified ?? null,
      city: u.companyProfile?.address?.city || null,
    }));

    return sendResponse(res, 200, true, {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("listEmployers error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};

export const getEmployerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, { message: "Invalid employer id." });
    }

    const user = await User.findOne({ _id: id, role: "employer" })
      .select("-otpHash -otpExpires -otpAttempts -otpResendAfter")
      .populate("companyProfile")
      .lean();

    if (!user) {
      return sendResponse(res, 404, false, { message: "Employer not found." });
    }

    return sendResponse(res, 200, true, {
      employer: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        jobTitle: user.jobTitle,
        department: user.department,
        timezone: user.timezone,
        city: user.city,
        avatar: user.avatar,
        isBlocked: user.isBlocked,
        profileCompletion: user.profileCompletion,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        whatsappConsent: user.whatsappConsent,
        termsConsent: user.termsConsent,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        companyProfile: user.companyProfile || null,
      },
    });
  } catch (err) {
    console.error("getEmployerById error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};
