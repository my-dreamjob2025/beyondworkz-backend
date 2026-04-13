import User from "../../models/user.model.js";
import EmployerProfile from "../../models/employerProfile.model.js";
import { sendResponse } from "../../utils/response.js";
import { avatarWithPresignedUrl, getPresignedViewUrl, BUCKET } from "../../config/s3.config.js";
import { computeEmployerCompletion } from "../../utils/employerCompletion.js";
import { sendOtpEmail } from "../../config/ses.js";
import { employerRegisterEmailTemplate } from "../../templates/employer/employerRegisterTemplate.js";
import { employerProfileEditLocked } from "../../utils/employerVerification.js";
import { notifyAdmins } from "../../services/notification.service.js";

const COMPANY_TYPES = [
  "Private",
  "Public",
  "Startup",
  "Government",
  "NGO",
  "Proprietorship",
  "Partnership",
  "Other",
];
const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

function sanitizeRecruiters(list) {
  if (!Array.isArray(list)) return undefined;
  return list
    .map((r) => ({
      user: r?.user || undefined,
      firstName: String(r?.firstName ?? "").trim(),
      lastName: String(r?.lastName ?? "").trim(),
      position: String(r?.position ?? "").trim(),
      contact: String(r?.contact ?? "").trim(),
      email: String(r?.email ?? "").trim().toLowerCase(),
      linkedin: String(r?.linkedin ?? "").trim(),
      status: r?.status === "active" ? "active" : "invited",
    }))
    .filter((r) => r.firstName || r.lastName || r.position || r.contact || r.email || r.linkedin)
    .slice(0, 25);
}

async function ensureEmployerProfile(userId) {
  let doc = await EmployerProfile.findOne({ user: userId });
  if (!doc) {
    doc = await EmployerProfile.create({ user: userId });
  }
  return doc;
}

async function resolveCompanyProfileForUser(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return { user: null, companyProfile: null };

  let companyProfile = null;
  if (user.companyProfile) {
    companyProfile = await EmployerProfile.findById(user.companyProfile);
  }

  if (!companyProfile) {
    companyProfile = await ensureEmployerProfile(userId);
    if (!user.companyProfile || String(user.companyProfile) !== String(companyProfile._id)) {
      await User.findByIdAndUpdate(userId, { companyProfile: companyProfile._id });
    }
  }

  return { user, companyProfile };
}

async function attachVerificationDocUrls(companyProfileObj) {
  if (!companyProfileObj?.verificationDocuments) return companyProfileObj;
  const vd = companyProfileObj.verificationDocuments;
  const next = { ...companyProfileObj, verificationDocuments: { ...vd } };
  for (const field of ["certificateOfIncorporation", "companyPanCard"]) {
    const doc = vd[field];
    if (!doc?.key) continue;
    if (BUCKET && doc.key && !doc.url?.includes("/uploads/")) {
      const url = await getPresignedViewUrl(doc.key, 3600);
      if (url) {
        next.verificationDocuments[field] = { ...doc, url };
      }
    }
  }
  return next;
}

function buildUserResponse(user, completion, avatar) {
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    city: user.city,
    jobTitle: user.jobTitle,
    department: user.department,
    timezone: user.timezone,
    profileCompletion: completion,
    isEmailVerified: user.isEmailVerified,
    role: user.role,
    avatar,
  };
}

export const getMe = async (req, res) => {
  try {
    const resolved = await resolveCompanyProfileForUser(req.user.id);
    const user = resolved.user;
    if (!user || user.role !== "employer") {
      return sendResponse(res, 403, false, { message: "Employer account required." });
    }

    const companyProfile = resolved.companyProfile;
    const completion = computeEmployerCompletion(user, companyProfile);
    if (user.profileCompletion !== completion) {
      await User.findByIdAndUpdate(req.user.id, { profileCompletion: completion });
    }

    const avatar = user.avatar ? await avatarWithPresignedUrl(user.avatar) : null;
    const cpObj = await attachVerificationDocUrls(companyProfile.toObject());

    return sendResponse(res, 200, true, {
      user: buildUserResponse({ ...user, profileCompletion: completion }, completion, avatar),
      companyProfile: cpObj,
    });
  } catch (err) {
    console.error("getMe employer error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load profile." });
  }
};

export const updateEmployerUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, phone, city, jobTitle, department, timezone } = req.body;

    const userUpdate = {};
    if (firstName !== undefined) userUpdate.firstName = String(firstName ?? "").trim();
    if (lastName !== undefined) userUpdate.lastName = String(lastName ?? "").trim();
    if (phone !== undefined) userUpdate.phone = String(phone ?? "").trim();
    if (city !== undefined) userUpdate.city = String(city ?? "").trim();
    if (jobTitle !== undefined) userUpdate.jobTitle = String(jobTitle ?? "").trim();
    if (department !== undefined) userUpdate.department = String(department ?? "").trim();
    if (timezone !== undefined) userUpdate.timezone = String(timezone ?? "").trim();

    const updated = await User.findByIdAndUpdate(userId, { $set: userUpdate }, { new: true }).lean();
    if (!updated) {
      return sendResponse(res, 404, false, { message: "User not found." });
    }

    const resolved = await resolveCompanyProfileForUser(userId);
    const company = resolved.companyProfile;
    const completion = computeEmployerCompletion(updated, company);
    await User.findByIdAndUpdate(userId, { profileCompletion: completion });

    return sendResponse(res, 200, true, {
      message: "Profile updated successfully.",
      profileCompletion: completion,
    });
  } catch (err) {
    console.error("updateEmployerUser error:", err);
    return sendResponse(res, 500, false, { message: "Failed to update profile." });
  }
};

