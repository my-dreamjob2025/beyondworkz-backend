import mongoose from "mongoose";
import JobPost from "../../models/jobPost.model.js";
import JobApplication from "../../models/jobApplication.model.js";
import { sendResponse } from "../../utils/response.js";

export const applyToJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const applicantId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return sendResponse(res, 400, false, { message: "Invalid job id." });
    }

    const job = await JobPost.findById(jobId).select("status employer title").lean();
    if (!job) {
      return sendResponse(res, 404, false, { message: "Job not found." });
    }
    if (job.status !== "published") {
      return sendResponse(res, 400, false, { message: "This job is not accepting applications." });
    }

    try {
      const created = await JobApplication.create({
        job: job._id,
        applicant: applicantId,
        employer: job.employer,
        status: "submitted",
      });
      return sendResponse(res, 201, true, {
        message: "Application submitted.",
        application: {
          id: created._id,
          jobId: String(job._id),
          status: created.status,
          appliedAt: created.createdAt,
        },
      });
    } catch (err) {
      if (err?.code === 11000) {
        return sendResponse(res, 409, false, {
          message: "You have already applied for this job.",
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("applyToJob error:", err);
    return sendResponse(res, 500, false, { message: "Could not submit application." });
  }
};
