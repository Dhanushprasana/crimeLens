"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./dashboard.controller");

router.get("/district-crime-stats", controller.getDistrictCrimeStats);
router.get("/total-crime-count", controller.getTotalCrimeCount);

module.exports = router;
