import express from "express";
import multer from "multer";

import {create_users , verify_otp, resend_otp, user_login ,auth_me , user_profile_update ,get_user_by_id,find_user_by_username} from "../controller/user_controller";
import {sendMessage ,getMessages,markMessagesRead ,getConversations} from "../controller/chat_controller";
import {authMiddleware} from "../middleware/auth"
const router = express.Router();

const upload = multer();

//     USER ROUTES
router.post("/create_users", upload.none(), create_users);
router.post("/verify_otp", upload.none(), verify_otp);
router.post("/resend-otp", upload.none(), resend_otp);
router.post("/user_login", upload.none(), user_login);
router.get("/auth_me", auth_me);
router.post("/user_profile_update/:id",upload.single("profile_picture"),user_profile_update);
router.get("/get_user_by_id/:id", get_user_by_id);
router.get("/find_user_by_username/:username", find_user_by_username);

//     CHAT ROUTES
router.post("/send_message", authMiddleware,upload.none(),sendMessage);
router.get("/get_messages/:userId",authMiddleware,getMessages);
router.post("/mark_messages_read",authMiddleware,upload.none(),markMessagesRead);
router.get("/conversations",authMiddleware,getConversations);

export default router;
