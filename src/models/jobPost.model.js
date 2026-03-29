import mongoose from "mongoose";

const screeningSchema = new mongoose.Schema(
  {
    experience: { type: Boolean, default: false },
    locationComfort: { type: Boolean, default: false },
    immediateJoin: { type: Boolean, default: false },
    salaryComfort: { type: Boolean, default: false },
    customQuestions: { type: [String], default: [] },
    preferredExperience: { type: String, default: "" },
    preferredEducation: { type: String, default: "" },
    autoShortlist: { type: Boolean, default: false },
  },
  { _id: false }
);

const benefitsSchema = new mongoose.Schema(
  {
    healthInsurance: { type: Boolean, default: false },
    travelAllowance: { type: Boolean, default: false },
    pf: { type: Boolean, default: false },
    esi: { type: Boolean, default: false },
    incentives: { type: Boolean, default: false },
  },
  { _id: false }
);

const bonusesSchema = new mongoose.Schema(
  {
    performance: { type: Boolean, default: false },
    joining: { type: Boolean, default: false },
    commission: { type: Boolean, default: false },
  },
  { _id: false }
);

const jobPostSchema = new mongoose.Schema(
  {
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployerProfile",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "draft",
      index: true,
    },

    listingType: {
      type: String,
      enum: ["standard", "featured"],
      default: "standard",
    },

    hiringFor: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    jobType: { type: String, trim: true, default: "Full Time" },
    openings: { type: Number, min: 1, default: 1 },
    city: { type: String, trim: true, default: "" },
    area: { type: String, trim: true, default: "" },

    description: { type: String, default: "" },
    responsibilities: { type: String, default: "" },
    skills: { type: [String], default: [] },
    minExperience: { type: String, trim: true, default: "" },
    education: { type: String, trim: true, default: "" },

    salaryType: { type: String, trim: true, default: "Salary Range" },
    minSalary: { type: String, trim: true, default: "" },
    maxSalary: { type: String, trim: true, default: "" },
    salaryPeriod: { type: String, trim: true, default: "Per Month" },

    benefits: { type: benefitsSchema, default: () => ({}) },
    bonuses: { type: bonusesSchema, default: () => ({}) },
    screening: { type: screeningSchema, default: () => ({}) },

    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

jobPostSchema.index({ employer: 1, status: 1, updatedAt: -1 });

export default mongoose.model("JobPost", jobPostSchema);
