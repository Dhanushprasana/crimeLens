"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./user-invites.controller");

router.post("/invite", controller.inviteUser);
router.get("/invites", controller.getAllInvites);
router.post("/invite/check", controller.checkInvite);
router.post("/invite/accept", controller.acceptInvite);
router.post("/invite/onboard", controller.createUserFromInvite);
router.post("/reinvite", controller.resendInvite);

module.exports = router;
