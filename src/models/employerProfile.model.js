import mongoose from "mongoose";

const employerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    companyDetails: {
      companyName: { type: String, trim: true, index: true },

      legalBusinessName: String,

      industryType: { type: String, index: true },

      companyType: {
        type: String,
        enum: [
          "Private",
          "Public",
          "Startup",
          "Government",
          "NGO",
          "Proprietorship",
          "Partnership",
          "Other",
        ],
      },

      companySize: {
        type: String,
        enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
      },

      foundedYear: Number,

      description: String,
    },

    companySocialMedia: {
      linkedin: String,

      website: String,

      logo: {
        url: String,
        key: String,
      },

      coverImage: {
        url: String,
        key: String,
      },
    },

    address: {
      addressLine1: String,

      addressLine2: String,

      city: { type: String, index: true },

      state: String,

      country: { type: String, default: "India" },

      pincode: String,
    },

    recruiters: [
      {
        firstName: String,
        lastName: String,
        position: String,
        contact: String,
        email: String,
        linkedin: String,
      },
    ],

    verified: {
      type: Boolean,
      default: false,
    },

    profileStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export default mongoose.model("EmployerProfile", employerProfileSchema);
