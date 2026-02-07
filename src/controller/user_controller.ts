import { Request, Response } from "express";
import User from "../model/user_model";
import { errorHandler } from '../middleware/error_handling';
import { NewUserOtp } from '../mobile/otp';
import crypto from 'crypto';
import { otpVerificationUserMessage, transporter } from "../mail/user_mail";
import { upload_project_img, deleteImg } from "../image/upload";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const create_user = async (req: Request, res: Response) => {
    try {
        const data = req.body;

        const { username, first_name, last_name, email, country_code, password, mobile_No, gender, } = data;
        const file = req.file

        const otp = crypto.randomInt(1000, 10000);

        const userExists = await User.findOneAndUpdate({
            $or: [
                { email: email },
                { username: username },
                { mobile_No: mobile_No }]

        });


        if (userExists) {
            const { isDelete, isVerify } = userExists?.verification
            if (isDelete) return res.status(400).json({ message: 'User is deleted!' });
            if (isVerify) return res.status(400).json({ message: 'User is already verified!' });


            // if (userExists.mobile_No) { 
            //   const check = await NewUserOtp(userExists.first_name, userExists.last_name,userExists.mobile_No, otp)
            //   console.log(check)
            // } 
            if (userExists.mobile_No) {
                return res.status(201).json({ message: "resend otp to mobile", });
            }

            otpVerificationUserMessage(userExists.first_name, userExists.email, otp)
            return res.status(201).json({
                message: mobile_No ? "User created & OTP sent to email + mobile" :
                    "User created & OTP sent to email",
            });

        }

        let profileImg: any = null;

        if (file) {
            profileImg = await upload_project_img(file.path);
        }
        console.log(profileImg)

        if (mobile_No) {
            // await NewUserOtp(first_name, last_name, mobile_No, otp);
        }

        const bcryptPassword = await bcrypt.hash(password, 10);

        const otpExpires = Date.now() + 5 * 60 * 1000;
        const verification = { emailotp: otp, mobileotp: otp, otpExpires: otpExpires }
        const user = await User.create({
            username, first_name, last_name, email, country_code, password: bcryptPassword,
            mobile_No, gender, profileImg, verification
        });

        // if(mobile_No){
        //   const check = await NewUserOtp(userExists.first_name, userExists.last_name,mobile_No, otp)
        //   console.log(check)
        // }

        res.status(201).json({
            status: true, message: mobile_No ?
                "User created & OTP sent to email + mobile" : "User created & OTP sent to email", user
        });
    }
    catch (err: unknown) { return errorHandler(err, res); }
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

export const user_login_with_goolge = async (req: Request, res: Response) => {
    try {

    }

    catch (err) { return errorHandler(err, res); }
}

export const user_login_with_github = async (req: Request, res: Response) => {
    try {

    }

    catch (err) { return errorHandler(err, res); }
}

export const user_forget_password = async (req: Request, res: Response) => {
    try {

    }

    catch (err) { return errorHandler(err, res); }
}
// send mail link reset pasword click link open website page change password , link expiry date if
// link expire not open website page change password show error link expire