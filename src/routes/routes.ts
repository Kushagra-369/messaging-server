import express from "express";
import multer from "multer";

import {create_users , verify_otp, resend_otp, user_login ,auth_me} from "../controller/user_controller";

const router = express.Router();

const upload = multer();

//     USER ROUTES
router.post("/create_users", upload.none(), create_users);
router.post("/verify_otp", upload.none(), verify_otp);
router.post("/resend-otp", upload.none(), resend_otp);
router.post("/user_login", upload.none(), user_login);
router.get("/auth_me", auth_me);

export default router;
