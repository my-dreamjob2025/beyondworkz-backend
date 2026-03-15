import User from "../../models/user.model.js";
import EmployeeProfile from "../../models/employeeProfile.model.js";
import { sendResponse } from "../../utils/response.js";
import { avatarWithPresignedUrl } from "../../config/s3.config.js";

function sanitizeEducation(education) {
  if (!Array.isArray(education)) return education;
  const isValidDate = (d) => {
    if (!d) return false;
    if (typeof d === "string") return /^\d{4}-\d{2}-\d{2}/.test(d);
    if (d instanceof Date) return !isNaN(d.getTime());
    return false;
  };
  return education.map((edu) => {
    const item = { ...edu };
    if (!isValidDate(item.startDate)) delete item.startDate;
    if (!isValidDate(item.endDate)) delete item.endDate;
    if (item.currentlyStudying) delete item.endDate;
    return item;
  });
}

function sanitizeExperience(experience) {
  if (!Array.isArray(experience)) return experience;
  const isValidDate = (d) => {
    if (!d) return false;
    if (typeof d === "string") return /^\d{4}-\d{2}-\d{2}/.test(d) || !isNaN(new Date(d).getTime());
    if (d instanceof Date) return !isNaN(d.getTime());
    return false;
  };
  return experience
    .filter((exp) => exp && typeof exp.jobTitle === "string" && exp.jobTitle.trim() && typeof exp.company === "string" && exp.company.trim() && isValidDate(exp.dateOfJoining))
    .map((exp) => {
      const item = { ...exp };
      item.jobTitle = String(item.jobTitle ?? "").trim();
      item.company = String(item.company ?? "").trim();
      if (!isValidDate(item.relievingDate)) delete item.relievingDate;
      if (item.current) delete item.relievingDate;
      if (item.description && item.description.length > 1000) item.description = item.description.slice(0, 1000);
      if (Array.isArray(item.skillsUsed)) {
        item.skillsUsed = item.skillsUsed.map((s) => String(s ?? "").trim()).filter(Boolean);
      } else {
        delete item.skillsUsed;
      }
      return item;
    });
}

