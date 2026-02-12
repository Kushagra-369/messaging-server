import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import dotenv from "dotenv";
dotenv.config();

/* 🔵 LOGIN STRATEGY */
passport.use(
  "google-login",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "http://localhost:1928/auth/google/callback",
    },
    async (_a, _r, profile: Profile, done) => {
      done(null, profile);
    }
  )
);

/* 🟢 SIGNIN STRATEGY */
passport.use(
  "google-signin",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "http://localhost:1928/auth/google/signin/callback", // ⭐ MUST MATCH GOOGLE CONSOLE
    },
    async (_a, _r, profile: Profile, done) => {
      done(null, profile);
    }
  )
);

export default passport;
