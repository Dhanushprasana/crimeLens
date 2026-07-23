"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./dashboard.controller");

router.get("/district-crime-stats", controller.getDistrictCrimeStats);
router.get("/total-crime-count", controller.getTotalCrimeCount);
router.get("/crimes/count", controller.getFilteredCrimeCount);
router.get("/crimes/count-with-previous-year", controller.getCrimeCountWithPreviousYear);
router.get("/crimes/growth", controller.getCrimeGrowth);

module.exports = router;
