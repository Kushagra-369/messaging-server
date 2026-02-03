import express from "express";
import multer from "multer";

const router = express.Router();

import { create_user, get_user } from "../controller/user_controller";

const upload = multer();

router.post("/create_user", upload.none(), create_user);
router.get("/users/:id", get_user);

export default router;
