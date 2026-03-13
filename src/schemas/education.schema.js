import mongoose from "mongoose";

export const educationSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: [
        "10th",
        "12th",
        "Diploma",
        "Undergraduate",
        "Postgraduate",
        "Doctorate",
        "Other",
      ],
    },

    degree: { type: String, trim: true },

    institution: { type: String, trim: true },

    boardOrUniversity: { type: String, trim: true },

    fieldOfStudy: { type: String, trim: true },

    gradeOrPercentage: { type: String, trim: true },

    startDate: Date,

    endDate: Date,

    currentlyStudying: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);
