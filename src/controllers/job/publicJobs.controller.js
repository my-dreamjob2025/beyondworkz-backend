import mongoose from "mongoose";
import JobPost from "../../models/jobPost.model.js";
import { sendResponse } from "../../utils/response.js";

const ALLOWED_JOB_TYPES = ["Full Time", "Part Time", "Contract", "Internship"];

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPublicListing(doc) {
  if (!doc) return null;
  const cp = doc.companyProfile;
  const companyName =
    (cp?.companyDetails?.companyName && String(cp.companyDetails.companyName).trim()) ||
    (doc.hiringFor && String(doc.hiringFor).trim()) ||
    "Employer";
  const companyDescription =
    (cp?.companyDetails?.description && String(cp.companyDetails.description).trim()) || "";

  const scr = doc.screening && typeof doc.screening === "object" ? doc.screening : {};

  return {
    id: String(doc._id),
    title: doc.title ?? "",
    companyName,
    companyDescription,
    hiringFor: doc.hiringFor ?? "",
    jobType: doc.jobType ?? "Full Time",
    openings: typeof doc.openings === "number" && doc.openings >= 1 ? doc.openings : 1,
    city: doc.city ?? "",
    area: doc.area ?? "",
    minExperience: doc.minExperience ?? "",
    education: doc.education ?? "",
    skills: Array.isArray(doc.skills) ? doc.skills : [],
    description: doc.description ?? "",
    responsibilities: doc.responsibilities ?? "",
    salaryType: doc.salaryType ?? "Salary Range",
    minSalary: doc.minSalary ?? "",
    maxSalary: doc.maxSalary ?? "",
    salaryPeriod: doc.salaryPeriod ?? "Per Month",
    benefits: doc.benefits && typeof doc.benefits === "object" ? doc.benefits : {},
    bonuses: doc.bonuses && typeof doc.bonuses === "object" ? doc.bonuses : {},
    screening: {
      experience: Boolean(scr.experience),
      locationComfort: Boolean(scr.locationComfort),
      immediateJoin: Boolean(scr.immediateJoin),
      salaryComfort: Boolean(scr.salaryComfort),
      customQuestions: Array.isArray(scr.customQuestions) ? scr.customQuestions.filter(Boolean) : [],
      preferredExperience: scr.preferredExperience != null ? String(scr.preferredExperience) : "",
      preferredEducation: scr.preferredEducation != null ? String(scr.preferredEducation) : "",
      autoShortlist: Boolean(scr.autoShortlist),
    },
    listingType: doc.listingType ?? "standard",
    publishedAt: doc.publishedAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

/**
 * GET /api/jobs — published jobs for employee app (no auth).
 */
export const listPublicJobs = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const cityRaw = req.query.city != null ? String(req.query.city).trim() : "";
    const qRaw = req.query.q != null ? String(req.query.q).trim() : "";
    const jobTypeRaw = req.query.jobType != null ? String(req.query.jobType).trim() : "";

    const filter = { status: "published" };

    if (cityRaw) {
      filter.city = new RegExp(`^${escapeRegex(cityRaw)}$`, "i");
    }

    if (jobTypeRaw && ALLOWED_JOB_TYPES.includes(jobTypeRaw)) {
      filter.jobType = jobTypeRaw;
    }

    if (qRaw) {
      const rx = new RegExp(escapeRegex(qRaw), "i");
      filter.$or = [{ title: rx }, { description: rx }, { skills: rx }];
    }

    const [items, total] = await Promise.all([
      JobPost.find(filter)
        .sort({ publishedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "companyProfile", select: "companyDetails.companyName" })
        .lean(),
      JobPost.countDocuments(filter),
    ]);

    const jobs = items.map((row) => toPublicListing(row));
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return sendResponse(res, 200, true, {
      jobs,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error("listPublicJobs error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load jobs." });
  }
};

/**
 * GET /api/jobs/:jobId — single published job (no auth).
 */
export const getPublicJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!mongoose.isValidObjectId(jobId)) {
      return sendResponse(res, 400, false, { message: "Invalid job id." });
    }

    const doc = await JobPost.findOne({ _id: jobId, status: "published" })
      .populate({ path: "companyProfile", select: "companyDetails.companyName companyDetails.description" })
      .lean();

    if (!doc) {
      return sendResponse(res, 404, false, { message: "Job not found or no longer open." });
    }

    return sendResponse(res, 200, true, { job: toPublicListing(doc) });
  } catch (err) {
    console.error("getPublicJob error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load job." });
  }
};
