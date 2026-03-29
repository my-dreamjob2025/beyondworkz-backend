import mongoose from "mongoose";

const STATUSES = ["submitted", "shortlisted", "interview_scheduled", "rejected", "hired"];

const jobApplicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
      index: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "submitted",
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

jobApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

export default mongoose.model("JobApplication", jobApplicationSchema);
export { STATUSES as JOB_APPLICATION_STATUSES };
