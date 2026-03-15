import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const OTP_TTL_MINUTES = 10;
const OTP_LENGTH = 6;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    googleId: { type: String, sparse: true, select: false },

    role: {
      type: String,
      enum: ["employee", "employer", "admin"],
      default: "employee",
    },

    employeeType: {
      type: String,
      enum: ["whitecollar", "bluecollar"],
      default: null,
    },

    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    phone: { type: String, trim: true },
    city: { type: String, trim: true },
    workStatus: { type: String, enum: ["Fresher", "Experienced"] },
    years: { type: String, default: "00" },
    months: { type: String, default: "00" },

    avatar: {
      key: { type: String },
      url: { type: String },
    },

    whatsappConsent: { type: Boolean, default: false },
    termsConsent: { type: Boolean, default: false },

    // OTP
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpResendAfter: { type: Date, select: false },

    // Admin
    isBlocked: { type: Boolean, default: false },

    // Profile
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    profileCompletion: { type: Number, default: 0, min: 0, max: 100 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ role: 1 });
userSchema.index({ employeeType: 1 });

// === OTP METHODS ===
userSchema.methods.generateOTP = async function () {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < OTP_LENGTH; i++)
    otp += digits[Math.floor(Math.random() * 10)];
  this.otpHash = await bcrypt.hash(otp, 10);
  this.otpExpires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  this.otpResendAfter = new Date(Date.now() + 30 * 1000);
  this.otpAttempts = 0;
  await this.save();
  return otp;
};

userSchema.methods.verifyOTP = async function (otp) {
  if (!this.otpHash || !this.otpExpires || new Date() > this.otpExpires)
    return false;
  const valid = await bcrypt.compare(otp, this.otpHash);
  if (!valid) {
    this.otpAttempts += 1;
    await this.save();
    return false;
  }
  this.otpHash = null;
  this.otpExpires = null;
  this.otpAttempts = 0;
  this.otpResendAfter = null;
  this.isEmailVerified = true;
  await this.save();
  return true;
};

const User = mongoose.model("User", userSchema);
export default User;
