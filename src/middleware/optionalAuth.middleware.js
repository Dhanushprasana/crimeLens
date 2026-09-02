"use strict";

const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

// Optional auth middleware: if Authorization header present, verify and set req.user.
// If no header present, continue without error.
// If token is invalid, do not send response here; leave req.user undefined so
// downstream handlers can decide how to respond (e.g., require auth for certain tools).
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  if (!authHeader.startsWith("Bearer ")) {
    logger.warn("OptionalAuth: malformed Authorization header");
    return next();
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "default_secret";

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      logger.warn("OptionalAuth: token verification failed", { error: err.message });
      return next();
    }

    req.user = user;
    return next();
  });
};
