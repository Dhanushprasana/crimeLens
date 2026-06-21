"use strict";

const repository = require("../business/geo-data/district.repository");
const logger = require("../../config/logger");
const fs = require("fs").promises;
const path = require("path");
const policeRepo = require("../business/police/police-officer/police-officer.repository");
const stationRepo = require("../business/police/police-station/police-station.repository");
const crimeRepo = require("../business/crime/crime.repository");
const criminalRepo = require("../business/criminal/criminal.repository");
const firRepo = require("../business/fir/fir.repository");
const userRepo = require("../scaffolding/user/user.repository");
const catalystAuth = require("../../catalyst/auth/auth");
const env = require("../../config/env");

module.exports = {
  async bootstrapDistrictGeoJson(req) {
    logger.info("bootstrapDistrictGeoJson");
    return repository.bootstrapDistrictGeoJson(req);
  },

  async bootstrapPoliceRank(req) {
    logger.info("bootstrapPoliceRank");
    const filePath = path.join(
      __dirname,
      "data",
      "police-officer",
      "police_rank.json",
    );
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");

    // Fetch existing ranks to avoid duplicates
    let existing = [];
    try {
      existing = await policeRepo.getAllRanks(null, req);
    } catch (err) {
      logger.warn("Could not fetch existing ranks:", err.message || err);
      existing = [];
    }
    const existingNames = new Set(
      (existing || []).map((r) => (r.rank_name || "").trim().toLowerCase()),
    );

    let created = 0;
    let skipped = 0;
    for (const e of entries) {
      const name = (e.rank_name || "").trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) {
        skipped++;
        continue;
      }
      await policeRepo.createRank(
        { rank_name: name, hierarchy_level: e.hierarchy_level },
        req,
      );
      created++;
    }

    return { created, skipped };
  },

  async bootstrapPoliceStations(req) {
    logger.info("bootstrapPoliceStations");
    const filePath = path.join(
      __dirname,
      "data",
      "police-station",
      "police_stations.geojson",
    );
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    const features =
      parsed.type === "FeatureCollection" && Array.isArray(parsed.features)
        ? parsed.features
        : Array.isArray(parsed)
          ? parsed
          : [];

    let created = 0;
    let skipped = 0;
    const zcql = req.catalyst ? req.catalyst.zcql() : null;

    for (const feat of features) {
      const props = feat.properties || {};
      const geom = feat.geometry || null;

      const name =
        props.POL_STAName || props.station_name || props.name || null;
      if (!name) {
        skipped++;
        continue;
      }

      let latitude = null,
        longitude = null;
      if (geom && geom.type === "Point" && Array.isArray(geom.coordinates)) {
        longitude = geom.coordinates[0] || null;
        latitude = geom.coordinates[1] || null;
      }

      const station_code =
        props.KGISPSCode || props.station_code || props.code || null;
      const address = props.address || props.ADDRESS || null;

      // resolve district id from biz_district_detail by districtName property
      let district_id = null;
      const districtName =
        props.districtName ||
        props.DISTRICT ||
        props.DISTRICT_NAME ||
        props.district_name ||
        null;
      if (districtName && zcql) {
        try {
          const safeName = districtName.replace(/'/g, "''");
          const rows = await zcql.executeZCQLQuery(
            `SELECT ROWID FROM ${env.TABLE_DISTRICT_GEODATA} WHERE district_name = '${safeName}' LIMIT 1`,
          );
          if (rows && rows.length) {
            district_id =
              rows[0].ROWID ||
              rows[0][env.TABLE_DISTRICT_GEODATA]?.ROWID ||
              null;
            logger.info("district lookup by name", {
              districtName,
              district_id,
            });
          }
        } catch (err) {
          logger.warn(
            "district lookup failed",
            err && err.message ? err.message : err,
          );
        }
      }

      try {
        await stationRepo.addPoliceStation(
          {
            district_id,
            station_name: name,
            station_code,
            latitude,
            longitude,
            address,
            station_type_id: null,
          },
          req,
        );
        created++;
      } catch (err) {
        logger.warn("failed to insert station", {
          station: name,
          error:
            err && err.stack
              ? err.stack
              : err && err.message
                ? err.message
                : err,
        });
        skipped++;
      }
    }

    return { created, skipped, total: features.length };
  },

  async bootstrapCrimeCategory(req) {
    logger.info("bootstrapCrimeCategory");
    const filePath = path.join(
      __dirname,
      "data",
      "crimie",
      "crime_category.json",
    );
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");
    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    const table = req.catalyst
      ? req.catalyst.datastore().table(env.TABLE_CRIME_CATEGORY)
      : null;

    let created = 0;
    let skipped = 0;
    for (const e of entries) {
      const name = (e.crime_category_name || "").trim();
      if (!name) continue;
      let exists = false;
      try {
        const rows = await zcql.executeZCQLQuery(
          `SELECT ROWID FROM ${env.TABLE_CRIME_CATEGORY} WHERE crime_category_name = '${name.replace(/'/g, "''")}' LIMIT 1`,
        );
        if (rows && rows.length) exists = true;
      } catch (err) {
        logger.warn(
          "crime category lookup failed",
          err && err.message ? err.message : err,
        );
      }
      if (exists) {
        skipped++;
        continue;
      }
      try {
        await table.insertRow({
          crime_category_name: name,
          description: e.description || null,
        });
        created++;
      } catch (err) {
        logger.warn(
          "failed to insert crime category",
          name,
          err && err.message ? err.message : err,
        );
      }
    }
    return { created, skipped };
  },

  async bootstrapPoliceOfficer(req) {
    logger.info("bootstrapPoliceOfficer");
    const filePath = path.join(
      __dirname,
      "data",
      "police-officer",
      "police_officer.json",
    );
    const infoFilePath = path.join(
      __dirname,
      "data",
      "police-officer",
      "police_officer_info.json",
    );
    const raw = await fs.readFile(filePath, "utf8");
    const infoRaw = await fs.readFile(infoFilePath, "utf8");
    const entries = JSON.parse(raw || "[]");
    const infoEntries = JSON.parse(infoRaw || "[]");

    // Create email and full_name lookup by officer_id
    const emailMap = {};
    const fullNameMap = {};
    for (const info of infoEntries) {
      if (info.officer_id) {
        if (info.email) emailMap[info.officer_id] = info.email;
        if (info.full_name) fullNameMap[info.officer_id] = info.full_name;
      }
    }

    let created = 0,
      skipped = 0,
      createdAuth = 0;
    const zcql = req.catalyst ? req.catalyst.zcql() : null;

    for (const e of entries) {
      try {
        // Lookup rank_id by rank_name
        let rank_id = e.rank_id || null;
        const rankName = (e.rank_name || "").trim();
        if (!rank_id && rankName && zcql) {
          try {
            const rankRows = await zcql.executeZCQLQuery(
              `SELECT ROWID FROM ${env.TABLE_POLICE_RANK} WHERE rank_name = '${rankName.replace(/'/g, "''")}' LIMIT 1`,
            );
            if (rankRows && rankRows.length) {
              rank_id =
                rankRows[0].ROWID ||
                rankRows[0][env.TABLE_POLICE_RANK]?.ROWID ||
                null;
              logger.debug("rank lookup", {
                rankName,
                rank_id,
              });
            }
          } catch (err) {
            logger.warn(
              "rank lookup failed",
              err && err.message ? err.message : err,
            );
          }
        }

        // Lookup station_id by station_name
        let station_id = e.station_id || null;
        const stationName = (e.station_name || "").trim();
        if (!station_id && stationName && zcql) {
          try {
            const stationRows = await zcql.executeZCQLQuery(
              `SELECT ROWID FROM ${env.TABLE_POLICE_STATION} WHERE station_name = '${stationName.replace(/'/g, "''")}' LIMIT 1`,
            );
            if (stationRows && stationRows.length) {
              station_id =
                stationRows[0].ROWID ||
                stationRows[0][env.TABLE_POLICE_STATION]?.ROWID ||
                null;
              logger.debug("station lookup", {
                stationName,
                station_id,
              });
            }
          } catch (err) {
            logger.warn(
              "station lookup failed",
              err && err.message ? err.message : err,
            );
          }
        }

        const dto = {
          email: (e.email || "").trim(),
          badge_number: e.badge_number || e.badge || e.badgeNo || null,
          name:
            e.name ||
            e.full_name ||
            `${e.first_name || ""} ${e.last_name || ""}`.trim(),
          rank_id,
          station_id,
          date_of_joining: e.date_of_joining || null,
          operational_status: e.operational_status || "ACTIVE",
          contact_number: e.contact_number || e.phone || null,
        };
        // try create officer, if duplicate badge exists createOfficer will throw
        await policeRepo.createOfficer(dto, req);
        created++;

        // Create or link sys_user record for the officer
        // Get email from police_officer_info if available, otherwise use provided or generate
        const officerId =
          e.user_id && e.user_id.match(/\d+/)
            ? parseInt(e.user_id.match(/\d+/)[0], 10)
            : null;
        const officerEmail =
          (officerId && emailMap[officerId]) ||
          dto.email ||
          `${dto.badge_number}@police.local`.toLowerCase();
        if (officerEmail && zcql) {
          try {
            // Check if user already exists
            const userInfoRows = await zcql.executeZCQLQuery(
              `SELECT ROWID FROM ${env.TABLE_USER_INFO} WHERE email = '${officerEmail.replace(/'/g, "''")}' LIMIT 1`,
            );

            let userId = null;
            let userInfoId = null;

            if (userInfoRows && userInfoRows.length) {
              // User exists, get their IDs
              userInfoId =
                userInfoRows[0].ROWID ||
                userInfoRows[0][env.TABLE_USER_INFO]?.ROWID;
              const userRows = await zcql.executeZCQLQuery(
                `SELECT ROWID FROM ${env.TABLE_USER} WHERE user_info_id = '${userInfoId}' LIMIT 1`,
              );
              if (userRows && userRows.length) {
                userId =
                  userRows[0].ROWID || userRows[0][env.TABLE_USER]?.ROWID;
              }
            } else {
              // Create new sys_user_info record
              const userInfoTable = req.catalyst
                .datastore()
                .table(env.TABLE_USER_INFO);

              // Use full_name from police_officer_info, fallback to dto.name
              const fullName =
                (officerId && fullNameMap[officerId]) || dto.name || "";
              const nameParts = fullName.split(" ");
              const userFirstName = nameParts[0] || "";
              const userLastName = nameParts.slice(1).join(" ") || "";

              const userInfoSaved = await userInfoTable.insertRow({
                email: officerEmail,
                user_first_name: userFirstName,
                user_last_name: userLastName,
                phone: e.contact_number || null,
              });
              userInfoId = userInfoSaved.ROWID;

              // Create new sys_user record
              const userTable = req.catalyst.datastore().table(env.TABLE_USER);
              const userSaved = await userTable.insertRow({
                user_info_id: userInfoId,
                is_archived: false,
              });
              userId = userSaved.ROWID;
              logger.info("created sys_user for officer", {
                badge: dto.badge_number,
                email: officerEmail,
                userId,
              });
            }

            // Assign default OFFICER role if not already assigned
            if (userId) {
              try {
                // Find OFFICER role
                const roleRows = await zcql.executeZCQLQuery(
                  `SELECT ROWID FROM ${env.TABLE_ROLE} WHERE role_name = '${env.DEFAULT_OFFICER_ROLE}' LIMIT 1`,
                );
                if (roleRows && roleRows.length) {
                  const roleId =
                    roleRows[0].ROWID || roleRows[0][env.TABLE_ROLE]?.ROWID;

                  // Check if role already assigned
                  const existingRoleRows = await zcql.executeZCQLQuery(
                    `SELECT ROWID FROM ${env.TABLE_USER_ROLE} WHERE user_id = '${userId}' AND role_id = '${roleId}' LIMIT 1`,
                  );

                  if (!existingRoleRows || existingRoleRows.length === 0) {
                    const userRoleTable = req.catalyst
                      .datastore()
                      .table(env.TABLE_USER_ROLE);
                    await userRoleTable.insertRow({
                      user_id: userId,
                      role_id: roleId,
                    });
                    logger.info("assigned default role to officer", {
                      badge: dto.badge_number,
                      role: env.DEFAULT_OFFICER_ROLE,
                    });
                  }
                }
              } catch (err) {
                logger.warn("failed to assign role to officer", {
                  badge: dto.badge_number,
                  error: err && err.message ? err.message : String(err),
                });
              }
            }

            // Create Catalyst auth user with default password
            try {
              const fullName =
                (officerId && fullNameMap[officerId]) || dto.name || "";
              const createdAuthRes = await catalystAuth.createUser(
                req,
                officerEmail,
                "Police@123",
                fullName || undefined,
              );
              const catalystUserId =
                createdAuthRes?.user_details?.user_id ||
                createdAuthRes?.user_details?.zuid ||
                createdAuthRes?.user_id ||
                null;
              if (catalystUserId && userId) {
                const userTable = req.catalyst
                  .datastore()
                  .table(env.TABLE_USER);
                await userTable.updateRow({
                  ROWID: userId,
                  catalyst_user_id: catalystUserId,
                });
                createdAuth++;
                logger.info("created catalyst auth for officer", {
                  badge: dto.badge_number,
                  email: officerEmail,
                });
              }
            } catch (err) {
              logger.warn("failed to create catalyst auth for officer", {
                badge: dto.badge_number,
                email: officerEmail,
                error: err && err.message ? err.message : String(err),
              });
            }
          } catch (err) {
            logger.warn("failed to create sys_user for officer", {
              badge: dto.badge_number,
              email: officerEmail,
              error: err && err.message ? err.message : String(err),
            });
          }
        }
      } catch (err) {
        skipped++;
        logger.warn("skipping officer insert", {
          badge: e.badge_number || e.user_id || "unknown",
          name: e.name || e.full_name || "unknown",
          rank: e.rank_name || "unknown",
          station: e.station_name || "unknown",
          error: err && err.message ? err.message : String(err),
          fullError:
            err && err.stack
              ? err.stack
              : err && err.message
                ? err.message
                : err,
        });
      }
    }
    return { created, skipped, createdAuth };
  },

  async bootstrapCriminal(req) {
    logger.info("bootstrapCriminal");
    const filePath = path.join(__dirname, "data", "criminal", "criminal.json");
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");
    let created = 0,
      skipped = 0;
    const zcql = req.catalyst.zcql();
    for (const e of entries) {
      try {
        // map district code (KA-10) to geo table district_code (KA-10)
        let district_id = null;
        const code = (
          e.district_code_of_criminal ||
          e.district_code ||
          ""
        ).replace(/_/g, "-");
        if (code) {
          try {
            const rows = await zcql.executeZCQLQuery(
              `SELECT ROWID FROM ${env.TABLE_DISTRICT_GEODATA} WHERE district_code = '${code.replace(/'/g, "''")}' LIMIT 1`,
            );
            if (rows && rows.length)
              district_id =
                rows[0].ROWID || rows[0][env.TABLE_DISTRICT_GEODATA]?.ROWID;
          } catch (err) {
            logger.warn(
              "district lookup failed",
              err && err.message ? err.message : err,
            );
          }
        }
        const dto = {
          criminal_number: e.criminal_number || null,
          full_name: e.full_name || e.name || null,
          gender: e.gender || null,
          date_of_birth: e.date_of_birth || null,
          nationality: e.nationality || null,
          photo_url: e.photo_url || null,
          status: e.status || "ACTIVE",
          address: e.address || null,
          district_id_of_criminal: district_id,
        };
        await criminalRepo.addCriminal(dto, req);
        created++;
      } catch (err) {
        skipped++;
        logger.warn(
          "failed to insert criminal",
          err && err.message ? err.message : err,
        );
      }
    }
    return { created, skipped };
  },

  async bootstrapFirs(req) {
    logger.info("bootstrapFirs");
    const filePath = path.join(__dirname, "data", "crimie", "FIRs.json");
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");
    let created = 0,
      skipped = 0;
    const zcql = req.catalyst.zcql();
    for (const e of entries) {
      try {
        const fir_number =
          e.fir_number ||
          (e.fir_id ? `FIR-${String(e.fir_id).padStart(6, "0")}` : null);
        // find district id
        let district_id = null;
        const dcode = (e.district_code || e.fir_district_code || "").replace(
          /_/g,
          "-",
        );
        if (dcode) {
          try {
            const rows = await zcql.executeZCQLQuery(
              `SELECT ROWID FROM ${env.TABLE_DISTRICT_GEODATA} WHERE district_code = '${dcode.replace(/'/g, "''")}' LIMIT 1`,
            );
            if (rows && rows.length)
              district_id =
                rows[0].ROWID || rows[0][env.TABLE_DISTRICT_GEODATA]?.ROWID;
          } catch (err) {
            logger.warn(
              "district lookup failed",
              err && err.message ? err.message : err,
            );
          }
        }
        // find police station id by name
        let police_station_id = null;
        if (e.police_station_name) {
          try {
            const srows = await zcql.executeZCQLQuery(
              `SELECT ROWID FROM ${env.TABLE_POLICE_STATION} WHERE station_name = '${e.police_station_name.replace(/'/g, "''")} ' LIMIT 1`,
            );
            if (srows && srows.length)
              police_station_id =
                srows[0].ROWID || srows[0][env.TABLE_POLICE_STATION]?.ROWID;
          } catch (err) {
            logger.warn(
              "station lookup failed",
              err && err.message ? err.message : err,
            );
          }
        }
        const dto = {
          fir_number,
          complainant_name: e.complainant_name || e.complainant || null,
          complainant_phone: e.complainant_phone || e.complainant_phone || null,
          incident_description:
            e.incident_description || e.incident_description || null,
          assigned_officer_id: null,
          district_id,
          fir_status: e.fir_status || null,
          police_station_id,
        };
        await firRepo.addFir(dto, req);
        created++;
      } catch (err) {
        skipped++;
        logger.warn(
          "failed to insert FIR",
          err && err.message ? err.message : err,
        );
      }
    }
    return { created, skipped };
  },
};
