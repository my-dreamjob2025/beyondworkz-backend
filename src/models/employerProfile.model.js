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

      /** Single-line HQ label from onboarding (optional; address.city may also be used) */
      headquarters: { type: String, trim: true },
    },

    hiringPreferences: {
      defaultJobLocation: { type: String, trim: true },
      defaultEmploymentType: { type: String, trim: true },
      applicationEmail: { type: String, trim: true },
      responseSLA: { type: String, trim: true },
      autoArchiveInactiveJobs: { type: Boolean, default: false },
    },

    companySocialMedia: {
      linkedin: String,

      website: String,

      glassdoor: String,

      careersPage: String,

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
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        firstName: String,
        lastName: String,
        position: String,
        contact: String,
        email: String,
        linkedin: String,
        status: { type: String, enum: ["invited", "active"], default: "invited" },
      },
    ],

    /** KYC: Certificate of Incorporation / registration, company PAN card, etc. */
    verificationDocuments: {
      certificateOfIncorporation: {
        key: String,
        url: String,
        fileName: String,
        contentType: String,
        size: Number,
        uploadedAt: Date,
      },
      companyPanCard: {
        key: String,
        url: String,
        fileName: String,
        contentType: String,
        size: Number,
        uploadedAt: Date,
      },
    },

    verified: {
      type: Boolean,
      default: false,
    },

    /**
     * pending — employer has not submitted for admin review (or is editing after rejection).
     * pending_review — submitted; awaiting admin.
     * needs_revision — admin requested changes (see adminQuery).
     * approved — can post jobs (verified flag should be true).
     * rejected — admin rejected registration.
     * suspended — admin suspended the company account.
     */
    profileStatus: {
      type: String,
      enum: ["pending", "pending_review", "approved", "rejected", "needs_revision", "suspended"],
      default: "pending",
    },

    /** Shown to employer when profileStatus is needs_revision */
    adminQuery: { type: String, trim: true },

    /** Shown to employer when profileStatus is rejected */
    rejectionReason: { type: String, trim: true },

    verificationSubmittedAt: Date,
    verificationReviewedAt: Date,
    verificationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.model("EmployerProfile", employerProfileSchema);
