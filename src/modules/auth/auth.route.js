const express = require("express");

const router = express.Router();

const authController = require("./auth.controller");

router.get("/me", authController.getMe);

router.post("/logout", authController.logOut);

module.exports = router;
