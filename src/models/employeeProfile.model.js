import mongoose from "mongoose";
import { experienceSchema } from "../schemas/experience.schema.js";
import { educationSchema } from "../schemas/education.schema.js";

const employeeProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    employeeType: {
      type: String,
      enum: ["white_collar", "blue_collar"],
      required: true,
    },

    whatsappNumber: String,

    location: String,

    availability: {
      type: String,
      enum: ["full-time", "part-time", "weekends"],
    },

    skills: [
      {
        name: String,
      },
    ],

    experience: [experienceSchema],

    education: [educationSchema],

    /* -------- BLUE COLLAR -------- */

    blueCollarDetails: {
      hasVehicleWashingExperience: Boolean,

      hasBikeOrScooty: Boolean,

      hasDrivingLicense: Boolean,

      preferredAreas: [String],
    },

    /* -------- WHITE COLLAR -------- */

    whiteCollarDetails: {
      linkedin: String,

      github: String,

      portfolio: String,

      resumeHeadline: { type: String, maxlength: 200 },

      bio: {
        type: String,
        maxlength: 500,
      },

      totalExperienceYears: Number,

      totalExperienceMonths: Number,

      resume: {
        key: String,
        url: String,
        size: Number,
        contentType: String,
        uploadedAt: Date,
      },

      projects: [
        {
          title: String,
          description: String,
          technologies: [String],
          liveUrl: String,
          githubUrl: String,
          startDate: Date,
          endDate: Date,
        },
      ],

      certifications: [
        {
          name: String,
          issuingOrganization: String,
          issueDate: Date,
          expiryDate: Date,
          credentialId: String,
          credentialUrl: String,
          doesNotExpire: Boolean,
        },
      ],
    },
  },
  { timestamps: true },
);

export default mongoose.model("EmployeeProfile", employeeProfileSchema);
