import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../model/user_model";
import { AuthRequest } from "../types/auth-request";

interface DecodedToken {
  id: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const secret = process.env.JWT_User_SECRET_KEY;

    // 🔒 HARD NARROWING
    if (typeof secret !== "string") {
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    // ✅ TS NOW KNOWS secret IS string
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("id" in decoded)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    const { id } = decoded as DecodedToken;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findById(id).select("_id");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = {
      id: user._id.toString(),
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
