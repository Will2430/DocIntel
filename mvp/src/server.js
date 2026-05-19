const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
const { config } = require("./config");
const { attachAuth } = require("./auth/jwt");
require("./auth/passport");
const { authRouter } = require("./routes/auth");
const { documentsRouter } = require("./routes/documents");
const { questionsRouter } = require("./routes/questions");

const app = express();

app.use(cors({
  origin: config.uiBaseUrl,
  credentials: true
}));
// Cookie parser is a open source middleware for parsing cookies in incoming HTTP requests. 
// It populates the req.cookies object with key-value pairs of cookie names and their corresponding values
// It extracts cookies from the http  request header and converts the cookie string into a more convenient format 
// that we can easily access in our route handlers and middleware functions.
app.use(cookieParser());

// Session middleware is used to manage user sessions on the server side. 
// It allows us to store user-specific data (like authentication status) across multiple requests.
// User data is stored on the server, and a session ID is sent to the client in a cookie. 
// When the client makes subsequent requests, it sends the session ID cookie back to the server, 
// which can then look up the corresponding session data and determine if the user is authenticated or not.
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: "lax",
    secure: config.cookieSecure
  }
}));

app.use(passport.initialize());

// Reads session cookie
// Gets stored user ID
// Runs deserializeUser
// Attaches user object to req.user
app.use(passport.session());

app.use(attachAuth);

// Parses incoming JSON request bodies. if we dont define this middleware, 
// then req.body will be undefined in our route handlers when we try to access the data sent by the client in the request body, 
// such as when creating a new document or asking a question.
app.use(express.json({ limit: "20mb" }));

//mount routers for different API endpoints
app.use("/auth", authRouter);
app.use("/documents", documentsRouter);
app.use("/questions", questionsRouter);

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`API listening on ${config.port}`);
});
