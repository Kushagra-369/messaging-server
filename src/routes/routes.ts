import express from "express";
import multer from "multer";

import {create_users , verify_otp, resend_otp, user_login ,auth_me , user_profile_update ,get_user_by_id} from "../controller/user_controller";

const router = express.Router();

const upload = multer();

//     USER ROUTES
router.post("/create_users", upload.none(), create_users);
router.post("/verify_otp", upload.none(), verify_otp);
router.post("/resend-otp", upload.none(), resend_otp);
router.post("/user_login", upload.none(), user_login);
router.get("/auth_me", auth_me);
router.post(
  "/user_profile_update/:id",
  upload.single("profile_picture"),
  user_profile_update
);
router.get("/get_user_by_id/:id", get_user_by_id);

export default router;
