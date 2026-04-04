import mongoose from "mongoose";
import User from "../../models/user.model.js";
import EmployeeProfile from "../../models/employeeProfile.model.js";
import JobApplication from "../../models/jobApplication.model.js";
import SupportTicket from "../../models/supportTicket.model.js";
import Notification from "../../models/notification.model.js";
import { sendResponse } from "../../utils/response.js";

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const listJobSeekers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const q = { role: "employee" };

    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      q.$or = [{ email: re }, { firstName: re }, { lastName: re }, { phone: re }];
    }

    const [users, total] = await Promise.all([
      User.find(q)
        .select(
          "email firstName lastName phone city employeeType workStatus isBlocked profileCompletion isEmailVerified createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(q),
    ]);

    const ids = users.map((u) => u._id);
    const profiles = await EmployeeProfile.find({ user: { $in: ids } })
      .select("user employeeType location availability skills")
      .lean();
    const profileByUser = Object.fromEntries(profiles.map((p) => [String(p.user), p]));

    const items = users.map((u) => {
      const p = profileByUser[String(u._id)];
      return {
        id: u._id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        city: u.city,
        employeeType: u.employeeType,
        workStatus: u.workStatus,
        isBlocked: u.isBlocked,
        profileCompletion: u.profileCompletion,
        isEmailVerified: u.isEmailVerified,
        createdAt: u.createdAt,
        profileEmployeeType: p?.employeeType || null,
        location: p?.location || null,
        availability: p?.availability || null,
        skillsCount: p?.skills?.length ?? 0,
      };
    });

    return sendResponse(res, 200, true, {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("listJobSeekers error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};

export const getJobSeekerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, { message: "Invalid user id." });
    }

    const user = await User.findOne({ _id: id, role: "employee" })
      .select("-otpHash -otpExpires -otpAttempts -otpResendAfter")
      .lean();

    if (!user) {
      return sendResponse(res, 404, false, { message: "Job seeker not found." });
    }

    const profile = await EmployeeProfile.findOne({ user: id }).lean();

    return sendResponse(res, 200, true, {
      jobSeeker: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        city: user.city,
        employeeType: user.employeeType,
        workStatus: user.workStatus,
        years: user.years,
        months: user.months,
        avatar: user.avatar,
        isBlocked: user.isBlocked,
        profileCompletion: user.profileCompletion,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profile: profile || null,
      },
    });
  } catch (err) {
    console.error("getJobSeekerById error:", err);
    return sendResponse(res, 500, false, { message: "Internal server error." });
  }
};

/** Permanently removes job seeker user and applications, profile, tickets, notifications. */
export const deleteJobSeeker = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, { message: "Invalid user id." });
    }

    const existing = await User.findOne({ _id: id, role: "employee" }).select("_id").lean();
    if (!existing) {
      return sendResponse(res, 404, false, { message: "Job seeker not found." });
    }

    await JobApplication.deleteMany({ applicant: id });
    await EmployeeProfile.deleteMany({ user: id });
    await SupportTicket.deleteMany({ user: id });
    await Notification.deleteMany({ user: id });
    const result = await User.deleteOne({ _id: id, role: "employee" });

    if (result.deletedCount === 0) {
      return sendResponse(res, 404, false, { message: "Job seeker not found." });
    }

    return sendResponse(res, 200, true, { message: "Job seeker account deleted." });
  } catch (err) {
    console.error("deleteJobSeeker error:", err);
    return sendResponse(res, 500, false, { message: "Could not delete job seeker." });
  }
};
