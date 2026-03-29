import mongoose from "mongoose";
import JobApplication from "../../models/jobApplication.model.js";
import { sendResponse } from "../../utils/response.js";

function companyLabel(job) {
  if (!job) return "Employer";
  const h = job.hiringFor && String(job.hiringFor).trim();
  return h || "Employer";
}

function statusLabel(status) {
  const map = {
    submitted: "Applied",
    shortlisted: "Shortlisted",
    interview_scheduled: "Interview scheduled",
    rejected: "Rejected",
    hired: "Hired",
  };
  return map[status] || status;
}

/** GET /employee/applications — current user's applications + status counts */
export const listMyApplications = async (req, res) => {
  try {
    const applicantId = req.user.id;

    const [rows, total, agg] = await Promise.all([
      JobApplication.find({ applicant: applicantId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .populate({
          path: "job",
          select: "title city area status hiringFor",
        })
        .lean(),
      JobApplication.countDocuments({ applicant: applicantId }),
      JobApplication.aggregate([
        { $match: { applicant: new mongoose.Types.ObjectId(String(applicantId)) } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
    ]);

    const byStatus = {
      submitted: 0,
      shortlisted: 0,
      interview_scheduled: 0,
      rejected: 0,
      hired: 0,
    };
    for (const row of agg) {
      if (row._id && byStatus[row._id] !== undefined) byStatus[row._id] = row.n;
    }

    const items = rows.map((row) => {
      const job = row.job;
      return {
        id: row._id,
        status: row.status,
        statusLabel: statusLabel(row.status),
        appliedAt: row.createdAt,
        updatedAt: row.updatedAt,
        job: job
          ? {
              id: job._id,
              title: job.title || "Role",
              city: job.city,
              area: job.area,
              hiringFor: job.hiringFor,
              listingStatus: job.status,
            }
          : null,
        companyLabel: companyLabel(job),
      };
    });

    return sendResponse(res, 200, true, {
      items,
      total,
      byStatus,
      interviewCount: byStatus.interview_scheduled,
    });
  } catch (err) {
    console.error("listMyApplications error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load applications." });
  }
};
