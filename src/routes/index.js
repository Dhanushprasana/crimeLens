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
const dashboardRoute = require("../modules/business/dashboard/dashboard.route");
const forecastRoute = require("../modules/forecast/forecast.route");
const suspectRoute = require("../modules/business/suspect/suspect.route");      
const crimeCategoryRoute = require("../modules/business/crime-category/crime-category.route");
const evidenceAnalysisRoute = require("../modules/business/evidence-analysis/evidence-analysis.route");
const evidenceMatchRoute    = require("../modules/business/evidence-match/evidence-match.route");
const suspectPhotoRoute     = require("../modules/business/suspect/suspect-photo/suspect-photo.route");
const incidentOfficerRoute  = require("../modules/business/crime/incident-officer/incident-officer.route");
const caseWitnessRoute      = require("../modules/business/crime/case-witness/case-witness.route");
const caseVictimRoute       = require("../modules/business/crime/case-victim/case-victim.route");
const aiRoute               = require("../modules/ai/ai.route");

const networkAnalysisRoute = require("../modules/network-analysis/route");

// Redirect after password set
router.get("/app", (req, res) => {
  res.redirect("https://crime-lens.onslate.in/__catalyst/auth/login");
});

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
router.use("/dashboard", dashboardRoute);
router.use("/forecast", forecastRoute);
router.use("/storage", require("../modules/storage/storage.routes"));
router.use("/suspects", suspectRoute);  
router.use("/crime-categories", crimeCategoryRoute);
router.use("/evidence-analysis", evidenceAnalysisRoute);
router.use("/evidence-matches", evidenceMatchRoute);
router.use("/network-analysis", networkAnalysisRoute);
router.use("/suspect-photos", suspectPhotoRoute);
router.use("/incident-officers", incidentOfficerRoute);
router.use("/case-witnesses", caseWitnessRoute);
router.use("/case-victims", caseVictimRoute);
router.use("/ai", aiRoute);

module.exports = router;
