import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import Users from "../model/user_model";
import mongoose from "mongoose";
import jwt, { JwtPayload } from "jsonwebtoken";

export const create_users = async (req: Request, res: Response) => {
  try {
    const {
      username,
      first_name,
      last_name,
      email,
      password,
    }: {
      username?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      password?: string;
    } = req.body;

    /* =======================
       VALIDATION
    ======================= */
    if (
      !username ||
      !first_name ||
      !last_name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    /* =======================
       CHECK EXISTING USER
    ======================= */
    const existingUser = await Users.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      if (!existingUser.user?.isOtpVerified) {
        const otp = crypto.randomInt(100000, 999999);
        const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

        existingUser.user = {
          isAccountActive: existingUser.user?.isAccountActive ?? true,
          UserOTP: otp,
          isOtpVerified: false,
          expireOTP: otpExpire,
        };

        await existingUser.save();

        return res.status(200).json({
          success: true,
          message: "OTP resent. Please verify your account.",
          next: "VERIFY_OTP",
          otp,
          user: {
            id: existingUser._id,
            email: existingUser.email,
          },
        });
      }

      return res.status(409).json({
        success: false,
        message: "Account already exists. Please login.",
        next: "LOGIN",
      });
    }

    /* =======================
       CREATE NEW USER
    ======================= */
    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = crypto.randomInt(100000, 999999);
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

    const user = await Users.create({
      username,
      first_name,
      last_name,
      email,
      password: hashedPassword,
      role: "user",

      user: {
        isAccountActive: true,
        UserOTP: otp,
        isOtpVerified: false,
        expireOTP: otpExpire,
      },

      profileImg: {
        public_id: "",
        secure_url: "",
      },

      gender: "",
      bio: "",

      emailVerification: {
        newEmail: "",
        otp: "",
        expire: null,
      },

      contacts: [],
      blockedUsers: [],

      isOnline: false,
      isTyping: false,
      status: "offline",

      deviceInfo: {
        device: "",
        os: "",
        browser: "",
      },

      refreshToken: "",
      socketId: "",

      settings: {
        notifications: true,
        readReceipts: true,
        lastSeenVisibility: "everyone",
      },
    });


    return res.status(201).json({
      success: true,
      message: "User created. OTP sent for verification.",
      next: "VERIFY_OTP",
      otp,
      user: {
        id: user._id,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const verify_otp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || otp === undefined) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const numericOtp = Number(otp);

    if (Number.isNaN(numericOtp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be a number",
      });
    }

    const user = await Users.findOne({ email }).select(
      "+user.UserOTP +user.expireOTP"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.user.isOtpVerified) {
      return res.status(409).json({
        success: false,
        message: "OTP already verified. Please login.",
        next: "LOGIN",
      });
    }

    if (!user.user.expireOTP || user.user.expireOTP < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one.",
        next: "RESEND_OTP",
      });
    }

    if (user.user.UserOTP !== numericOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // ✅ VERIFIED
    user.user.isOtpVerified = true;
    user.user.UserOTP = Number(null);
    user.user.expireOTP = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. Please login.",
      next: "LOGIN",
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const resend_otp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (user.user.isOtpVerified) {
      return res.status(409).json({
        success: false,
        message: "OTP already verified. Please login.",
        next: "LOGIN",
      });
    }
    const otp = crypto.randomInt(100000, 999999); // ✅ number
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000);
    user.user.UserOTP = otp;
    user.user.expireOTP = otpExpire;
    await user.save();
    return res.status(200).json({
      success: true,
      message: "OTP resent successfully.",
      otp, // ⚠️ REMOVE in production
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const user_login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    /* =======================
       VALIDATION
    ======================= */
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    /* =======================
       FIND USER
    ======================= */
    const user = await Users.findOne({ email }).select("+password");

    // 🔴 USER DELETED OR NOT FOUND
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        next: "SIGNIN",
      });
    }

    /* =======================
       ACCOUNT ACTIVE CHECK
    ======================= */
    if (!user.user?.isAccountActive) {
      return res.status(403).json({
        success: false,
        message: "Account is disabled. Please contact support.",
        next: "SIGNIN",
      });
    }

    /* =======================
       OTP VERIFICATION CHECK
    ======================= */
    if (!user.user?.isOtpVerified) {
      return res.status(403).json({
        success: false,
        message: "Account not verified. Please verify OTP.",
        next: "VERIFY_OTP",
      });
    }

    /* =======================
       PASSWORD CHECK
    ======================= */
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    /* =======================
       JWT CONFIG CHECK
    ======================= */
    if (!process.env.JWT_User_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "JWT secret not configured",
      });
    }

    /* =======================
       GENERATE JWT
    ======================= */
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_User_SECRET_KEY,
      { expiresIn: "7d" }
    );

    /* =======================
       UPDATE USER STATE
    ======================= */
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    /* =======================
       RESPONSE
    ======================= */
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

interface UserJwtPayload extends JwtPayload {
  id: string;
  role?: string;
}

export const auth_me = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ success: false });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ success: false });
    }

    const token = parts[1];
    if (!token) {
      return res.status(401).json({ success: false });
    }

    const rawSecret = process.env.JWT_User_SECRET_KEY;
    if (!rawSecret) {
      return res.status(500).json({
        success: false,
        message: "JWT secret not configured",
      });
    }

    const decoded = jwt.verify(token, rawSecret);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("id" in decoded)
    ) {
      return res.status(401).json({ success: false });
    }

    const payload = decoded as UserJwtPayload;

    const user = await Users.findById(payload.id);

    // 🔑 ONLY THESE TWO CHECKS MATTER FOR SESSION
    if (!user || !user.user?.isAccountActive) {
      return res.status(401).json({ success: false });
    }

    // ❌ NO OTP CHECK HERE

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });

  } catch {
    return res.status(401).json({ success: false });
  }
};

export const user_profile_update = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      })
    }


    const objectUserId = new mongoose.Types.ObjectId(userId)

    // Allowed fields
    const { name, username, email, gender, bio } = req.body

    const updateData: Partial<{
      name: string
      username: string
      email: string
      gender: string
      bio: string
    }> = {}

    if (name) updateData.name = name
    if (username) updateData.username = username
    if (email) updateData.email = email
    if (gender) updateData.gender = gender
    if (bio) updateData.bio = bio

    // Username uniqueness check
    if (username) {
      const existingUsername = await Users.exists({
        username,
        _id: { $ne: objectUserId },
      })

      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        })
      }
    }

    // Email uniqueness check
    if (email) {
      const existingEmail = await Users.exists({
        email,
        _id: { $ne: objectUserId },
      })

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        })
      }
    }

    const user = await Users.findByIdAndUpdate(
      objectUserId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    })
  } catch (error) {
    console.error("User profile update error:", error)
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
}

export const get_user_by_id = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false, 
        message: "Invalid user id",
      })
    }
    const user = await Users.findById(userId).select("-password")
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found",
      })
    }
    return res.status(200).json({
      success: true,
      user,
    })
  } catch (error) {
    console.error("Get user by id error:", error)
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
}