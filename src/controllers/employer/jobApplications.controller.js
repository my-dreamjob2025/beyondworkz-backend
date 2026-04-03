import mongoose from "mongoose";
import JobApplication from "../../models/jobApplication.model.js";
import JobPost from "../../models/jobPost.model.js";
import { sendResponse } from "../../utils/response.js";
import { formatScreeningForClient } from "../../utils/applicationScreening.js";
import { createNotificationForUser } from "../../services/notification.service.js";

const STATUS_LABELS = {
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  interview_scheduled: "Interview scheduled",
  rejected: "Rejected",
  hired: "Hired",
};

function applicantLabel(user) {
  if (!user) return "Candidate";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || "Candidate";
}

/** GET /employer/applications/summary */
export const getApplicationSummary = async (req, res) => {
  try {
    const employerId = req.user.id;
    const apps = await JobApplication.find({ employer: employerId }).select("status").lean();

    const byStatus = {
      submitted: 0,
      shortlisted: 0,
      interview_scheduled: 0,
      rejected: 0,
      hired: 0,
    };
    for (const a of apps) {
      if (byStatus[a.status] !== undefined) byStatus[a.status] += 1;
    }

    return sendResponse(res, 200, true, {
      total: apps.length,
      byStatus,
      interviewsScheduled: byStatus.interview_scheduled,
    });
  } catch (err) {
    console.error("getApplicationSummary error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load application summary." });
  }
};

/** GET /employer/applications/recent?limit= */
export const listRecentApplications = async (req, res) => {
  try {
    const employerId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);

    const rows = await JobApplication.find({ employer: employerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("job", "title city area status")
      .populate("applicant", "firstName lastName email")
      .lean();

    const items = rows.map((row) => ({
      id: row._id,
      status: row.status,
      appliedAt: row.createdAt,
      job: row.job
        ? {
            id: row.job._id,
            title: row.job.title || "Untitled",
            city: row.job.city,
            area: row.job.area,
          }
        : null,
      applicantName: applicantLabel(row.applicant),
    }));

    return sendResponse(res, 200, true, { items });
  } catch (err) {
    console.error("listRecentApplications error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load recent applications." });
  }
};

/** GET /employer/applications?jobId= */
export const listEmployerApplications = async (req, res) => {
  try {
    const employerId = req.user.id;
    const jobId = req.query.jobId != null ? String(req.query.jobId).trim() : "";

    const filter = { employer: employerId };
    if (jobId) {
      if (!mongoose.Types.ObjectId.isValid(jobId)) {
        return sendResponse(res, 400, false, { message: "Invalid job id." });
      }
      const job = await JobPost.findOne({ _id: jobId, employer: employerId }).select("_id").lean();
      if (!job) {
        return sendResponse(res, 404, false, { message: "Job not found." });
      }
      filter.job = job._id;
    }

    const rows = await JobApplication.find(filter)
      .sort({ createdAt: -1 })
      .populate("job", "title city area minExperience jobType status")
      .populate("applicant", "firstName lastName email phone city workStatus years months")
      .lean();

    const items = rows.map((row) => {
      const u = row.applicant;
      const expParts = [];
      if (u?.workStatus) expParts.push(u.workStatus);
      if (u?.years && u.years !== "00") expParts.push(`${u.years}y`);
      if (u?.months && u.months !== "00") expParts.push(`${u.months}m`);

      return {
        id: row._id,
        status: row.status,
        appliedAt: row.createdAt,
        job: row.job
          ? {
              id: row.job._id,
              title: row.job.title,
              city: row.job.city,
              area: row.job.area,
              minExperience: row.job.minExperience,
              jobType: row.job.jobType,
            }
          : null,
        candidate: {
          id: u?._id,
          name: applicantLabel(u),
          email: u?.email,
          phone: u?.phone,
          city: u?.city,
          experience: expParts.length ? expParts.join(" · ") : "—",
        },
      };
    });

    return sendResponse(res, 200, true, { items });
  } catch (err) {
    console.error("listEmployerApplications error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load applications." });
  }
};

/** GET /employer/applications/:applicationId — full application for employer */
export const getEmployerApplicationById = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { applicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return sendResponse(res, 400, false, { message: "Invalid application id." });
    }

    const row = await JobApplication.findOne({
      _id: applicationId,
      employer: employerId,
    })
      .populate("job", "title city area minExperience jobType status hiringFor")
      .populate("applicant", "firstName lastName email phone city workStatus years months")
      .lean();

    if (!row) {
      return sendResponse(res, 404, false, { message: "Application not found." });
    }

    const u = row.applicant;
    const expParts = [];
    if (u?.workStatus) expParts.push(u.workStatus);
    if (u?.years && u.years !== "00") expParts.push(`${u.years}y`);
    if (u?.months && u.months !== "00") expParts.push(`${u.months}m`);

    const job = row.job;
    return sendResponse(res, 200, true, {
      application: {
        id: row._id,
        status: row.status,
        appliedAt: row.createdAt,
        updatedAt: row.updatedAt,
        coverLetter: row.coverLetter ? String(row.coverLetter) : "",
        screening: formatScreeningForClient(row.screening),
        job: job
          ? {
              id: job._id,
              title: job.title,
              city: job.city,
              area: job.area,
              minExperience: job.minExperience,
              jobType: job.jobType,
              hiringFor: job.hiringFor,
            }
          : null,
        candidate: {
          id: u?._id,
          name: applicantLabel(u),
          email: u?.email,
          phone: u?.phone,
          city: u?.city,
          experience: expParts.length ? expParts.join(" · ") : "—",
        },
      },
    });
  } catch (err) {
    console.error("getEmployerApplicationById error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load application." });
  }
};

/** PATCH /employer/applications/:applicationId/status — update pipeline status */
export const patchApplicationStatus = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { applicationId } = req.params;
    const { status } = req.body;

    const allowed = ["submitted", "shortlisted", "interview_scheduled", "rejected", "hired"];
    if (!allowed.includes(status)) {
      return sendResponse(res, 400, false, { message: "Invalid status." });
    }
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return sendResponse(res, 400, false, { message: "Invalid application id." });
    }

    const app = await JobApplication.findOne({
      _id: applicationId,
      employer: employerId,
    });
    if (!app) {
      return sendResponse(res, 404, false, { message: "Application not found." });
    }

    app.status = status;
    await app.save();
    await app.populate([{ path: "job", select: "title" }]);

    const jobTitle = app.job?.title || "the role";
    const statusLabel = STATUS_LABELS[status] || status;
    try {
      await createNotificationForUser({
        userId: app.applicant,
        type: "application_status",
        title: "Application status updated",
        message: `Your application for “${jobTitle}” is now ${statusLabel}.`,
        meta: {
          applicationId: String(app._id),
          jobId: String(app.job?._id || app.job),
          status,
        },
      });
    } catch (notifyErr) {
      console.error("patchApplicationStatus notify error:", notifyErr);
    }

    return sendResponse(res, 200, true, {
      message: "Status updated.",
      application: { id: app._id, status: app.status },
    });
  } catch (err) {
    console.error("patchApplicationStatus error:", err);
    return sendResponse(res, 500, false, { message: "Failed to update status." });
  }
};
