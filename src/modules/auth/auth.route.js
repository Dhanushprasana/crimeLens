const express = require("express");

const router = express.Router();

const authController = require("./auth.controller");
const authenticateJWT = require("../../middleware/auth.middleware");

router.post("/login", authController.login);
router.post("/refresh", authController.refreshTokens);

router.get("/me", authenticateJWT, authController.getMe);
router.post("/logout", authenticateJWT, authController.logOut);

module.exports = router;
