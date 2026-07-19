"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./seed-data.controller");

// Bootstrap seed-data -> DB
router.post("/geojson/bootstrap", controller.bootstrapDistrictGeoJson); //
router.post("/police-rank/bootstrap", controller.bootstrapPoliceRank); //

router.post("/police-station/bootstrap", controller.bootstrapPoliceStations); //
router.post("/crime-category/bootstrap", controller.bootstrapCrimeCategory); // 

router.post("/police-officer/bootstrap", controller.bootstrapPoliceOfficer); //
router.post("/criminal/bootstrap", controller.bootstrapCriminal); //

// router.post("/suspect/bootstrap",controller.bootstrapSuspect);

router.post("/fir/bootstrap", controller.bootstrapFirs);  //
router.post("/crime-incident/bootstrap", controller.bootstrapCrimeIncidents);  // 

router.post("/incident-criminal/bootstrap", controller.bootstrapIncidentCriminals);
// router.post("/incident-officer/bootstrap", controller.bootstrapIncidentOfficers);
router.post("/crime-evidence/bootstrap", controller.bootstrapCrimeEvidence);

router.post("/district-crime-stats/calculate", controller.calculateDistrictCrimeStats);
router.post("/crime-incident/generate", controller.generateCrime);
router.get("/record-counts", controller.getAllTableCounts);

module.exports = router;
