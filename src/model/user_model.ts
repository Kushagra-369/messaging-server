import mongoose, { Schema, Model } from "mongoose";
import { IUser } from "../interface/all_interface";

const UserSchema: Schema<IUser> = new Schema(
  {
    /* =======================
       BASIC PROFILE
    ======================= */
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    first_name: {
      type: String,
      required: true,
      trim: true,
    },

    last_name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    profileImg: {
      public_id: { type: String },
      secure_url: { type: String },
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    bio: {
      type: String,
      maxlength: 300,
    },

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },

    /* =======================
       ACCOUNT / OTP STATUS
    ======================= */
    user: {
      isAccountActive: {
        type: Boolean,
        default: true,
      },
      UserOTP: {
        type: Number,
        default: null,
        select: false,
      },
      isOtpVerified: {
        type: Boolean,
        default: false,
      },
      expireOTP: {
        type: Date,
        default: null,
      },
    },

    emailVerification: {
      newEmail: { type: String, default: null },
      otp: { type: String, default: null, select: false },
      expire: { type: Date, default: null },
    },

    /* =======================
       MESSAGING / SOCIAL
    ======================= */
    contacts: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    isTyping: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["online", "offline", "away", "busy"],
      default: "offline",
    },

    /* =======================
       AUTH & SECURITY
    ======================= */
    refreshToken: {
      type: String,
      select: false,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
    },

    /* =======================
       SOCKET / DEVICE
    ======================= */
    socketId: {
      type: String,
    },

    deviceInfo: {
      device: { type: String },
      os: { type: String },
      browser: { type: String },
    },

    
    settings: {
      notifications: {
        type: Boolean,
        default: true,
      },
      readReceipts: {
        type: Boolean,
        default: true,
      },
      lastSeenVisibility: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
    },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
