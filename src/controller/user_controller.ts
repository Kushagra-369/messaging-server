import { Request, Response } from "express";
import User from "../model/user_model";
import { errorHandler } from '../middleware/error_handling';
import { NewUserOtp } from '../mobile/otp';
import crypto from 'crypto';
import { otpVerificationUserMessage, transporter } from "../mail/user_mail";
import { upload_project_img, deleteImg } from "../image/upload";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Profile } from "passport-google-oauth20";

export const create_user = async (req: Request, res: Response) => {
    try {
        const {
            username,
            first_name,
            last_name,
            email,
            country_code,
            password,
            mobile_No,
            gender,
        } = req.body;

        const file = req.file;

        // 🔥 generate OTP
        const otp = crypto.randomInt(1000, 10000);
        const otpExpires = Date.now() + 5 * 60 * 1000;

        // 🔍 check user exists
        const userExists = await User.findOne({ email });


        /* ===================================================
            CASE 1️⃣  USER EXISTS
        =================================================== */
        if (userExists) {
            // 👉 already verified → go login
            if (userExists.verification?.isVerify) {
                return res.status(409).json({
                    message: "User already verified",
                    next: "LOGIN",
                });
            }

            // 👉 NOT VERIFIED → resend OTP
            userExists.verification.emailotp = otp;
            userExists.verification.mobileotp = otp;
            userExists.verification.otpExpires = otpExpires;

            await userExists.save();

            await otpVerificationUserMessage(
                userExists.first_name,
                userExists.email,
                otp
            );

            if (userExists.mobile_No) {
                await NewUserOtp(
                    userExists.first_name,
                    userExists.last_name,
                    userExists.mobile_No,
                    otp
                );
            }

            return res.status(201).json({
                message: "OTP resent",
                user: { _id: userExists._id }, // 👈 IMPORTANT
            });
        }

        /* ===================================================
            CASE 2️⃣  NEW USER CREATE
        =================================================== */

        let profileImg: any = null;

        if (file) {
            profileImg = await upload_project_img(file.path);
        }

        const bcryptPassword = await bcrypt.hash(password, 10);

        const verification = {
            emailotp: otp,
            mobileotp: otp,
            otpExpires,
        };

        const user = await User.create({
            username,
            first_name,
            last_name,
            email,
            country_code,
            password: bcryptPassword,
            mobile_No,
            gender,
            profileImg,
            verification,
        });

        // 🔥 SEND OTP
        await otpVerificationUserMessage(first_name, email, otp);

        if (mobile_No) {
            await NewUserOtp(first_name, last_name, mobile_No, otp);
        }

        return res.status(201).json({
            status: true,
            message: "User created & OTP sent",
            user: { _id: user._id }, // 👈 IMPORTANT FOR FRONTEND
        });
    } catch (err: unknown) {
        return errorHandler(err, res);
    }
};


// above create_user if user send password and exiting mail or mobile number updated password

export const user_otp_verification = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { otp } = req.body;

        console.log("OTP from body:", otp);


        const user = await User.findById(userId);

        if (!user) { return res.status(404).json({ message: 'User not found!' }); }

        const lockDurations = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000, 3 * 60 * 60 * 1000, 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000, 30 * 24 * 60 * 60 * 1000, 365 * 24 * 60 * 60 * 1000] // 5 min, 15 min,  1 hr, 3 hr

        if (user.verification.lockUntil && user.verification.lockUntil > new Date()) {
            const remainingTime = Math.ceil((user.verification.lockUntil.getTime() - Date.now()) / 1000);
            return res.status(403).json({ message: `Account is locked. Try again in ${remainingTime} seconds.` });
        }
        if (otp !== user.verification.emailotp && otp !== user.verification.mobileotp) {
            user.verification.wrongAttempts += 1;

            if (user.verification.wrongAttempts % 3 === 0) {
                const lockTime = lockDurations[Math.min(Math.floor(user.verification.wrongAttempts / 3) - 1, lockDurations.length - 1)] ?? lockDurations[lockDurations.length - 1];

                user.verification.lockUntil = new Date(Date.now() + (lockTime ?? 0));
            }

            await user.save();
            let attemptsLeft = 3 - (user.verification.wrongAttempts % 3);
            if (attemptsLeft === 3) attemptsLeft = 0;

            let message = "Invalid OTP!";
            if (attemptsLeft > 0) {
                message += ` ${attemptsLeft} attempts left`;
            }

            return res.status(400).json({ message });
        }

        user.verification.isVerify = true;
        user.verification.isEmailVerified = true;
        user.verification.isMobileVerified = true;
        user.verification.wrongAttempts = 0;
        user.verification.lockUntil = null;

        await user.save();

        res.status(200).json({ message: 'OTP verified successfully!' });

    }

    catch (err) { return errorHandler(err, res); }
}

