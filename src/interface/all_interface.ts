import { Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;

  /* =======================
     BASIC PROFILE
  ======================= */
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;

  profileImg?: {
    public_id: string;
    secure_url: string;
  };

  gender: "male" | "female" | "other";
  bio?: string;

  role: "admin" | "user";

  /* =======================
     ACCOUNT / OTP STATUS
  ======================= */
  user: {
    isAccountActive: boolean;
    UserOTP: number;
    isOtpVerified: boolean;
    expireOTP: Date | null;
  };

  emailVerification: {
    newEmail: string | null;
    otp: string | null;
    expire: Date | null;
  };

  /* =======================
     MESSAGING / SOCIAL
  ======================= */
  contacts: Types.ObjectId[];
  blockedUsers: Types.ObjectId[];

  lastSeen: Date;
  isOnline: boolean;
  isTyping?: boolean;

  status?: "online" | "offline" | "away" | "busy";

  /* =======================
     AUTH & SECURITY
  ======================= */
  refreshToken?: string;

  emailVerificationToken?: string;
  emailVerificationExpires?: Date;

  passwordResetToken?: string;
  passwordResetExpires?: Date;

  /* =======================
     SOCKET / DEVICE
  ======================= */
  socketId?: string;
  deviceInfo?: {
    device: string;
    os: string;
    browser: string;
  };

  /* =======================
     SETTINGS
  ======================= */
  settings?: {
    notifications?: boolean;
    readReceipts?: boolean;
    lastSeenVisibility?: "everyone" | "contacts" | "nobody";
  };

  /* =======================
     TIMESTAMPS
  ======================= */
  createdAt: Date;
  updatedAt: Date;
}
 