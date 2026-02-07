import express from "express";
import multer from "multer";
import { authenticateUser } from "../middleware/user_auth";

const router = express.Router();

import { create_user,  user_otp_verification , user_login} from "../controller/user_controller";

const upload = multer();

router.post("/create_user", upload.none(), create_user);
router.post("/verify_otp/:userId", user_otp_verification);
router.post("/login", upload.none(), user_login, authenticateUser);
export default router;
