import mongoose from "mongoose";
import { COVER_LETTER_MAX } from "../utils/applicationScreening.js";

const STATUSES = ["submitted", "shortlisted", "interview_scheduled", "rejected", "hired"];

const screeningAnswerSchema = new mongoose.Schema(
  {
    question: { type: String, trim: true, default: "" },
    answer: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const applicationScreeningSchema = new mongoose.Schema(
  {
    acknowledgments: {
      experience: { type: Boolean, default: undefined },
      locationComfort: { type: Boolean, default: undefined },
      immediateJoin: { type: Boolean, default: undefined },
      salaryComfort: { type: Boolean, default: undefined },
    },
    customAnswers: { type: [screeningAnswerSchema], default: [] },
  },
  { _id: false }
);

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
    coverLetter: {
      type: String,
      maxlength: COVER_LETTER_MAX,
      default: "",
    },
    screening: {
      type: applicationScreeningSchema,
      default: undefined,
    },
  },
  { timestamps: true, versionKey: false }
);

jobApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

export default mongoose.model("JobApplication", jobApplicationSchema);
export { STATUSES as JOB_APPLICATION_STATUSES };
