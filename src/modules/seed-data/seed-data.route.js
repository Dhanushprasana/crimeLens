"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./seed-data.controller");

// Bootstrap seed-data -> DB
router.post("/geojson/bootstrap", controller.bootstrapDistrictGeoJson);
router.post("/police-rank/bootstrap", controller.bootstrapPoliceRank);
router.post("/police-station/bootstrap", controller.bootstrapPoliceStations);

module.exports = router;
