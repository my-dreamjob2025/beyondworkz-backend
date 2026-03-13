import mongoose from "mongoose";

export const experienceSchema = new mongoose.Schema(
  {
    jobTitle: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    dateOfJoining: { type: Date, required: true },
    relievingDate: Date,
    current: { type: Boolean, default: false },
    location: { type: String, trim: true },
    description: { type: String, maxlength: 1000, trim: true },
    noticePeriod: { type: String, trim: true },
    currentCTC: Number,
    skillsUsed: [{ type: String, trim: true }],
  },
  { _id: true },
);