function pickEnum(val, allowed) {
  if (val === undefined || val === null || val === "") return undefined;
  return allowed.includes(val) ? val : undefined;
}

export const updateCompanyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyDetails, companySocialMedia, address, hiringPreferences, recruiters } = req.body;

    const resolvedPre = await resolveCompanyProfileForUser(userId);
    if (employerProfileEditLocked(resolvedPre.companyProfile)) {
      return sendResponse(res, 403, false, {
        message:
          "Your company profile is under admin review. You cannot make changes until the review is complete.",
      });
    }

    const $set = {};

    if (companyDetails && typeof companyDetails === "object") {
      const cd = companyDetails;
      if (cd.companyName !== undefined) $set["companyDetails.companyName"] = String(cd.companyName ?? "").trim();
      if (cd.legalBusinessName !== undefined)
        $set["companyDetails.legalBusinessName"] = String(cd.legalBusinessName ?? "").trim();
      if (cd.industryType !== undefined) $set["companyDetails.industryType"] = String(cd.industryType ?? "").trim();
      const ct = pickEnum(cd.companyType, COMPANY_TYPES);
      if (ct !== undefined) $set["companyDetails.companyType"] = ct;
      const cs = pickEnum(cd.companySize, COMPANY_SIZES);
      if (cs !== undefined) $set["companyDetails.companySize"] = cs;
      if (cd.foundedYear !== undefined) {
        const y = parseInt(cd.foundedYear, 10);
        if (!Number.isNaN(y) && y >= 1800 && y <= 2100) $set["companyDetails.foundedYear"] = y;
      }
      if (cd.description !== undefined) $set["companyDetails.description"] = String(cd.description ?? "").trim();
      if (cd.headquarters !== undefined)
        $set["companyDetails.headquarters"] = String(cd.headquarters ?? "").trim();
    }

    if (companySocialMedia && typeof companySocialMedia === "object") {
      const sm = companySocialMedia;
      if (sm.linkedin !== undefined) $set["companySocialMedia.linkedin"] = String(sm.linkedin ?? "").trim();
      if (sm.website !== undefined) $set["companySocialMedia.website"] = String(sm.website ?? "").trim();
      if (sm.glassdoor !== undefined) $set["companySocialMedia.glassdoor"] = String(sm.glassdoor ?? "").trim();
      if (sm.careersPage !== undefined) $set["companySocialMedia.careersPage"] = String(sm.careersPage ?? "").trim();
    }

    if (address && typeof address === "object") {
      const a = address;
      if (a.addressLine1 !== undefined) $set["address.addressLine1"] = String(a.addressLine1 ?? "").trim();
      if (a.addressLine2 !== undefined) $set["address.addressLine2"] = String(a.addressLine2 ?? "").trim();
      if (a.city !== undefined) $set["address.city"] = String(a.city ?? "").trim();
      if (a.state !== undefined) $set["address.state"] = String(a.state ?? "").trim();
      if (a.country !== undefined) $set["address.country"] = String(a.country ?? "").trim();
      if (a.pincode !== undefined) $set["address.pincode"] = String(a.pincode ?? "").trim();
    }

    if (hiringPreferences && typeof hiringPreferences === "object") {
      const h = hiringPreferences;
      if (h.defaultJobLocation !== undefined)
        $set["hiringPreferences.defaultJobLocation"] = String(h.defaultJobLocation ?? "").trim();
      if (h.defaultEmploymentType !== undefined)
        $set["hiringPreferences.defaultEmploymentType"] = String(h.defaultEmploymentType ?? "").trim();
      if (h.applicationEmail !== undefined)
        $set["hiringPreferences.applicationEmail"] = String(h.applicationEmail ?? "").trim();
      if (h.responseSLA !== undefined) $set["hiringPreferences.responseSLA"] = String(h.responseSLA ?? "").trim();
      if (h.autoArchiveInactiveJobs !== undefined)
        $set["hiringPreferences.autoArchiveInactiveJobs"] = !!h.autoArchiveInactiveJobs;
    }

    if (recruiters !== undefined) {
      const cleaned = sanitizeRecruiters(recruiters);
      if (cleaned !== undefined) {
        $set.recruiters = cleaned;
      }
    }

    const companyProfile = resolvedPre.companyProfile;

    const profile = await EmployerProfile.findOneAndUpdate(
      { _id: companyProfile._id },
      { $set: $set, $setOnInsert: { user: userId } },
      { new: true, upsert: true }
    );

    // When hiring resources include emails, ensure those users can access employer panel.
    // We create/link employer users to this shared company profile and send OTP for first login.
    const invitedTeamMembers = [];
    const resolvedRecruiters = [];
    for (const recruiter of Array.isArray(profile.recruiters) ? profile.recruiters : []) {
      const email = String(recruiter.email || "").trim().toLowerCase();
      if (!email) {
        resolvedRecruiters.push(recruiter.toObject ? recruiter.toObject() : recruiter);
        continue;
      }

      let member = await User.findOne({ email }).select("role companyProfile isEmailVerified");
      if (!member) {
        member = await User.create({
          email,
          role: "employer",
          isEmailVerified: false,
          termsConsent: true,
          whatsappConsent: false,
          companyProfile: profile._id,
        });

        const otp = await member.generateOTP();
        await sendOtpEmail({
          to: email,
          subject: "You were added to Beyond Workz Hiring Team",
          html: employerRegisterEmailTemplate({
            otp,
            firstName: recruiter.firstName || "",
          }),
          otp,
          label: "Employer hiring team invite",
        });
        invitedTeamMembers.push(email);
      } else if (member.role === "employer") {
        if (!member.companyProfile || String(member.companyProfile) !== String(profile._id)) {
          await User.findByIdAndUpdate(member._id, { companyProfile: profile._id });
        }
      }

      resolvedRecruiters.push({
        ...(recruiter.toObject ? recruiter.toObject() : recruiter),
        user: member?._id || recruiter.user,
        status: member?.isEmailVerified ? "active" : "invited",
      });
    }

    if (resolvedRecruiters.length) {
      await EmployerProfile.findByIdAndUpdate(profile._id, { recruiters: resolvedRecruiters });
      profile.recruiters = resolvedRecruiters;
    }

    const user = await User.findById(userId).lean();
    const completion = computeEmployerCompletion(user, profile);
    await User.findByIdAndUpdate(userId, { profileCompletion: completion });

    const cpOut = await attachVerificationDocUrls(profile.toObject());

    return sendResponse(res, 200, true, {
      message: "Company profile updated successfully.",
      profileCompletion: completion,
      companyProfile: cpOut,
      invitedTeamMembers,
    });
  } catch (err) {
    console.error("updateCompanyProfile error:", err);
    return sendResponse(res, 500, false, { message: "Failed to update company profile." });
  }
};

