import { Request, Response } from "express";
import User from "../model/user_model";
import { errorHandler } from '../middleware/error_handling';
import { NewUserOtp } from '../mobile/otp';
import crypto from 'crypto';
import { otpVerificationUserMessage, transporter } from "../mail/user_mail";
import { upload_project_img, deleteImg } from "../image/upload";
import bcrypt from "bcrypt";

export const create_user = async (req: Request, res: Response) => {
    try {

        const { username, first_name, last_name, email, country_code, password, mobile_No, gender } = req.body;
        const file = req.file;

        const otp = crypto.randomInt(1000, 10000);
        const otpExpires = Date.now() + 5 * 60 * 1000;

        const userByUsername = await User.findOne({ username });
        if (userByUsername && (userByUsername.email !== email || userByUsername.mobile_No !== mobile_No)) {
            return res.status(400).json({ message: "Username already taken" });
        }

        const userExists = await User.findOne({
            $or: [{ email }, { mobile_No }]
        }).select("+password");


        console.log(userExists);

        if (userExists) {

            if (userExists.username !== username) {
                return res.status(400).json({ message: "Wrong Username" });
            }

            const { isDelete, isVerify } = userExists.verification;
            console.log(username, userExists.username);

            if (isDelete) return res.status(400).json({ message: 'User is deleted!' });
            if (isVerify) return res.status(400).json({ message: 'User is already verified!' });
            let isPasswordCorrect = false;

            if (userExists.password.startsWith("$2")) {
                isPasswordCorrect = await bcrypt.compare(password, userExists.password);
            } else {
                isPasswordCorrect = password === userExists.password;

                if (isPasswordCorrect) {
                    userExists.password = await bcrypt.hash(password, 10);
                    await userExists.save();
                }
            }

            if (!isPasswordCorrect) {
                return res.status(401).json({ message: "Wrong password" });
            }


            userExists.first_name = first_name;
            userExists.last_name = last_name;
            userExists.country_code = country_code;
            userExists.gender = gender;
            userExists.verification.emailotp = otp;
            userExists.verification.mobileotp = otp;

            if (file) {
                const profileImg = await upload_project_img(file.path);
                userExists.profileImg = profileImg;
            }

            await userExists.save();

            // if (userExists.mobile_No) { 
            //   const check = await NewUserOtp(userExists.first_name, userExists.last_name,userExists.mobile_No, otp)
            //   console.log(check)
            // } 

            otpVerificationUserMessage(userExists.first_name, userExists.email, otp);

            return res.status(200).json({
                message: mobile_No
                    ? "User updated & OTP sent to email + mobile"
                    : "User updated & OTP sent to email",
            });
        }

        let profileImg: any = null;

        if (file) {
            profileImg = await upload_project_img(file.path);
        }
        console.log(profileImg);

        if (mobile_No) {
            // await NewUserOtp(first_name, last_name, mobile_No, otp);
        }

        const verification = { emailotp: otp, mobileotp: otp, otpExpires };
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            first_name,
            last_name,
            email,
            country_code,
            password: hashedPassword,
            mobile_No,
            gender,
            profileImg,
            verification
        });

        // if(mobile_No){
        //   const check = await NewUserOtp(userExists.first_name, userExists.last_name,mobile_No, otp)
        //   console.log(check)
        // }

        res.status(201).json({
            status: true,
            message: mobile_No
                ? "User created & OTP sent to email + mobile"
                : "User created & OTP sent to email",
            user
        });

    } catch (err: unknown) {
        return errorHandler(err, res);
    }
};


export const get_user = async (req: Request, res: Response) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve user" });
    }
};