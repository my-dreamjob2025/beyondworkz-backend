import mongoose from "mongoose";
import JobApplication from "../../models/jobApplication.model.js";
import EmployerProfile from "../../models/employerProfile.model.js";
import User from "../../models/user.model.js";
import { sendResponse } from "../../utils/response.js";
import { formatScreeningForClient } from "../../utils/applicationScreening.js";
import { JOB_APPLICATION_STATUSES } from "../../models/jobApplication.model.js";

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applicantName(u) {
  if (!u) return "Candidate";
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.email || "Candidate";
}

/** GET /admin/applications */
export const listApplications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const employerId = typeof req.query.employerId === "string" ? req.query.employerId.trim() : "";
    const jobId = typeof req.query.jobId === "string" ? req.query.jobId.trim() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const filter = {};

    if (status && JOB_APPLICATION_STATUSES.includes(status)) {
      filter.status = status;
    }
    if (employerId && mongoose.Types.ObjectId.isValid(employerId)) {
      filter.employer = employerId;
    }
    if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      filter.job = jobId;
    }

    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      const matchingApplicants = await User.find({
        role: "employee",
        $or: [{ email: re }, { firstName: re }, { lastName: re }, { phone: re }],
      })
        .select("_id")
        .lean();
      const ids = matchingApplicants.map((u) => u._id);
      if (ids.length === 0) {
        return sendResponse(res, 200, true, { items: [], total: 0, page, limit });
      }
      filter.applicant = { $in: ids };
    }

    const [rows, total] = await Promise.all([
      JobApplication.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("job", "title city area")
        .populate("applicant", "firstName lastName email phone")
        .populate("employer", "email firstName lastName")
        .lean(),
      JobApplication.countDocuments(filter),
    ]);

    const employerUserIds = [...new Set(rows.map((r) => r.employer && String(r.employer._id)).filter(Boolean))];
    const profiles = await EmployerProfile.find({
      user: { $in: employerUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select("user companyDetails.companyName")
      .lean();
    const companyByUser = Object.fromEntries(
      profiles.map((p) => [String(p.user), p.companyDetails?.companyName?.trim() || ""])
    );

    const items = rows.map((row) => ({
      id: row._id,
      status: row.status,
      appliedAt: row.createdAt,
      updatedAt: row.updatedAt,
      job: row.job
        ? {
            id: row.job._id,
            title: row.job.title || "—",
            city: row.job.city,
            area: row.job.area,
          }
        : null,
      applicant: row.applicant
        ? {
            id: row.applicant._id,
            name: applicantName(row.applicant),
            email: row.applicant.email,
          }
        : null,
      employer: row.employer
        ? {
            id: row.employer._id,
            label: companyByUser[String(row.employer._id)] || row.employer.email || "Employer",
          }
        : null,
    }));

    return sendResponse(res, 200, true, { items, total, page, limit });
  } catch (err) {
    console.error("listApplications error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load applications." });
  }
};

/** GET /admin/applications/:id */
export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, { message: "Invalid application id." });
    }

    const row = await JobApplication.findById(id)
      .populate("job", "title city area minExperience jobType status hiringFor")
      .populate("applicant", "firstName lastName email phone city workStatus years months")
      .populate("employer", "email firstName lastName")
      .lean();

    if (!row) {
      return sendResponse(res, 404, false, { message: "Application not found." });
    }

    let companyName = "";
    if (row.employer?._id) {
      const prof = await EmployerProfile.findOne({ user: row.employer._id })
        .select("companyDetails.companyName")
        .lean();
      companyName = prof?.companyDetails?.companyName?.trim() || "";
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
              listingStatus: job.status,
            }
          : null,
        applicant: u
          ? {
              id: u._id,
              name: applicantName(u),
              email: u.email,
              phone: u.phone,
              city: u.city,
              experience: expParts.length ? expParts.join(" · ") : "—",
            }
          : null,
        employer: row.employer
          ? {
              id: row.employer._id,
              email: row.employer.email,
              companyName: companyName || null,
              label: companyName || row.employer.email || "Employer",
            }
          : null,
      },
    });
  } catch (err) {
    console.error("getApplicationById error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load application." });
  }
};
