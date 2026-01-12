import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import Users from "../model/user_model";
import jwt from "jsonwebtoken";

export const create_users = async (req: Request, res: Response) => {
  try {
    const {
      username,
      first_name,
      last_name,
      email,
      password,
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

    /* =======================
       USER EXISTS
    ======================= */
    if (existingUser) {
      // 🔴 CASE 1: OTP NOT VERIFIED → RESEND OTP
      if (!existingUser.user.isOtpVerified) {
        const otp = crypto.randomInt(100000, 999999); // ✅ number
        const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

        existingUser.user.UserOTP = otp;
        existingUser.user.expireOTP = otpExpire;

        await existingUser.save();

        return res.status(200).json({
          success: true,
          message: "OTP resent. Please verify your account.",
          next: "VERIFY_OTP",
          otp, // ⚠️ REMOVE in production
          user: {
            id: existingUser._id,
            email: existingUser.email,
          },
        });
      }

      // 🔴 CASE 2: OTP VERIFIED → GO TO LOGIN
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

    const otp = crypto.randomInt(100000, 999999); // ✅ number
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

    const user = await Users.create({
      username,
      first_name,
      last_name,
      email,
      password: hashedPassword,
      user: {
        isAccountActive: true,
        UserOTP: otp,
        isOtpVerified: false,
        expireOTP: otpExpire,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User created. OTP sent for verification.",
      next: "VERIFY_OTP",
      otp, // ⚠️ REMOVE in production
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    /* =======================
       OTP CHECK (CRITICAL)
    ======================= */
    if (!user.user.isOtpVerified) {
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
       JWT ISSUE
    ======================= */
    if (!process.env.JWT_User_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "JWT secret not configured",
      });
    }

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