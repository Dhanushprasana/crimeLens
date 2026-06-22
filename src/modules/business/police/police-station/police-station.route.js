"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./police-station.controller");

// Station types (must come BEFORE /:id to avoid conflict)
router.post("/types", controller.addStationType);
router.get("/types", controller.getAllStationType);
router.delete("/types/:id", controller.deleteStationType);

// Police stations CRUD
router.post("/", controller.addPoliceStation);
router.get("/", controller.getAllPoliceStation);       // GET /api/police/stations
router.get("/:id", controller.getOnePoliceStation);   // GET /api/police/stations/:id
router.put("/:id", controller.updatePoliceStation);
router.delete("/:id", controller.deletePoliceStation);

// Bootstrap seed-data -> DB
router.post("/geojson/bootstrap", controller.bootstrapPoliceStations);

module.exports = router;
