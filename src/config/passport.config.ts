import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import { comparePassword, hashPassword } from "../lib/password";
import { User } from "../models/user.model";
import { appConfig } from "./app.config";

const localStrategy = new LocalStrategy(
  { usernameField: "email", passwordField: "password" },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return done(null, false, { message: "User not found" });
      }

      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        return done(null, false, { message: "Invalid password" });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
);

const googleStrategy = new GoogleStrategy(
  {
    clientID: appConfig.GOOGLE_CLIENT_ID,
    clientSecret: appConfig.GOOGLE_CLIENT_SECRET,
    callbackURL: appConfig.GOOGLE_CALLBACK_URL,
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        const randomPassword = Math.random().toString(36);
        const hashedPassword = await hashPassword(randomPassword);

        user = await User.create({
          googleId: profile.id,
          fullName: profile.displayName,
          email: profile.emails?.[0]?.value,
          password: hashedPassword,
          isVerified: true,
        });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
);

export const setupPassport = (): void => {
  passport.use("local", localStrategy);
  passport.use(googleStrategy);

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
