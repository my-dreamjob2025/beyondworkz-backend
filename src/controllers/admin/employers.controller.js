import mongoose from "mongoose";
import User from "../../models/user.model.js";
import EmployerProfile from "../../models/employerProfile.model.js";
import JobPost from "../../models/jobPost.model.js";
import JobApplication from "../../models/jobApplication.model.js";
import SupportTicket from "../../models/supportTicket.model.js";
import Notification from "../../models/notification.model.js";
import { sendResponse } from "../../utils/response.js";
import { getPresignedViewUrl, BUCKET } from "../../config/s3.config.js";
import { createNotificationForUser } from "../../services/notification.service.js";

async function attachEmployerVerificationDocUrls(companyProfile) {
  if (!companyProfile?.verificationDocuments) return companyProfile;
  const o = typeof companyProfile.toObject === "function" ? companyProfile.toObject() : { ...companyProfile };
  const vd = o.verificationDocuments || {};
  const next = { ...o, verificationDocuments: { ...vd } };
  for (const field of ["certificateOfIncorporation", "companyPanCard"]) {
    const doc = vd[field];
    if (!doc?.key) continue;
    if (BUCKET && !doc.url?.includes("/uploads/")) {
      const url = await getPresignedViewUrl(doc.key, 7200);
      if (url) next.verificationDocuments[field] = { ...doc, url };
    }
  }
  return next;
}

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
            "companyDetails.companyName companyDetails.industryType verified address.city hiringPreferences profileStatus verificationSubmittedAt",
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
      profileStatus: u.companyProfile?.profileStatus ?? null,
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

    let companyProfile = user.companyProfile || null;
    if (companyProfile) {
      companyProfile = await attachEmployerVerificationDocUrls(companyProfile);
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
        companyProfile,
      },
    });
  } catch (err) {
    console.error("getEmployerById error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};

/** Permanently removes employer user and related jobs, applications, profile, tickets, notifications. */
export const patchEmployerVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, message } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, { message: "Invalid employer id." });
    }

    const allowed = ["approve", "reject", "request_revision"];
    if (!allowed.includes(action)) {
      return sendResponse(res, 400, false, {
        message: "action must be approve, reject, or request_revision.",
      });
    }

    const msg = typeof message === "string" ? message.trim() : "";
    if ((action === "reject" || action === "request_revision") && !msg) {
      return sendResponse(res, 400, false, { message: "A message is required for this action." });
    }

    const employerUser = await User.findOne({ _id: id, role: "employer" }).select("companyProfile").lean();
    if (!employerUser?.companyProfile) {
      return sendResponse(res, 404, false, { message: "Employer or company profile not found." });
    }

    const profile = await EmployerProfile.findById(employerUser.companyProfile);
    if (!profile) {
      return sendResponse(res, 404, false, { message: "Company profile not found." });
    }

    const st = profile.profileStatus;
    const adminId = req.user.id;

    if (action === "approve") {
      if (!["pending_review", "needs_revision"].includes(st)) {
        return sendResponse(res, 400, false, {
          message: "You can only approve employers who are in review or were asked to revise their profile.",
        });
      }
      profile.verified = true;
      profile.profileStatus = "approved";
      profile.adminQuery = undefined;
      profile.rejectionReason = undefined;
      profile.verificationReviewedAt = new Date();
      profile.verificationReviewedBy = adminId;
      await profile.save();
      try {
        await createNotificationForUser({
          userId: id,
          type: "employer_verification_approved",
          title: "Company verified",
          message: "Your company profile has been approved. You can now post jobs on Beyond Workz.",
        });
      } catch (e) {
        console.error("patchEmployerVerification notify:", e);
      }
    } else if (action === "reject") {
      if (!["pending_review", "needs_revision"].includes(st)) {
        return sendResponse(res, 400, false, {
          message: "You can only reject employers who are in review or awaiting revision.",
        });
      }
      profile.verified = false;
      profile.profileStatus = "rejected";
      profile.rejectionReason = msg;
      profile.adminQuery = undefined;
      profile.verificationReviewedAt = new Date();
      profile.verificationReviewedBy = adminId;
      await profile.save();
      try {
        await createNotificationForUser({
          userId: id,
          type: "employer_verification_rejected",
          title: "Company verification declined",
          message: msg,
        });
      } catch (e) {
        console.error("patchEmployerVerification notify:", e);
      }
    } else if (action === "request_revision") {
      if (st !== "pending_review") {
        return sendResponse(res, 400, false, {
          message: "You can only request changes while the employer’s profile is awaiting review.",
        });
      }
      profile.verified = false;
      profile.profileStatus = "needs_revision";
      profile.adminQuery = msg;
      profile.rejectionReason = undefined;
      profile.verificationReviewedAt = new Date();
      profile.verificationReviewedBy = adminId;
      await profile.save();
      try {
        await createNotificationForUser({
          userId: id,
          type: "employer_verification_revision",
          title: "Action needed: company profile",
          message: `Please update your company profile and resubmit: ${msg}`,
        });
      } catch (e) {
        console.error("patchEmployerVerification notify:", e);
      }
    }

    const cpOut = await attachEmployerVerificationDocUrls(profile.toObject());
    return sendResponse(res, 200, true, {
      message: "Verification updated.",
      companyProfile: cpOut,
    });
  } catch (err) {
    console.error("patchEmployerVerification error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};

export const deleteEmployer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, { message: "Invalid employer id." });
    }

    const existing = await User.findOne({ _id: id, role: "employer" }).select("_id").lean();
    if (!existing) {
      return sendResponse(res, 404, false, { message: "Employer not found." });
    }

    await JobApplication.deleteMany({ employer: id });
    await JobPost.deleteMany({ employer: id });
    await EmployerProfile.deleteMany({ user: id });
    await SupportTicket.deleteMany({ user: id });
    await Notification.deleteMany({ user: id });
    const result = await User.deleteOne({ _id: id, role: "employer" });

    if (result.deletedCount === 0) {
      return sendResponse(res, 404, false, { message: "Employer not found." });
    }

    return sendResponse(res, 200, true, { message: "Employer account deleted." });
  } catch (err) {
    console.error("deleteEmployer error:", err);
    return sendResponse(res, 500, false, { message: "Could not delete employer." });
  }
};
