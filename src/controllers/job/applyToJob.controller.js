import mongoose from "mongoose";
import JobPost from "../../models/jobPost.model.js";
import JobApplication from "../../models/jobApplication.model.js";
import User from "../../models/user.model.js";
import { sendResponse } from "../../utils/response.js";
import {
  validateApplicationScreening,
  normalizeCoverLetter,
} from "../../utils/applicationScreening.js";
import { createNotificationForUser, notifyAdmins } from "../../services/notification.service.js";

export const applyToJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const applicantId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return sendResponse(res, 400, false, { message: "Invalid job id." });
    }

    const job = await JobPost.findById(jobId).select("status employer title screening").lean();
    if (!job) {
      return sendResponse(res, 404, false, { message: "Job not found." });
    }
    if (job.status !== "published") {
      return sendResponse(res, 400, false, { message: "This job is not accepting applications." });
    }

    const coverResult = normalizeCoverLetter(req.body?.coverLetter);
    if (coverResult.error) {
      return sendResponse(res, 400, false, { message: coverResult.error });
    }

    const screeningCheck = validateApplicationScreening(job.screening, req.body);
    if (!screeningCheck.ok) {
      return sendResponse(res, 400, false, { message: screeningCheck.message });
    }

    const doc = {
      job: job._id,
      applicant: applicantId,
      employer: job.employer,
      status: "submitted",
      coverLetter: coverResult.value || "",
      screening: screeningCheck.normalized,
    };

    try {
      const created = await JobApplication.create(doc);

      const applicant = await User.findById(applicantId).select("firstName lastName email").lean();
      const applicantName =
        [applicant?.firstName, applicant?.lastName].filter(Boolean).join(" ").trim() ||
        applicant?.email ||
        "A candidate";
      const jobTitle = job.title || "your job";

      try {
        await createNotificationForUser({
          userId: job.employer,
          type: "application_received",
          title: "New application received",
          message: `${applicantName} applied for ${jobTitle}.`,
          meta: {
            jobId: String(job._id),
            applicationId: String(created._id),
          },
        });
        await notifyAdmins({
          type: "admin_new_application",
          title: "New job application",
          message: `${applicantName} applied to “${jobTitle}”.`,
          meta: {
            jobId: String(job._id),
            applicationId: String(created._id),
            employerId: String(job.employer),
          },
        });
      } catch (notifyErr) {
        console.error("applyToJob notify error:", notifyErr);
      }

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
