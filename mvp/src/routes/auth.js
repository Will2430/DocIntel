const express = require("express");
const passport = require("passport");
const { config } = require("../config");
const { signToken, requireAuth } = require("../auth/jwt");
const { isGoogleConfigured } = require("../auth/passport");

const router = express.Router();

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/"
  };
}

router.get("/google", (req, res, next) => {
  if (!isGoogleConfigured) {
    return res.status(500).json({ error: "Google OAuth is not configured" });
  }

  return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
    if (!isGoogleConfigured) {
      return res.status(500).json({ error: "Google OAuth is not configured" });
    }
// passport.authenticate returns a middleware function that is immediately invoked with (req, res, next) 
// when the route is hit, and internally it will relay control to the next middleware, which is 
// also defined within the same route handler, and that is where we generate the JWT token and set the cookie
    return passport.authenticate("google", {
      session: false,
      failureRedirect: `${config.uiBaseUrl}/login?error=oauth`
    })(req, res, next);
  },
  (req, res) => {
    const token = signToken(req.user);
    res.cookie("auth_token", token, cookieOptions());
    return res.redirect(`${config.uiBaseUrl}/dashboard`);
  }
);

router.get("/me", requireAuth, (req, res) => {
  return res.json({
    id: req.user.id,
    email: req.user.email,
    tenantId: req.user.tenantId
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("auth_token", cookieOptions());
  return res.json({ ok: true });
});

module.exports = { authRouter: router };
