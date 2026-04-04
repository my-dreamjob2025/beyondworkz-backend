import mongoose from "mongoose";
import User from "../../models/user.model.js";
import JobPost from "../../models/jobPost.model.js";
import JobApplication from "../../models/jobApplication.model.js";
import { sendResponse } from "../../utils/response.js";
import {
  draftJobSchema,
  publishJobSchema,
  patchStatusSchema,
  validateSchema,
} from "../../validations/employerJob.validation.js";

function normalizePayload(raw) {
  const skills = Array.isArray(raw.skills)
    ? [...new Set(raw.skills.map((s) => String(s).trim()).filter(Boolean))]
    : [];
  const openings = Number(raw.openings);
  return {
    ...raw,
    openings: Number.isFinite(openings) && openings >= 1 ? Math.floor(openings) : 1,
    skills,
  };
}

function toPublicJob(job) {
  if (!job) return null;
  const o = typeof job.toObject === "function" ? job.toObject() : { ...job };
  return {
    id: String(o._id),
    employer: String(o.employer),
    companyProfile: o.companyProfile ? String(o.companyProfile) : null,
    status: o.status,
    listingType: o.listingType,
    hiringFor: o.hiringFor ?? "",
    title: o.title ?? "",
    jobType: o.jobType ?? "Full Time",
    openings: o.openings ?? 1,
    city: o.city ?? "",
    area: o.area ?? "",
    description: o.description ?? "",
    responsibilities: o.responsibilities ?? "",
    skills: o.skills ?? [],
    minExperience: o.minExperience ?? "",
    education: o.education ?? "",
    salaryType: o.salaryType ?? "Salary Range",
    minSalary: o.minSalary ?? "",
    maxSalary: o.maxSalary ?? "",
    salaryPeriod: o.salaryPeriod ?? "Per Month",
    benefits: o.benefits ?? {},
    bonuses: o.bonuses ?? {},
    screening: o.screening ?? {},
    publishedAt: o.publishedAt ?? null,
    createdAt: o.createdAt ?? null,
    updatedAt: o.updatedAt ?? null,
  };
}

async function employerCompanyProfileId(userId) {
  const user = await User.findById(userId).select("companyProfile").lean();
  return user?.companyProfile || null;
}

/** Application counts per job id for this employer (for job list UI). */
async function applicationCountsByJobIds(employerId, jobDocs) {
  if (!jobDocs?.length) return new Map();
  const eid = new mongoose.Types.ObjectId(String(employerId));
  const jobIds = jobDocs.map((j) => j._id);
  const rows = await JobApplication.aggregate([
    { $match: { employer: eid, job: { $in: jobIds } } },
    { $group: { _id: "$job", count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const r of rows) {
    map.set(String(r._id), r.count);
  }
  return map;
}

export const listEmployerJobs = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { status } = req.query;
    const filter = { employer: employerId };
    if (status && ["draft", "published", "closed"].includes(status)) {
      filter.status = status;
    }

    const jobs = await JobPost.find(filter).sort({ updatedAt: -1 }).lean();
    const countMap = await applicationCountsByJobIds(employerId, jobs);
    return sendResponse(res, 200, true, {
      jobs: jobs.map((j) => ({
        ...toPublicJob(j),
        applicationCount: countMap.get(String(j._id)) ?? 0,
      })),
    });
  } catch (err) {
    console.error("listEmployerJobs error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load jobs." });
  }
};

export const getEmployerJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!mongoose.isValidObjectId(jobId)) {
      return sendResponse(res, 400, false, { message: "Invalid job id." });
    }
    const job = await JobPost.findOne({ _id: jobId, employer: req.user.id });
    if (!job) {
      return sendResponse(res, 404, false, { message: "Job not found." });
    }
    const applicationCount = await JobApplication.countDocuments({
      employer: req.user.id,
      job: job._id,
    });
    return sendResponse(res, 200, true, {
      job: { ...toPublicJob(job), applicationCount },
    });
  } catch (err) {
    console.error("getEmployerJob error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load job." });
  }
};

