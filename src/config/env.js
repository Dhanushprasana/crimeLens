"use strict";

require("dotenv").config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || 3000,

  // Zoho Catalyst
  CATALYST_PROJECT_ID: process.env.CATALYST_PROJECT_ID || "",
  CATALYST_PROJECT_KEY: process.env.CATALYST_PROJECT_KEY || "",

  // Table Names
  TABLE_CONFIGURATION: "sys_configuration",
  TABLE_PERMISSION: "sys_permission",
  TABLE_ROLE: "sys_role",
  TABLE_ROLE_PERMISSION: "sys_role_permission",
  TABLE_USER: "sys_user",
  TABLE_USER_INFO: "sys_user_info",
  TABLE_USER_ROLE: "sys_user_role",
  TABLE_USER_CONFIGURATION: "sys_user_configuration",
  TABLE_POLICE_OFFICER: "biz_police_officer",
  TABLE_POLICE_RANK: "biz_police_rank",
  TABLE_POLICE_STATION: "biz_police_station",
  TABLE_STATION_TYPE: "biz_station_type",
  TABLE_DISTRICT_GEODATA: "biz_district_geodata",
  // Default role assigned to newly created officers
  DEFAULT_OFFICER_ROLE: process.env.DEFAULT_OFFICER_ROLE || "OFFICER",
  // Crime / FIR / Criminal tables
  TABLE_CRIMINAL: "biz_criminal",
  TABLE_CRIME_INCIDENT: "biz_crime_incident",
  TABLE_FIR: "biz_FIR",
  TABLE_CRIME_EVIDENCE: "biz_crime_evidence",
  TABLE_INCIDENT_OFFICER: "biz_incident_officer",
  TABLE_INCIDENT_CRIMINAL: "biz_incident_criminals",
  TABLE_CRIME_CATEGORY: "biz_crime_category",

  // Profiling
  TABLE_CRIMINAL_PROFILE: "biz_criminal_profile",
  TABLE_CRIMINAL_ALIAS: "biz_criminal_alias",
  TABLE_CRIMINAL_RELATIONSHIP: "biz_criminal_relationship",

  // Intelligence
  TABLE_CRIMINAL_PHONE: "biz_criminal_phone",
  TABLE_CRIMINAL_VEHICLE: "biz_criminal_vehicle",
  TABLE_BEHAVIORAL_FLAG: "biz_behavioral_flag",
  TABLE_CRIMINAL_RISK_FACTOR: "biz_criminal_risk_factor",
  TABLE_COMP_DISTRICT_CRIME_STATS: "biz_comp_district_crime_stats",
};

module.exports = env;
