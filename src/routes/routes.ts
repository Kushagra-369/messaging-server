import express from "express";
import multer from "multer";

const router = express.Router();

import { create_user,  user_otp_verification } from "../controller/user_controller";

const upload = multer();

router.post("/create_user", upload.none(), create_user);
router.post("/verify_otp/:userId", user_otp_verification);

export default router;
