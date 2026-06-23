"use strict";

const express = require("express");
const router = express.Router();

const configurationRoute = require("../modules/scaffolding/configuration/configuration.route");
const permissionRoute = require("../modules/scaffolding/permission/permission.route");
const roleRoute = require("../modules/scaffolding/role/role.route");
const userRoute = require("../modules/scaffolding/user/user.route");
const userInvitesRoute = require("../modules/scaffolding/user-invites/user-invites.route");
const policeOfficerRoute = require("../modules/business/police/police-officer/police-officer.route");
const policeStationRoute = require("../modules/business/police/police-station/police-station.route");
const geoDistrictRoute = require("../modules/business/geo-data/district.route");
const criminalRoute = require("../modules/business/criminal/criminal.route");
const crimeRoute = require("../modules/business/crime/crime.route");
const firRoute = require("../modules/business/fir/fir.route");
const authRoute = require("../modules/auth/auth.route");
const seedDataRoute = require("../modules/seed-data/seed-data.route");
const criminalProfilingRoute = require("../modules/business/criminal-profiling/criminal-profiling.route");

router.use("/configurations", configurationRoute);
router.use("/permissions", permissionRoute);
router.use("/roles", roleRoute);
router.use("/users", userRoute);
router.use("/users/invites", userInvitesRoute);
router.use("/police/officers", policeOfficerRoute);
router.use("/police/stations", policeStationRoute);
router.use("/geo/districts", geoDistrictRoute);
router.use("/criminals", criminalRoute);
router.use("/crimes", crimeRoute);
router.use("/firs", firRoute);
router.use("/auth", authRoute);
router.use("/seed", seedDataRoute);
router.use("/criminal-profiling", criminalProfilingRoute);

module.exports = router;
