const jwt = require("jsonwebtoken");
const { config } = require("../config");

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function parseToken(req) {
  const token = req.cookies ? req.cookies.auth_token : null;
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    return null;
  }
}

function attachAuth(req, res, next) {
  const payload = parseToken(req);
  if (payload) {
    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email
    };
  }
  next();
}

function requireAuth(req, res, next) {
  const payload = parseToken(req);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = {
    id: payload.sub,
    tenantId: payload.tenantId,
    email: payload.email
  };

  return next();
}

module.exports = { signToken, attachAuth, requireAuth };
