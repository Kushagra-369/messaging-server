import express from "express";
import multer from "multer";
import { authenticateUser } from "../middleware/user_auth";
import passport from "../config/passport";

const router = express.Router();

import { create_user, user_otp_verification, user_login, user_login_with_goolge, user_signin_with_google, user_login_with_github, user_signin_with_github } from "../controller/user_controller";

const upload = multer();

router.post("/create_user", upload.none(), create_user);
router.post("/verify_otp/:userId", user_otp_verification);
router.post("/user_login", upload.none(), user_login, authenticateUser);

router.get("/auth/google",
  passport.authenticate("google-login", { scope: ["profile", "email"] })
);

router.get("/auth/google/callback",
  passport.authenticate("google-login", { session: false }),
  user_login_with_goolge
);

// 🟢 SIGNIN
router.get("/auth/google/signin", passport.authenticate("google-signin", { scope: ["profile", "email"] }));

router.get("/auth/google/signin/callback", passport.authenticate("google-signin", { session: false }), user_signin_with_google);

// GitHub Login
// 🔵 LOGIN
router.get(
  "/auth/github",
  passport.authenticate("github", {
    scope: ["user:email"],
    state: "login",
  })
);

// 🟢 SIGNIN
router.get(
  "/auth/github/signin",
  passport.authenticate("github", {
    scope: ["user:email"],
    state: "signin",
  })
);

// ⭐ SINGLE CALLBACK
router.get(
  "/auth/github/callback",
  passport.authenticate("github", { session: false }),
  (req, res) => {
    if (req.query.state === "signin") {
      return user_signin_with_github(req, res);
    }
    return user_login_with_github(req, res);
  }
);



export default router;
