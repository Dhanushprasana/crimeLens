"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./police-station.controller");

router.post("/", controller.addPoliceStation);
router.get("/getAll", controller.getAllPoliceStation);
router.get("/:id", controller.getOnePoliceStation);
router.put("/:id", controller.updatePoliceStation);
router.delete("/:id", controller.deletePoliceStation);

// Station types
router.post("/types", controller.addStationType);
router.get("/types", controller.getAllStationType);
router.delete("/types/:id", controller.deleteStationType);

// Bootstrap seed-data -> DB (reads geo-data/seed-data)
router.post("/geojson/bootstrap", controller.bootstrapPoliceStations);

module.exports = router;
