"use strict";

const jwt = require("jsonwebtoken");
const sendResponse = require("../common/response");

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "default_secret"; // Fallback only for dev

    jwt.verify(token, secret, (err, user) => {
      if (err) {
        return sendResponse(res, { message: "Forbidden - Invalid token" }, 403);
      }

      req.user = user;
      next();
    });
  } else {
    sendResponse(res, { message: "Unauthorized - No token provided" }, 401);
  }
};

module.exports = authenticateJWT;
