import User from "../../models/user.model.js";
import EmployeeProfile from "../../models/employeeProfile.model.js";
import { sendResponse } from "../../utils/response.js";

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return sendResponse(res, 404, false, { message: "User not found." });

    const profile = await EmployeeProfile.findOne({ user: req.user.id }).lean();
    const profileCompletion = computeCompletion(user, profile || null);
    if (user.profileCompletion !== profileCompletion) {
      await User.findByIdAndUpdate(req.user.id, { profileCompletion });
    }

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
        avatar: user.avatar,
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
      // Profile-level fields
      availability,
      skills,
      experience,
      education,
      // Type-specific
      whiteCollarDetails,
      blueCollarDetails,
    } = req.body;

    // Update User fields
    const userUpdate = {};
    if (firstName !== undefined) userUpdate.firstName = firstName.trim();
    if (lastName !== undefined) userUpdate.lastName = lastName.trim();
    if (phone !== undefined) userUpdate.phone = phone.trim();
    if (city !== undefined) userUpdate.city = city.trim();
    if (workStatus !== undefined) userUpdate.workStatus = workStatus;
    if (years !== undefined) userUpdate.years = String(years).padStart(2, "0");
    if (months !== undefined) userUpdate.months = String(months).padStart(2, "0");

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: userUpdate },
      { new: true }
    );

    // Upsert EmployeeProfile
    const profileUpdate = {};
    if (availability !== undefined) profileUpdate.availability = availability;
    if (skills !== undefined) profileUpdate.skills = skills;
    if (experience !== undefined) profileUpdate.experience = experience;
    if (education !== undefined) profileUpdate.education = education;
    if (whiteCollarDetails !== undefined)
      profileUpdate.whiteCollarDetails = whiteCollarDetails;
    if (blueCollarDetails !== undefined)
      profileUpdate.blueCollarDetails = blueCollarDetails;

    const employeeTypeProfile = updatedUser.employeeType === "whitecollar" ? "white_collar" : "blue_collar";
    const profile = await EmployeeProfile.findOneAndUpdate(
      { user: userId },
      {
        $set: profileUpdate,
        $setOnInsert: { user: userId, employeeType: employeeTypeProfile },
      },
      { upsert: true, new: true }
    );

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
  }

  return Math.min(score, 100);
}
