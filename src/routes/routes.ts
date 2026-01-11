import express from "express";
import multer from "multer";

import {create_users} from "../controller/user_controller";

const router = express.Router();

const upload = multer();

//     USER ROUTES
router.post("/create_users", upload.none(), create_users);

export default router;