function sanitizeSkills(skills) {
  if (!Array.isArray(skills)) return skills;
  return skills
    .map((s) => (typeof s === "string" ? { name: s.trim() } : s && typeof s.name === "string" ? { name: s.name.trim() } : null))
    .filter((s) => s && s.name);
}

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return sendResponse(res, 404, false, { message: "User not found." });

    const profile = await EmployeeProfile.findOne({ user: req.user.id }).lean();
    const profileCompletion = computeCompletion(user, profile || null);
    if (user.profileCompletion !== profileCompletion) {
      await User.findByIdAndUpdate(req.user.id, { profileCompletion });
    }

    const avatar = user.avatar ? await avatarWithPresignedUrl(user.avatar) : null;

    return sendResponse(res, 200, true, {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        city: user.city,
        workStatus: user.workStatus,
        years: user.years,
        months: user.months,
        employeeType: user.employeeType,
        profileCompletion,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        avatar,
        updatedAt: user.updatedAt,
      },
      profile: profile || null,
    });
  } catch (err) {
    console.error("getProfile error:", err);
    return sendResponse(res, 500, false, { message: "Failed to fetch profile." });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      // User-level fields
      firstName,
      lastName,
      phone,
      city,
      workStatus,
      years,
      months,
      avatar,
      employeeType,
      // Profile-level fields
      availability,
      whatsappNumber,
      skills,
      experience,
      education,
      // Type-specific
      whiteCollarDetails,
      blueCollarDetails,
    } = req.body;

    // Update User fields (guard against null/non-string for trim)
    const userUpdate = {};
    if (firstName !== undefined) userUpdate.firstName = String(firstName ?? "").trim();
    if (lastName !== undefined) userUpdate.lastName = String(lastName ?? "").trim();
    if (phone !== undefined) userUpdate.phone = String(phone ?? "").trim();
    if (city !== undefined) userUpdate.city = String(city ?? "").trim();
    if (workStatus !== undefined) userUpdate.workStatus = workStatus;
    if (years !== undefined) {
      const y = parseInt(years, 10);
      userUpdate.years = !isNaN(y) && y >= 0 && y <= 30 ? String(y).padStart(2, "0") : "00";
    }
    if (months !== undefined) {
      const m = parseInt(months, 10);
      userUpdate.months = !isNaN(m) && m >= 0 && m <= 11 ? String(m).padStart(2, "0") : "00";
    }
    const avatarUnset = avatar !== undefined && (avatar === null || avatar === "");
    if (avatar !== undefined && !avatarUnset) {
      const valid =
        avatar &&
        typeof avatar === "object" &&
        typeof avatar.key === "string" &&
        typeof avatar.url === "string" &&
        avatar.key.startsWith(`employee/${userId}/avatar/`);
      if (valid) {
        userUpdate.avatar = {
          key: avatar.key,
          url: avatar.url,
          size: avatar.size,
          contentType: avatar.contentType,
          uploadedAt: avatar.uploadedAt ? new Date(avatar.uploadedAt) : new Date(),
        };
      }
    }

    if (employeeType !== undefined && ["whitecollar", "bluecollar"].includes(employeeType)) {
      userUpdate.employeeType = employeeType;
    }

    const userUpdateOp = avatarUnset ? { $set: userUpdate, $unset: { avatar: "" } } : { $set: userUpdate };
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      userUpdateOp,
      { new: true }
    );

    // Upsert EmployeeProfile
    const profileUpdate = {};
    const unsetFields = {};
    const validAvailability = ["full-time", "part-time", "weekends"];
    if (availability !== undefined) {
      if (validAvailability.includes(availability)) {
        profileUpdate.availability = availability;
      } else {
        unsetFields.availability = "";
      }
    }
    if (whatsappNumber !== undefined) profileUpdate.whatsappNumber = String(whatsappNumber ?? "").trim();
    if (skills !== undefined) profileUpdate.skills = sanitizeSkills(skills);
    if (experience !== undefined) profileUpdate.experience = sanitizeExperience(experience);
    if (education !== undefined) profileUpdate.education = sanitizeEducation(education);
    if (whiteCollarDetails !== undefined)
      profileUpdate.whiteCollarDetails = whiteCollarDetails;
    if (blueCollarDetails !== undefined)
      profileUpdate.blueCollarDetails = blueCollarDetails;

    let profile = null;
    if (updatedUser.employeeType) {
      const employeeTypeProfile = updatedUser.employeeType === "whitecollar" ? "white_collar" : "blue_collar";
      const updateOp = {
        $set: profileUpdate,
        $setOnInsert: { user: userId, employeeType: employeeTypeProfile },
      };
      if (Object.keys(unsetFields).length) updateOp.$unset = unsetFields;
      profile = await EmployeeProfile.findOneAndUpdate(
        { user: userId },
        updateOp,
        { upsert: true, new: true }
      );
    } else {
      profile = await EmployeeProfile.findOne({ user: userId });
    }

    // Compute profile completion score
    const completionScore = computeCompletion(updatedUser, profile);
    await User.findByIdAndUpdate(userId, { profileCompletion: completionScore });

    return sendResponse(res, 200, true, {
      message: "Profile updated successfully.",
      profileCompletion: completionScore,
    });
  } catch (err) {
    console.error("updateProfile error:", err);
    return sendResponse(res, 500, false, { message: "Failed to update profile." });
  }
};

function computeCompletion(user, profile) {
  let score = 0;

  // Basic (40 pts)
  if (user.firstName) score += 8;
  if (user.phone) score += 8;
  if (user.city) score += 8;
  if (user.workStatus) score += 8;
  if (user.isEmailVerified) score += 8;

  if (!profile) return Math.min(score, 100);

  // Skills (20 pts)
  const skillCount = profile.skills?.length || 0;
  score += Math.min(skillCount, 5) * 4;

  // Education (20 pts)
  const eduCount = profile.education?.length || 0;
  if (eduCount > 0) score += 20;

  // Type-specific (20 pts)
  if (user.employeeType === "whitecollar") {
    const wc = profile.whiteCollarDetails || {};
    if (wc.bio) score += 7;
    if (wc.linkedin) score += 7;
    if (profile.experience?.length > 0) score += 6;
  } else {
    const bc = profile.blueCollarDetails || {};
    if (profile.availability) score += 7;
    if (bc.preferredAreas?.length > 0) score += 7;
    if (bc.hasDrivingLicense !== undefined) score += 6;
    if (profile.experience?.length > 0) score += 6;
  }

  return Math.min(score, 100);
}
