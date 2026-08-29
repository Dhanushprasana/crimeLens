"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./controller");

// Network Analysis Graph Endpoint
router.post("/", controller.buildGraph);
router.get("/global", controller.getGlobalGraph);
router.get("/global/options", controller.getGlobalOptions);
router.get("/entity-options", controller.getEntityOptions);

module.exports = router;
