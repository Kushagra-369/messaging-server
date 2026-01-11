import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Users from "../model/user_model";

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
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

        existingUser.user.UserOTP = otp;
        existingUser.user.expireOTP = otpExpire;

        await existingUser.save();

        return res.status(200).json({
          success: true,
          message: "OTP resent. Please verify your account.",
          next: "VERIFY_OTP", // 👈 frontend uses this
          otp, // ⚠️ remove in production
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
        next: "LOGIN", // 👈 frontend uses this
      });
    }

    /* =======================
       CREATE NEW USER
    ======================= */
    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = crypto.randomInt(100000, 999999).toString();
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
      next: "VERIFY_OTP", // 👈 frontend uses this
      otp, // ⚠️ remove in production
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