export const user_login = async (req: Request, res: Response) => {
    try {
        const { email, password, username, mobile_No } = req.body;

        if (!password) {
            return res.status(400).json({ message: "Password is required!" });
        }

        // 👤 atleast one identifier compulsory
        if (!email && !username && !mobile_No) {
            return res.status(400).json({
                message: "Email, username or mobile number is required!"
            });
        }

        const orConditions: any[] = [];

        if (email) orConditions.push({ email });
        if (username) orConditions.push({ username });
        if (mobile_No) orConditions.push({ mobile_No });

        const user = await User.findOne({
            $or: orConditions
        }).select("+password");

        if (!user) {
            return res.status(404).json({ message: 'User not found!' });
        }
        if (!user.verification.isVerify) {
            return res.status(400).json({ message: 'User is not verified!' });
        }
        if (!user.verification.isEmailVerified && !user.verification.isMobileVerified) {
            return res.status(400).json({ message: 'Email is not verified!' });
        }
        if (user.verification.isDelete) {
            return res.status(400).json({ message: 'User is deleted!' });
        }



        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password!' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_User_SECRET_KEY as string, { expiresIn: '7d' });



        res.status(200).json({ message: 'Login successful!', user, token });
    }

    catch (err) { return errorHandler(err, res); }
}

export const user_signin_with_google = async (req: Request, res: Response) => {
    try {
        const googleUser = req.user as Profile;

        const email = googleUser?.emails?.[0]?.value;
        const name = googleUser?.displayName || "Google User";
        const username = email?.split("@")[0] + crypto.randomBytes(3).toString("hex");

        // ❌ EMAIL NOT FOUND
        if (!email) {
            return res.status(400).json({
                message: "Email not found from Google",
            });
        }
        let user = await User.findOne({ email });


        if (!user) {
            const nameParts = name.split(" ");
            const first_name = nameParts[0] || "Google";
            const last_name = nameParts.slice(1).join(" ") || "User";

            const randomPassword = await bcrypt.hash(
                crypto.randomBytes(20).toString("hex"),
                10
            );

            user = await User.create({
                username, first_name, last_name, email, avatar: "https://via.placeholder.com/150", country_code: "+91", password: randomPassword,
                verification: {
                    isVerify: true,
                    isEmailVerified: true,
                    isMobileVerified: false,
                    isDelete: false,
                    wrongAttempts: 0,
                    lockUntil: null,
                },
            });


        }
        return res.redirect(
            `http://localhost:5173/login`
        );
    } catch (err) {
        return errorHandler(err, res);
    }
};


export const user_login_with_goolge = async (req: Request, res: Response) => {
    try {
        const googleUser = req.user as any;
        const email: string | undefined = googleUser?.emails?.[0]?.value;

        if (!email) {
            return res.status(400).json({
                message: "Email not found from Google",
            });
        }

        // ✅ CHECK USER IN DB
        const dbUser = await User.findOne({ email });

        // ❌ NOT EXISTS → signup page
        if (!dbUser) {
            return res.redirect("http://localhost:5173/?next=signup&email=" + email);
        }

        // ❌ NOT VERIFIED → OTP PAGE
        if (!dbUser.verification?.isVerify) {
            return res.redirect(
                `http://localhost:5173/otp?userId=${dbUser._id}`
            );
        }

        // ✅ VERIFIED → DASHBOARD
        return res.redirect(
            `http://localhost:5173/home`
        );

    } catch (err) {
        return errorHandler(err, res);
    }
};

export const user_signin_with_github = async (req: Request, res: Response) => {
  try {
    const githubUser: any = req.user;

    // 🔥 GitHub email kabhi _json me milta hai
    const email =
      githubUser?.emails?.[0]?.value || githubUser?._json?.email;

    const name =
      githubUser?.displayName ||
      githubUser?.username ||
      "Github User";

    if (!email) {
      return res.redirect("http://localhost:5173/login?error=no_email");
    }

    // ⭐ Check existing user
    let user = await User.findOne({ email });

    // 🟡 Agar already exist → signup allow nahi
    if (user) {
      return res.redirect("http://localhost:5173/login?error=already_registered");
    }

    // ⭐ Username generate
    const username =
      email.split("@")[0] + crypto.randomBytes(3).toString("hex");

    const nameParts = name.split(" ");
    const first_name = nameParts[0] || "Github";
    const last_name = nameParts.slice(1).join(" ") || "User";

    const randomPassword = await bcrypt.hash(
      crypto.randomBytes(20).toString("hex"),
      10
    );

    // ✅ CREATE NEW USER
    user = await User.create({
      username,
      first_name,
      last_name,
      email,
      avatar: "https://via.placeholder.com/150",
      country_code: "+91",
      password: randomPassword,
      verification: {
        isVerify: true,
        isEmailVerified: true,
        isMobileVerified: false,
        isDelete: false,
        wrongAttempts: 0,
        lockUntil: null,
      },
    });

    /* =====================================================
        ✅ SIGNUP SUCCESS
    ===================================================== */

    return res.redirect("http://localhost:5173/login");

  } catch (err) {
    return errorHandler(err, res);
  }
};

export const user_login_with_github = async (req: Request, res: Response) => {
  try {
    const githubUser: any = req.user;

    const email =
      githubUser?.emails?.[0]?.value || githubUser?._json?.email;

    if (!email) {
      return res.status(400).json({
        message: "Email not found from GitHub",
      });
    }

    // 🔥 ONLY LOGIN — NO CREATE
    const user = await User.findOne({ email });

    if (!user) {
      return res.redirect("http://localhost:5173/login?error=not_registered");
    }

    return res.redirect("http://localhost:5173/dashboard");

  } catch (err) {
    return errorHandler(err, res);
  }
};


export const user_forget_password = async (req: Request, res: Response) => {
    try {

    }

    catch (err) { return errorHandler(err, res); }
}
// send mail link reset pasword click link open website page change password , link expiry date if
// link expire not open website page change password show error link expire