export const createEmployerJob = async (req, res) => {
  try {
    const body = normalizePayload(req.body || {});
    const status = body.status === "published" ? "published" : "draft";

    const schema = status === "published" ? publishJobSchema : draftJobSchema;
    const payload = { ...body, status };
    const { error, value } = validateSchema(schema, payload);
    if (error) {
      return sendResponse(res, 400, false, { message: error });
    }

    const companyProfile = await employerCompanyProfileId(req.user.id);
    const doc = {
      ...value,
      employer: req.user.id,
      companyProfile,
      publishedAt: status === "published" ? new Date() : null,
    };

    const job = await JobPost.create(doc);
    return sendResponse(res, 201, true, {
      message: status === "published" ? "Job published successfully." : "Draft saved.",
      job: toPublicJob(job),
    });
  } catch (err) {
    console.error("createEmployerJob error:", err);
    return sendResponse(res, 500, false, { message: "Failed to create job." });
  }
};

export const updateEmployerJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!mongoose.isValidObjectId(jobId)) {
      return sendResponse(res, 400, false, { message: "Invalid job id." });
    }

    const existing = await JobPost.findOne({ _id: jobId, employer: req.user.id });
    if (!existing) {
      return sendResponse(res, 404, false, { message: "Job not found." });
    }

    if (existing.status === "closed") {
      return sendResponse(res, 400, false, { message: "Closed jobs cannot be edited." });
    }

    const merged = normalizePayload({
      ...toPublicJob(existing),
      ...req.body,
      _id: undefined,
      employer: undefined,
      companyProfile: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      publishedAt: existing.publishedAt,
    });

    const nextStatus =
      req.body.status === "published"
        ? "published"
        : req.body.status === "draft"
          ? "draft"
          : existing.status;

    const schema = nextStatus === "published" ? publishJobSchema : draftJobSchema;
    const payload = { ...merged, status: nextStatus };
    const { error, value } = validateSchema(schema, payload);
    if (error) {
      return sendResponse(res, 400, false, { message: error });
    }

    const updates = { ...value };
    if (nextStatus === "published" && existing.status !== "published") {
      updates.publishedAt = new Date();
    }
    if (nextStatus === "draft" && existing.status === "published") {
      return sendResponse(res, 400, false, {
        message: "Cannot move a published job back to draft. Close it instead.",
      });
    }

    const companyProfile = await employerCompanyProfileId(req.user.id);
    updates.companyProfile = companyProfile;

    const job = await JobPost.findByIdAndUpdate(jobId, { $set: updates }, { new: true });
    return sendResponse(res, 200, true, {
      message: nextStatus === "published" ? "Job updated and published." : "Draft updated.",
      job: toPublicJob(job),
    });
  } catch (err) {
    console.error("updateEmployerJob error:", err);
    return sendResponse(res, 500, false, { message: "Failed to update job." });
  }
};

export const patchEmployerJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!mongoose.isValidObjectId(jobId)) {
      return sendResponse(res, 400, false, { message: "Invalid job id." });
    }

    const { error, value } = validateSchema(patchStatusSchema, req.body || {});
    if (error) {
      return sendResponse(res, 400, false, { message: error });
    }

    const job = await JobPost.findOne({ _id: jobId, employer: req.user.id });
    if (!job) {
      return sendResponse(res, 404, false, { message: "Job not found." });
    }

    const { status } = value;
    if (status === "closed" && job.status === "closed") {
      return sendResponse(res, 200, true, { job: toPublicJob(job) });
    }
    if (status === "published" && job.status === "draft") {
      const full = { ...toPublicJob(job), status: "published" };
      const v = validateSchema(publishJobSchema, full);
      if (v.error) {
        return sendResponse(res, 400, false, {
          message: `Complete required fields before publishing: ${v.error}`,
        });
      }
      job.status = "published";
      job.publishedAt = job.publishedAt || new Date();
      await job.save();
      return sendResponse(res, 200, true, {
        message: "Job published.",
        job: toPublicJob(job),
      });
    }
    if (status === "closed") {
      job.status = "closed";
      await job.save();
      return sendResponse(res, 200, true, {
        message: "Job closed.",
        job: toPublicJob(job),
      });
    }
    if (status === "draft") {
      if (job.status === "published") {
        return sendResponse(res, 400, false, { message: "Cannot unpublish to draft." });
      }
      job.status = "draft";
      await job.save();
      return sendResponse(res, 200, true, { job: toPublicJob(job) });
    }

    return sendResponse(res, 400, false, { message: "Invalid status transition." });
  } catch (err) {
    console.error("patchEmployerJobStatus error:", err);
    return sendResponse(res, 500, false, { message: "Failed to update status." });
  }
};
