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
    const table = req.catalyst
      ? req.catalyst.datastore().table(env.TABLE_POLICE_STATION)
      : null;

    // Prefetch all districts into a map to avoid N queries
    const districtMap = new Map();
    if (zcql) {
      try {
        const rows = await zcql.executeZCQLQuery(
          `SELECT ROWID, district_name FROM ${env.TABLE_DISTRICT_GEODATA}`,
        );
        for (const row of rows) {
          const d = row[env.TABLE_DISTRICT_GEODATA];
          if (d && d.district_name && d.ROWID) {
            districtMap.set(d.district_name.toLowerCase(), d.ROWID);
          }
        }
      } catch (err) {
        logger.warn("failed to bulk load districts", err && err.message ? err.message : String(err));
      }
    }

    const rowsToInsert = [];

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

      // resolve district id from pre-fetched map
      let district_id = null;
      const districtName =
        props.districtName ||
        props.DISTRICT ||
        props.DISTRICT_NAME ||
        props.district_name ||
        null;
        
      if (districtName) {
        const key = districtName.toLowerCase();
        if (districtMap.has(key)) {
          district_id = districtMap.get(key);
        } else {
          logger.warn("district lookup failed for station", {
            stationName: name,
            districtName,
          });
        }
      }

      rowsToInsert.push({
        district_id,
        station_name: name,
        station_code,
        latitude,
        longitude,
        address,
        station_type_id: null,
      });
    }

    if (rowsToInsert.length > 0 && table) {
      const BATCH_SIZE = 200;
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
        try {
          await table.insertRows(chunk);
          created += chunk.length;
        } catch (err) {
          logger.warn("failed to bulk insert stations", err && err.message ? err.message : String(err));
          skipped += chunk.length;
        }
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
          crime_category_number: e.crime_category_number || null,
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

  async bootstrapCrimeIncidents(req) {
    logger.info("bootstrapCrimeIncidents");
    const requestedFile =
      req && req.body && req.body.fileName ? String(req.body.fileName) : null;
    const safeFileName = requestedFile
      ? path.basename(requestedFile)
      : "crime_incident.json";
    const filePath = path.join(__dirname, "data", "crimie", safeFileName);
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");

    let created = 0;
    let skipped = 0;
    const zcql = req.catalyst.zcql();

    // 1. Fetch default user
    let defaultUserId = null;
    try {
      const userRows = await zcql.executeZCQLQuery(
        `SELECT ROWID FROM ${env.TABLE_USER} LIMIT 1`,
      );
      if (userRows && userRows.length) {
        defaultUserId =
          userRows[0].ROWID || userRows[0][env.TABLE_USER]?.ROWID || null;
      }
    } catch (err) {
      logger.warn(
        "Failed to fetch default user for bootstrap",
        err && err.message ? err.message : err,
      );
    }

    if (!defaultUserId) {
      try {
        const email = "system@crimelens.local";
        const infoTable = req.catalyst.datastore().table(env.TABLE_USER_INFO);
        const userTable = req.catalyst.datastore().table(env.TABLE_USER);

        const infoSaved = await infoTable.insertRow({
          user_first_name: "System",
          user_last_name: "User",
          email: email,
        });
        const userSaved = await userTable.insertRow({
          user_info_id: infoSaved.ROWID,
          is_archived: false,
        });
        defaultUserId = userSaved.ROWID;
      } catch (err) {
        logger.warn(
          "Failed to create system user fallback",
          err.message || err,
        );
      }
    }

    // 2. Fetch and cache categories
    const categoriesMap = {};
    try {
      const catRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, crime_category_name FROM ${env.TABLE_CRIME_CATEGORY}`,
      );
      for (const r of catRows) {
        const cat = r[env.TABLE_CRIME_CATEGORY] || r;
        if (cat && cat.crime_category_name) {
          categoriesMap[cat.crime_category_name.trim().toLowerCase()] =
            cat.ROWID;
        }
      }
    } catch (err) {
      logger.warn("Failed to cache crime categories:", err.message);
    }

    // 3. Fetch and cache stations
    const stationsMap = {};
    try {
      const stationRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION}`,
      );
      for (const r of stationRows) {
        const st = r[env.TABLE_POLICE_STATION] || r;
        if (st && st.station_name) {
          stationsMap[st.station_name.trim().toLowerCase()] = st.ROWID;
        }
      }
      if (stationRows && stationRows.length) {
        logger.info(
          "Sample station row from DB: " + JSON.stringify(stationRows[0]),
        );
        logger.info(
          "Cached stations count: " + Object.keys(stationsMap).length,
        );
        logger.info(
          "Sample cached station key: " + Object.keys(stationsMap)[0],
        );
      }
    } catch (err) {
      logger.warn("Failed to cache police stations:", err.message);
    }

    // 4. Fetch and cache districts
    const districtsMap = {};
    try {
      const distRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, district_code FROM ${env.TABLE_DISTRICT_GEODATA}`,
      );
      for (const r of distRows) {
        const dist = r[env.TABLE_DISTRICT_GEODATA] || r;
        if (dist && dist.district_code) {
          districtsMap[dist.district_code.trim().toLowerCase()] = dist.ROWID;
        }
      }
    } catch (err) {
      logger.warn("Failed to cache districts:", err.message);
    }

    // // 5. Lazy FIR cache
    // const firsCache = {};
    // const getFirId = async (firNumber) => {
    //   if (!firNumber) return null;
    //   const key = firNumber.trim().toLowerCase();
    //   if (firsCache[key] !== undefined) {
    //     logger.debug && logger.debug(`FIR cache hit for ${firNumber}`);
    //     return firsCache[key];
    //   }
    //   try {
    //     logger.debug && logger.debug(`Looking up FIR id for ${firNumber}`);
    //     const rows = await zcql.executeZCQLQuery(
    //       `SELECT ROWID FROM ${env.TABLE_FIR} WHERE fir_number = '${firNumber.replace(/'/g, "''")}' LIMIT 1`,
    //     );
    //     if (rows && rows.length) {
    //       firsCache[key] =
    //         rows[0].ROWID || rows[0][env.TABLE_FIR]?.ROWID || null;
    //       logger.debug &&
    //         logger.debug(`Cached FIR id for ${firNumber}: ${firsCache[key]}`);
    //     } else {
    //       firsCache[key] = null;
    //       logger.debug && logger.debug(`No FIR found for ${firNumber}`);
    //     }
    //   } catch (err) {
    //     logger.warn(
    //       `Failed lookup for FIR ${firNumber}:`,
    //       err && err.message ? err.message : err,
    //     );
    //     firsCache[key] = null;
    //   }
    //   return firsCache[key];
    // };

    // Prefetch FIR ids for all FIR numbers present in the file to avoid per-row ZCQL calls
    try {
      const uniqueFirs = new Set();
      for (const e of entries) {
        if (e && e.fir_number) uniqueFirs.add((e.fir_number || "").trim());
      }
      const firList = Array.from(uniqueFirs).filter(Boolean);
      if (firList.length) {
        const CHUNK = 500;
        logger.info(
          `Prefetching ${firList.length} FIR ids in chunks of ${CHUNK}`,
        );
        for (let j = 0; j < firList.length; j += CHUNK) {
          const slice = firList.slice(j, j + CHUNK);
          const inList = slice
            .map((fn) => `'${fn.replace(/'/g, "''")}'`)
            .join(",");
          try {
            const rows = await zcql.executeZCQLQuery(
              `SELECT ROWID, fir_number FROM ${env.TABLE_FIR} WHERE fir_number IN (${inList})`,
            );
            for (const r of rows || []) {
              const rec = r[env.TABLE_FIR] || r;
              if (rec && rec.fir_number) {
                firsCache[(rec.fir_number || "").trim().toLowerCase()] =
                  rec.ROWID || null;
              }
            }
            logger.info(
              `Prefetched FIR chunk ${j + 1}-${Math.min(j + CHUNK, firList.length)} of ${firList.length}`,
            );
          } catch (err) {
            logger.warn(
              `Failed to prefetch FIR chunk ${j + 1}-${Math.min(j + CHUNK, firList.length)}`,
              err && err.message ? err.message : err,
            );
          }
        }
      }
    } catch (err) {
      logger.warn(
        "FIR prefetch failed",
        err && err.message ? err.message : err,
      );
    }

    // Prerequisite validations
    if (Object.keys(districtsMap).length === 0) {
      throw new Error(
        "No districts found in the database. Please seed districts first using POST /seed/geojson/bootstrap",
      );
    }
    if (Object.keys(stationsMap).length === 0) {
      throw new Error(
        "No police stations found in the database. Please seed stations first using POST /seed/police-station/bootstrap",
      );
    }
    if (Object.keys(categoriesMap).length === 0) {
      throw new Error(
        "No crime categories found in the database. Please seed categories first using POST /seed/crime-category/bootstrap",
      );
    }

    // Build raw rows for batch insert, resolving FIR ids and skipping existing crime_numbers
    const incidentTable = req.catalyst
      .datastore()
      .table(env.TABLE_CRIME_INCIDENT);

    // Fetch existing crime_numbers to avoid duplicates
    const existingCrimeNumbers = new Set();
    try {
      const existingRows = await zcql.executeZCQLQuery(
        `SELECT crime_number FROM ${env.TABLE_CRIME_INCIDENT}`,
      );
      for (const r of existingRows || []) {
        const rec = r[env.TABLE_CRIME_INCIDENT] || r;
        if (rec && rec.crime_number)
          existingCrimeNumbers.add(
            (rec.crime_number || "").trim().toLowerCase(),
          );
      }
      logger.info(
        `Found ${existingCrimeNumbers.size} existing crime_number records in DB`,
      );
    } catch (err) {
      logger.warn(
        "Failed to fetch existing crime numbers, continuing without de-duplication",
        err && err.message ? err.message : err,
      );
    }

    const rowsToInsert = [];
    logger.info(`Preparing ${entries.length} source entries for insert`);
    let prepared = 0;
    let skippedExisting = 0;
    for (const e of entries) {
      try {
        const crimeNumber = (e.crime_number || "").trim();
        if (
          crimeNumber &&
          existingCrimeNumbers.has(crimeNumber.toLowerCase())
        ) {
          skipped++;
          skippedExisting++;
          if (skippedExisting % 1000 === 0)
            logger.info(
              `Skipped ${skippedExisting} existing crime_number entries so far`,
            );
          continue;
        }

        const categoryName = (e.crime_category || "").trim().toLowerCase();
        const crime_category_id = categoriesMap[categoryName] || null;

        const stationName = (e.police_station || "").trim().toLowerCase();
        const police_station_id = stationsMap[stationName] || null;

        const districtCode = (e.crime_happened_at_district_code || "")
          .trim()
          .toLowerCase()
          .replace(/_/g, "-");
        const crime_happended_at_district_id =
          districtsMap[districtCode] || null;

        // const fir_id = await getFirId(e.fir_number);
        const fir_id = null;

        const row = {
          crime_number: crimeNumber || null,
          title: e.title || "Unknown Crime",
          description: e.description || null,
          crime_category_id,
          police_station_id,
          crime_happended_at_district_id,
          crime_location_latitude: e.crime_location_latitude || null,
          crime_location_longitude: e.crime_location_longitude || null,
          status: e.status || "UNDER_INVESTIGATION",
          crime_occured_date_time: e.crime_occured_date_time || null,
          incident_registered_date: e.crime_occured_date_time
            ? e.crime_occured_date_time.split(" ")[0]
            : null,
          fir_id,
          created_by: defaultUserId,
        };

        rowsToInsert.push(row);
        prepared++;
        if (prepared % 1000 === 0)
          logger.info(`Prepared ${prepared} rows for insert so far`);
      } catch (err) {
        skipped++;
        logger.warn(
          `Failed to prepare crime incident for insert: ${e && e.crime_number ? e.crime_number : "unknown"}`,
          err && err.message ? err.message : err,
        );
      }
    }
    logger.info(
      `Prepared ${prepared} rows to insert; ${skippedExisting} skipped because already exist; ${skipped} total skipped during preparation`,
    );

    // Insert in batches with retry for transient errors (e.g., invalid oauth token)
    const BATCH_SIZE = 200;
    let insertedCount = 0;
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
      let attempt = 0;
      const maxAttempts = 3;
      logger.info(
        `Starting batch insert for rows ${i + 1}-${i + chunk.length}`,
      );
      while (attempt < maxAttempts) {
        try {
          if (typeof incidentTable.insertRows === "function") {
            await incidentTable.insertRows(chunk);
          } else {
            for (const r of chunk) await incidentTable.insertRow(r);
          }
          insertedCount += chunk.length;
          logger.info(
            `Inserted crime incidents batch ${i + 1}-${i + chunk.length} (total inserted ${insertedCount})`,
          );
          break;
        } catch (err) {
          attempt++;
          const msg = err && err.message ? err.message : String(err);
          logger.warn(
            `Batch insert attempt ${attempt} failed for crime incidents ${i + 1}-${i + chunk.length}: ${msg}`,
          );
          // If oauth error, include actionable guidance in the logs
          if (/invalid\s*oauth|token/i.test(msg)) {
            logger.error(
              "Detected OAuth token error during batch insert. Verify Catalyst auth and env/catalyst credentials.",
            );
          }
          if (attempt < maxAttempts) {
            const backoff = 500 * attempt;
            await new Promise((res) => setTimeout(res, backoff));
            logger.info(
              `Retrying batch insert (attempt ${attempt + 1}/${maxAttempts})`,
            );
            continue;
          }

          // fallback: try individual inserts to isolate failing rows
          logger.warn("Falling back to single-row insert for this batch");
          for (const r of chunk) {
            try {
              await incidentTable.insertRow(r);
              insertedCount++;
            } catch (singleErr) {
              skipped++;
              logger.warn(
                `Failed to insert crime incident ${r && r.crime_number ? r.crime_number : "unknown"}`,
                singleErr && singleErr.message ? singleErr.message : singleErr,
              );
            }
          }
          break;
        }
      }
    }

    logger.info(
      `Crime incidents bootstrap completed. Inserted: ${insertedCount}, Skipped: ${skipped}`,
    );
    return { created: insertedCount, skipped };
  },

  async bootstrapIncidentCriminals(req) {
    logger.info("bootstrapIncidentCriminals");
    const filePath = path.join(
      __dirname,
      "data",
      "crimie",
      "incident_criminal.json",
    );

    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");

    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    if (!zcql) throw new Error("Catalyst not available");

    // 1️⃣ Cache crime incidents (crime_number → ROWID)
    const crimeMap = {};
    const validCrimes = [];
    try {
      const crimeRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, crime_number FROM ${env.TABLE_CRIME_INCIDENT}`,
      );
      for (const r of crimeRows) {
        const rec = r[env.TABLE_CRIME_INCIDENT] || r;
        if (rec && rec.crime_number) {
          crimeMap[rec.crime_number.trim().toLowerCase()] = rec.ROWID;
          validCrimes.push(rec.crime_number);
        }
      }
    } catch (e) {
      logger.warn("Failed to cache crime incidents", e);
    }

    // 2️⃣ Cache criminals (criminal_number → ROWID)
    const criminalMap = {};
    const validCriminals = [];
    try {
      const crimRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, criminal_number FROM ${env.TABLE_CRIMINAL}`,
      );
      for (const r of crimRows) {
        const rec = r[env.TABLE_CRIMINAL] || r;
        if (rec && rec.criminal_number) {
          criminalMap[rec.criminal_number.trim().toLowerCase()] = rec.ROWID;
          validCriminals.push(rec.criminal_number);
        }
      }
    } catch (e) {
      logger.warn("Failed to cache criminals", e);
    }

    // Replace invalid crimes and criminals with valid ones
    let fileUpdated = false;
    if (validCrimes.length > 0 && validCriminals.length > 0) {
      for (const e of entries) {
        const crimeKey = (e.crime_number || "").trim().toLowerCase();
        if (!crimeMap[crimeKey]) {
          const randCrime =
            validCrimes[Math.floor(Math.random() * validCrimes.length)];
          e.crime_number = randCrime;
          fileUpdated = true;
        }

        const crimKey = (e.criminal_number || "").trim().toLowerCase();
        if (!criminalMap[crimKey]) {
          const randCriminal =
            validCriminals[Math.floor(Math.random() * validCriminals.length)];
          e.criminal_number = randCriminal;
          fileUpdated = true;
        }
      }
      if (fileUpdated) {
        await fs.writeFile(filePath, JSON.stringify(entries, null, 2), "utf8");
        logger.info("Updated incident_criminal.json with valid db references.");
      }
    }

    // 3️⃣ Fetch existing relationships in memory to avoid duplicate checking in the loop
    const existingRelations = new Set();
    try {
      let offset = 0;
      const limit = 100;
      while (true) {
        const rows = await zcql.executeZCQLQuery(
          `SELECT incident_id, criminal_id FROM ${env.TABLE_INCIDENT_CRIMINAL} LIMIT ${limit} OFFSET ${offset}`,
        );
        if (!rows || rows.length === 0) break;
        for (const r of rows) {
          const rec = r[env.TABLE_INCIDENT_CRIMINAL] || r;
          if (rec.incident_id && rec.criminal_id) {
            existingRelations.add(`${rec.incident_id}-${rec.criminal_id}`);
          }
        }
        if (rows.length < limit) break;
        offset += limit;
      }
      logger.info(
        `Loaded ${existingRelations.size} existing incident-criminal relationships.`,
      );
    } catch (e) {
      logger.warn("Failed to fetch existing relationships", e);
    }

    // 4️⃣ Identify relationships to insert
    let created = 0;
    let skipped = 0;
    const icTable = req.catalyst.datastore().table(env.TABLE_INCIDENT_CRIMINAL);
    const rowsToInsert = [];

    for (const e of entries) {
      const crimeKey = (e.crime_number || "").trim().toLowerCase();
      const crimKey = (e.criminal_number || "").trim().toLowerCase();
      const crimeId = crimeMap[crimeKey];
      const criminalId = criminalMap[crimKey];

      if (!crimeId || !criminalId) {
        skipped++;
        let reason = "Missing ";
        if (!crimeId && !criminalId) reason += "crime and criminal";
        else if (!crimeId) reason += "crime";
        else reason += "criminal";
        logger.info(
          `Skipping incident-criminal link: crime_number=${e.crime_number}, criminal_number=${e.criminal_number} - Reason: ${reason}`,
        );
        continue;
      }

      if (existingRelations.has(`${crimeId}-${criminalId}`)) {
        skipped++;
        logger.info(
          `Skipping incident-criminal link: crime_number=${e.crime_number}, criminal_number=${e.criminal_number} - Reason: Duplicate`,
        );
        continue;
      }

      rowsToInsert.push({
        incident_id: crimeId,
        criminal_id: criminalId,
      });
    }

    // 5️⃣ Insert relationships in batches of 100
    const chunkSize = 100;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      try {
        await icTable.insertRows(chunk);
        created += chunk.length;
        logger.info(
          `Inserted batch of ${chunk.length} relations (${i + chunk.length}/${rowsToInsert.length})`,
        );
      } catch (err) {
        logger.warn(
          `Failed to insert batch of ${chunk.length} relations, falling back to single inserts...`,
          err.message || err,
        );
        for (const item of chunk) {
          try {
            await icTable.insertRow(item);
            created++;
          } catch (singleErr) {
            logger.warn("Failed to insert single incident-criminal link", {
              item,
              error: singleErr.message || singleErr,
            });
            skipped++;
          }
        }
      }
    }

    return { created, skipped };
  },

  async generateCrime(req) {
    logger.info("generateCrime");
    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    // Fetch reference maps
    const categoriesMap = {};
    const stationsMap = {};
    const districtsMap = {};
    try {
      const catRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, crime_category_name FROM ${env.TABLE_CRIME_CATEGORY}`,
      );
      for (const r of catRows) {
        const cat = r[env.TABLE_CRIME_CATEGORY] || r;
        if (cat && cat.crime_category_name) {
          categoriesMap[cat.crime_category_name.trim().toLowerCase()] =
            cat.ROWID;
        }
      }
    } catch (e) {
      logger.warn("fetch categories error", e);
    }
    try {
      const stationRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION}`,
      );
      for (const r of stationRows) {
        const st = r[env.TABLE_POLICE_STATION] || r;
        if (st && st.station_name) {
          stationsMap[st.station_name.trim().toLowerCase()] = st.ROWID;
        }
      }
    } catch (e) {
      logger.warn("fetch stations error", e);
    }
    try {
      const distRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, district_code FROM ${env.TABLE_DISTRICT_GEODATA}`,
      );
      for (const r of distRows) {
        const d = r[env.TABLE_DISTRICT_GEODATA] || r;
        if (d && d.district_code) {
          districtsMap[d.district_code.trim().toLowerCase()] = d.ROWID;
        }
      }
    } catch (e) {
      logger.warn("fetch districts error", e);
    }

    const categoryKeys = Object.keys(categoriesMap);
    const stationKeys = Object.keys(stationsMap);
    const districtKeys = Object.keys(districtsMap);
    if (!categoryKeys.length || !stationKeys.length || !districtKeys.length) {
      throw new Error("Required reference data missing for generateCrime");
    }
    const randomCategory =
      categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const randomStation =
      stationKeys[Math.floor(Math.random() * stationKeys.length)];
    const randomDistrict =
      districtKeys[Math.floor(Math.random() * districtKeys.length)];

    const dto = {
      crime_number: `CASE-${Date.now()}`,
      title: "Generated Crime",
      description: "Automatically generated incident",
      crime_category_id: categoriesMap[randomCategory],
      police_station_id: stationsMap[randomStation],
      crime_happended_at_district_id: districtsMap[randomDistrict],
      crime_location_latitude: null,
      crime_location_longitude: null,
      status: "UNDER_INVESTIGATION",
      crime_occured_date_time: new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " "),
      fir_id: null,
      created_by: "46044000000052002",
    };
    const result = await crimeRepo.addCrime(dto, req);
    return result;
  },

  async calculateDistrictCrimeStats(req) {
    logger.info("calculateDistrictCrimeStats in-memory grouping");

    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    if (!zcql) throw new Error("Catalyst not available");

    const datastore = req.catalyst.datastore();
    const statsTable = datastore.table(env.TABLE_COMP_DISTRICT_CRIME_STATS);

    let incidents = [];

    try {
      // Fetch all incidents using Datastore pagination to bypass the ZCQL 300-row default limit
      const incidentTable = datastore.table(env.TABLE_CRIME_INCIDENT);
      let nextToken = undefined;
      logger.info("Starting pagination fetch for crime incidents");
      do {
        const pagedResp = await incidentTable.getPagedRows({
          nextToken,
          maxRows: 200,
        });
        if (pagedResp && pagedResp.data) {
          incidents.push(...pagedResp.data);
          logger.info(
            `Fetched ${pagedResp.data.length} incidents, nextToken=${pagedResp.next_token}`,
          );
        }
        nextToken = pagedResp ? pagedResp.next_token : undefined;
      } while (nextToken);

      logger.info(
        `Fetched ${incidents.length} total incidents to group in memory`,
      );
    } catch (e) {
      logger.warn(
        "Failed to fetch all incidents via getPagedRows",
        e.message || e,
      );
      throw new Error("Failed to fetch incidents: " + (e.message || e));
    }

    // In-memory grouping to correctly group by DATE (ignoring time)
    const statsMap = {};

    for (const row of incidents) {
      const data = row[env.TABLE_CRIME_INCIDENT] || row;
      const districtId = data.crime_happended_at_district_id;
      const policeStationId = data.police_station_id;
      const crimeCategoryId = data.crime_category_id;

      // Strip time from timestamp to group by date only
      let incidentRegisteredDate = data.incident_registered_date
        ? data.incident_registered_date.split(" ")[0].split("T")[0]
        : new Date().toISOString().split("T")[0];

      if (districtId && policeStationId && crimeCategoryId) {
        const key = `${districtId}_${policeStationId}_${crimeCategoryId}_${incidentRegisteredDate}`;
        if (!statsMap[key]) {
          statsMap[key] = {
            district_id: districtId,
            police_station_id: policeStationId,
            crime_category_id: crimeCategoryId,
            incident_registered_date: incidentRegisteredDate,
            crime_count: 0,
          };
        }
        statsMap[key].crime_count += 1;
      }
    }

    const aggregatedRows = Object.values(statsMap);
    logger.info(
      `Found ${aggregatedRows.length} grouped crime stat rows after in-memory aggregation`,
    );

    logger.info(
      `Processing ${aggregatedRows.length} aggregated rows for upsert`,
    );
    // Batch insert new stats rows to reduce API calls
    const toInsert = [];
    const BATCH_SIZE = 200;
    let created = 0;
    let updated = 0;

    for (const stat of aggregatedRows) {
      logger.debug(
        `Upserting stat: district=${stat.district_id}, station=${stat.police_station_id}, category=${stat.crime_category_id}, date=${stat.incident_registered_date}`,
      );
      try {
        const checkQuery = `
        SELECT ROWID, crime_count
        FROM ${env.TABLE_COMP_DISTRICT_CRIME_STATS}
        WHERE district_id = '${stat.district_id}'
          AND police_station_id = '${stat.police_station_id}'
          AND crime_category_id = '${stat.crime_category_id}'
          AND incident_registered_date = '${stat.incident_registered_date}'
        `;
        const existing = await zcql.executeZCQLQuery(checkQuery);
        if (existing && existing.length > 0) {
          const statRow =
            existing[0][env.TABLE_COMP_DISTRICT_CRIME_STATS] || existing[0];
          if (Number(statRow.crime_count) !== stat.crime_count) {
            await statsTable.updateRow({
              ROWID: statRow.ROWID,
              crime_count: stat.crime_count,
            });
            updated++;
          }
        } else {
          // collect for batch insert
          toInsert.push({
            district_id: stat.district_id,
            police_station_id: stat.police_station_id,
            crime_category_id: stat.crime_category_id,
            incident_registered_date: stat.incident_registered_date,
            crime_count: stat.crime_count,
          });
        }
      } catch (err) {
        logger.warn("Failed to upsert stat", err.message || err);
      }
    }

    // Insert new rows in batches
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      try {
        await statsTable.insertRows(chunk);
        created += chunk.length;
      } catch (e) {
        logger.warn("Batch insert failed", e.message || e);
        // fallback to individual inserts for this chunk
        for (const row of chunk) {
          try {
            await statsTable.insertRow(row);
            created++;
          } catch (e2) {
            logger.warn("Fallback insert failed", e2.message || e2);
          }
        }
      }
    }

    logger.info(
      `Crime stats calculation completed. Created: ${created}, Updated: ${updated}`,
    );

    return { created, updated };
  },

  async dumpData(req) {
    const zcql = req.catalyst.zcql();
    const stations = await zcql.executeZCQLQuery(
      `SELECT station_name, district_id FROM ${env.TABLE_POLICE_STATION}`,
    );
    const districts = await zcql.executeZCQLQuery(
      `SELECT ROWID, district_code, district_name FROM ${env.TABLE_DISTRICT_GEODATA}`,
    );
    return { stations, districts };
  },

  async getAllTableCounts(req) {
    const zcql = req.catalyst.zcql();
    const tables = [
      env.TABLE_CONFIGURATION,
      env.TABLE_PERMISSION,
      env.TABLE_ROLE,
      env.TABLE_ROLE_PERMISSION,
      env.TABLE_USER,
      env.TABLE_USER_INFO,
      env.TABLE_USER_ROLE,
      env.TABLE_USER_CONFIGURATION,
      env.TABLE_POLICE_OFFICER,
      env.TABLE_POLICE_RANK,
      env.TABLE_POLICE_STATION,
      env.TABLE_STATION_TYPE,
      env.TABLE_DISTRICT_GEODATA,
      env.TABLE_CRIMINAL,
      env.TABLE_CRIME_INCIDENT,
      env.TABLE_FIR,
      env.TABLE_CRIME_EVIDENCE,
      env.TABLE_INCIDENT_OFFICER,
      env.TABLE_INCIDENT_CRIMINAL,
      env.TABLE_CRIME_CATEGORY,
      env.TABLE_COMP_DISTRICT_CRIME_STATS,
    ];

    const counts = {};
    for (const tbl of tables) {
      if (!tbl) continue;
      try {
        const res = await zcql.executeZCQLQuery(
          `SELECT COUNT(ROWID) FROM ${tbl}`,
        );
        const firstRow = res && res[0] ? res[0][tbl] || res[0] : null;
        let cnt = 0;
        if (firstRow) {
          cnt = firstRow["COUNT(ROWID)"] || Object.values(firstRow)[0] || 0;
        }
        counts[tbl] = Number(cnt);
      } catch (e) {
        logger.warn(`Failed to count table ${tbl}: ${e.message}`);
        counts[tbl] = 0;
      }
    }
    return counts;
  },
};