export const submitEmployerVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const resolved = await resolveCompanyProfileForUser(userId);
    const profile = resolved.companyProfile;
    if (!profile) {
      return sendResponse(res, 404, false, { message: "Company profile not found." });
    }

    const status = profile.profileStatus;
    if (status === "pending_review") {
      return sendResponse(res, 400, false, {
        message: "Your profile is already submitted and awaiting admin review.",
      });
    }
    if (status === "approved") {
      return sendResponse(res, 400, false, { message: "Your company is already verified." });
    }
    if (status === "suspended") {
      return sendResponse(res, 403, false, {
        message: "This company account is suspended. Contact support.",
      });
    }

    const cd = profile.companyDetails || {};
    const addr = profile.address || {};
    const vd = profile.verificationDocuments || {};
    const missing = [];
    if (!String(cd.companyName || "").trim()) missing.push("Company name");
    if (!String(cd.industryType || "").trim()) missing.push("Industry");
    if (!String(cd.description || "").trim()) missing.push("Company description");
    if (!String(addr.addressLine1 || "").trim() && !String(addr.city || "").trim()) {
      missing.push("Business address (line1 or city)");
    }
    if (!vd.certificateOfIncorporation?.key) {
      missing.push("Certificate of incorporation / company registration document");
    }
    if (!vd.companyPanCard?.key) {
      missing.push("Company PAN card document");
    }

    if (missing.length) {
      return sendResponse(res, 400, false, {
        message: `Complete your profile before submitting: ${missing.join(", ")}.`,
        missingFields: missing,
      });
    }

    profile.profileStatus = "pending_review";
    profile.verificationSubmittedAt = new Date();
    profile.adminQuery = undefined;
    profile.rejectionReason = undefined;
    await profile.save();

    const user = await User.findById(userId).lean();
    const companyLabel =
      String(cd.companyName || "").trim() || user?.email || "Employer";

    try {
      await notifyAdmins({
        type: "employer_verification_submitted",
        title: "Employer verification submitted",
        message: `${companyLabel} submitted their company profile for verification.`,
        meta: { employerUserId: String(userId), companyProfileId: String(profile._id) },
      });
    } catch (e) {
      console.error("submitEmployerVerification notifyAdmins:", e);
    }

    const cpOut = await attachVerificationDocUrls(profile.toObject());
    return sendResponse(res, 200, true, {
      message: "Profile submitted for verification. We will notify you once an admin has reviewed it.",
      companyProfile: cpOut,
    });
  } catch (err) {
    console.error("submitEmployerVerification error:", err);
    return sendResponse(res, 500, false, { message: "Failed to submit for verification." });
  }
};
