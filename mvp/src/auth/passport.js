const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { v4: uuidv4 } = require("uuid");
const { config } = require("../config");
const { pool } = require("../db");

const isGoogleConfigured = Boolean(
  config.googleClientId && config.googleClientSecret && config.googleCallbackUrl
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const res = await pool.query(
      "SELECT id, tenant_id, email FROM users WHERE id = $1",
      [id]
    );

    if (res.rows.length === 0) {
      return done(null, false);
    }

    const user = res.rows[0];
    return done(null, {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email
    });
  } catch (err) {
    return done(err);
  }
});

// passport.use registers the strategy defined here and stored it internally within its strategy registry under the name "google". 
// Then when we call passport.authenticate("google"), it looks up this strategy and executes the verify callback defined 
// here after the user successfully authenticates with Google and is redirected back to our app. 
// So this is where we define how to handle the user information returned by Google and how to find or create a corresponding user in our database,
//  and then call done() to pass that user object back to Passport for session handling or token generation.
if (isGoogleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl
      }, 
      // the 'done' is a nested callback function wihtin the verify callback of the GoogleStrategy. 
      // It is defined as fucntion done(error, user), so the rationale is much like myForEach function's cb(item), 
      // its just that it is defined inline as a parameter to the GoogleStrategy constructor, 
      // and it is called by the Passport library after the authentication process is complete.
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          const googleSub = profile.id;

          if (!email) {
            return done(new Error("Google profile missing email"));
          }

          const existing = await pool.query(
            "SELECT id, tenant_id, email, google_sub FROM users WHERE google_sub = $1 OR email = $2 LIMIT 1",
            [googleSub, email]
          );

          if (existing.rows.length > 0) {
            const user = existing.rows[0];

            if (!user.google_sub) {
              await pool.query("UPDATE users SET google_sub = $1 WHERE id = $2", 
                [googleSub, user.id]);
            }

            return done(null, {
              id: user.id,
              tenantId: user.tenant_id,
              email: user.email
            });
          }

          const tenantId = uuidv4();
          await pool.query(
            "INSERT INTO tenants (id, name) VALUES ($1, $2)",
            [tenantId, `${email} Tenant`]
          );

          const userId = uuidv4();
          await pool.query(
            "INSERT INTO users (id, tenant_id, email, password_hash, google_sub) VALUES ($1, $2, $3, $4, $5)",
            [userId, tenantId, email, null, googleSub]
          );

          return done(null, {
            id: userId,
            tenantId,
            email
          });
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = { isGoogleConfigured };

