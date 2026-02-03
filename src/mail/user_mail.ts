const nodemailer = require("nodemailer");
const dotenv = require("dotenv")
dotenv.config()

export const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 465,
  secure: false, 
  service: "gmail",
  auth: { 
    user: process.env.NodeMailerUser, 
    pass: process.env.NodeMailerPassword,
  },
});

export const otpVerificationUserMessage = (
  name: string,
  otp: string
): string => {
  return `Hi ${name},

Your messaging verification code is: ${otp}

⏳ Valid for 10 minutes.
❗ Do not share this code with anyone.

– Messaging App ✈️`;
};

