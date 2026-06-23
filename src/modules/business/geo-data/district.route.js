"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./district.controller");

router.post("/", controller.addDistrict);
router.get("/getAll", controller.getAllDistrict);
router.get("/getOneDistrict/:id", controller.getOneDistrict);
router.delete("/:id", controller.deleteDistrict);

// GeoJSON endpoints
router.post("/geojson", controller.addDistrictGeoJson);
router.get("/geojson/getAll", controller.getAllDistrictGeoJson);
router.get("/geojson/getOneDistrict/:id", controller.getOneDistrictGeoJson);
router.delete("/geojson/:id", controller.deleteDistrictGeoJson);

module.exports = router;
