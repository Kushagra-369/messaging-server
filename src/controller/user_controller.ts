import { Request, Response } from "express";
import User from "../model/user_model";
import { errorHandler } from '../middleware/error_handling';
import { NewUserOtp } from '../mobile/otp';
import crypto from 'crypto';
import { otpVerificationUserMessage, transporter } from "../mail/user_mail";
import { upload_project_img, deleteImg } from "../image/upload";

export const create_user = async (req: Request, res: Response) => {
    try {
        const data = req.body;

        const { username, first_name, last_name, email, country_code, password, mobile_No, gender, } = data;
        const file = req.file

        const otp = crypto.randomInt(1000, 10000);

        const userExists = await User.findOne({ email });

        if (userExists) {
            const { isDelete, isVerify } = userExists?.verification
            if (isDelete) return res.status(400).json({ message: 'User is deleted!' });
            if (isVerify) return res.status(400).json({ message: 'User is already verified!' });


            if (userExists.mobile_No) {
                const check = await NewUserOtp(userExists.first_name, userExists.last_name, mobile_No, otp)
                console.log(check)
            }


            // Send Mail Otp
            if (email) {
                await transporter.sendMail({
                    from: `"Messaging App ✈️" <${process.env.NodeMailerUser}>`,
                    to: email,
                    subject: "Messaging App Verification Code",
                    text: otpVerificationUserMessage(
                        userExists.first_name,
                        otp.toString()
                    ),
                });
            }

            if (mobile_No) {
                await NewUserOtp(first_name, last_name, mobile_No, otp);
            }

            res.status(201).json({
                message: mobile_No
                    ? "User created & OTP sent to email + mobile"
                    : "User created & OTP sent to email",
            });

        }

        let imageData: any = null;

        if (file) {
            imageData = await upload_project_img(file.path);
        }


        const user = await User.create({
            username, first_name, last_name, email, country_code, password, mobile_No, gender, ...(imageData && {profileImg: {public_id: imageData.public_id,secure_url: imageData.secure_url,},}),
            verification: {
                ...(email && { emailotp: otp.toString() }),
                ...(mobile_No && { mobileotp: otp.toString() }),
                isVerify: false,
                isDelete: false,
            }

        });
        
        // if(mobile_No){
        //   const check = await NewUserOtp(userExists.first_name, userExists.last_name, mobile_No, otp)
        //   console.log(check)
        // }

        res.status(201).json(user);
    }
    catch (err: unknown) { return errorHandler(err, res); }
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