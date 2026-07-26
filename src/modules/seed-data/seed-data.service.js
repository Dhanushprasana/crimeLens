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
const suspectRepo = require("../business/suspect/suspect.repository");
const victimRepo = require("../business/crime/case-victim/case-victim.repository");
const witnessRepo = require("../business/crime/case-witness/case-witness.repository");
const incidentOfficerRepo = require("../business/crime/incident-officer/incident-officer.repository");
const userRepo = require("../scaffolding/user/user.repository");
const bcrypt = require("bcrypt");
const env = require("../../config/env");
const StorageService = require("../storage/storage.service");
const storageConstants = require("../storage/storage.constants");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  values.push(current);
  return values;
}

function parseCsv(raw) {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] === undefined ? "" : values[index];
    });
    return row;
  });
}

function parseIntOrNull(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeLegalDate(value) {
  if (value === null || value === undefined) return null;
  let normalized = String(value).trim();
  if (!normalized) return null;

  // Remove enclosing brackets and trailing dots
  normalized = normalized.replace(/^[\[\(]+|[\]\)]+$/g, "").replace(/\.+$/g, "");
  normalized = normalized.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  normalized = normalized.replace(/\s*,\s*/g, ", ");
  normalized = normalized.replace(/\s+/g, " ").trim();

  const parsed = Date.parse(normalized);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  const yearMatch = normalized.match(/\b(18|19|20)\d{2}\b/);
  if (yearMatch) {
    return new Date(`${yearMatch[0]}-01-01`);
  }

  return null;
}

async function insertRowsInBatches(table, rows) {
  for (let idx = 0; idx < rows.length; idx += 200) {
    const chunk = rows.slice(idx, idx + 200);
    logger.info(`Inserting batch ${idx} to ${idx + chunk.length} of ${rows.length}...`);
    await table.insertRows(chunk);
  }
}

async function fetchExistingMap(zcql, tableName, keyColumns) {
  const rows = await zcql.executeZCQLQuery(`SELECT ROWID, ${keyColumns.join(", ")} FROM ${tableName}`);
  const map = new Map();
  for (const row of rows) {
    const record = row[tableName] || row;
    if (!record || !record.ROWID) continue;
    const key = keyColumns.map((c) => String(record[c] || "").trim()).join("|~|");
    if (key) map.set(key, record.ROWID);
  }
  return map;
}

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
        logger.warn(
          "failed to bulk load districts",
          err && err.message ? err.message : String(err),
        );
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
          logger.warn(
            "failed to bulk insert stations",
            err && err.message ? err.message : String(err),
          );
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

  async bootstrapLegal(req) {
    logger.info("bootstrapLegal");
    const legalDir = path.join(__dirname, "data", "legal");
    const actsCsv = await fs.readFile(path.join(legalDir, "legal_acts.csv"), "utf8");
    const chaptersCsv = await fs.readFile(path.join(legalDir, "legal_chapters.csv"), "utf8");
    const sectionsCsv = await fs.readFile(path.join(legalDir, "legal_sections.csv"), "utf8");

    const acts = parseCsv(actsCsv);
    const chapters = parseCsv(chaptersCsv);
    const sections = parseCsv(sectionsCsv);

    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    const actsTable = req.catalyst ? req.catalyst.datastore().table(env.TABLE_LEGAL_ACTS) : null;
    const chaptersTable = req.catalyst ? req.catalyst.datastore().table(env.TABLE_LEGAL_CHAPTERS) : null;
    const sectionsTable = req.catalyst ? req.catalyst.datastore().table(env.TABLE_LEGAL_SECTIONS) : null;

    if (!zcql || !actsTable || !chaptersTable || !sectionsTable) {
      throw new Error("Catalyst datastore not initialized for legal bootstrap.");
    }

    // Process Acts
    const existingActMap = await fetchExistingMap(zcql, env.TABLE_LEGAL_ACTS, ["act_code"]);
    const actIdMap = new Map();
    const actsToInsert = [];
    const sourceIdToActCode = new Map();

    for (const row of acts) {
      const sourceId = String(row.id || "").trim();
      const actCode = String(row.act_code || "").trim();
      if (!actCode) continue;
      
      if (existingActMap.has(actCode)) {
        actIdMap.set(sourceId, existingActMap.get(actCode));
        continue;
      }
      
      sourceIdToActCode.set(actCode, sourceId);
      actsToInsert.push({
        act_code: row.act_code || null,
        act_name: row.act_name || null,
        act_number: parseIntOrNull(row.act_number),
        year: parseIntOrNull(row.year),
        enactment_date: normalizeLegalDate(row.enactment_date),
        description: row.description || null,
      });
    }

    // Batch Insert Acts
    logger.info(`Starting batch insert for ${actsToInsert.length} acts...`);
    for (let idx = 0; idx < actsToInsert.length; idx += 200) {
      const chunk = actsToInsert.slice(idx, idx + 200);
      logger.info(`Inserting acts ${idx} to ${idx + chunk.length} of ${actsToInsert.length}...`);
      const savedChunk = await actsTable.insertRows(chunk);
      for (const saved of savedChunk) {
        const row = saved[env.TABLE_LEGAL_ACTS] || saved;
        const sourceId = sourceIdToActCode.get(row.act_code);
        if (sourceId && row.ROWID) {
          actIdMap.set(sourceId, row.ROWID);
        }
      }
    }

    // Process Chapters
    const existingChapterMap = await fetchExistingMap(zcql, env.TABLE_LEGAL_CHAPTERS, ["act_id", "chapter_name", "chapter_number"]);
    const chapterMap = new Map();
    const chaptersToInsert = [];

    for (const row of chapters) {
      const sourceActId = String(row.act_id || "").trim();
      const actRowId = actIdMap.get(sourceActId);
      if (!actRowId) {
        logger.warn("Skipping chapter because referenced act_id not found", row);
        continue;
      }
      
      const key = [actRowId, String(row.chapter_name || "").trim(), String(row.chapter_number || "").trim()].join("|~|");
      if (existingChapterMap.has(key)) {
        chapterMap.set(key, existingChapterMap.get(key));
        continue;
      }
      
      chaptersToInsert.push({
        act_id: actRowId,
        chapter_name: row.chapter_name || null,
        chapter_number: row.chapter_number || null,
      });
    }

    // Batch Insert Chapters
    logger.info(`Starting batch insert for ${chaptersToInsert.length} chapters...`);
    for (let idx = 0; idx < chaptersToInsert.length; idx += 200) {
      const chunk = chaptersToInsert.slice(idx, idx + 200);
      logger.info(`Inserting chapters ${idx} to ${idx + chunk.length} of ${chaptersToInsert.length}...`);
      const savedChunk = await chaptersTable.insertRows(chunk);
      for (const saved of savedChunk) {
        const row = saved[env.TABLE_LEGAL_CHAPTERS] || saved;
        const key = [row.act_id, String(row.chapter_name || "").trim(), String(row.chapter_number || "").trim()].join("|~|");
        if (row.ROWID) {
          chapterMap.set(key, row.ROWID);
        }
      }
    }

    // Process Sections
    const sectionRows = [];
    for (const row of sections) {
      const sourceActId = String(row.act_id || "").trim();
      const actRowId = actIdMap.get(sourceActId);
      if (!actRowId) {
        // Suppressed detailed log for sections to prevent log bloat
        continue;
      }
      const chapterKey = [actRowId, String(row.chapter_name || "").trim(), String(row.chapter_number || "").trim()].join("|~|");
      const chapterRowId = chapterMap.get(chapterKey);
      if (!chapterRowId) {
        continue;
      }
      sectionRows.push({
        act_id: actRowId,
        chapter_id: chapterRowId,
        section_number: row.section_number || null,
        section_title: row.section_title || null,
        section_text: row.section_text || null,
      });
    }

    await insertRowsInBatches(sectionsTable, sectionRows);
    
    return {
      acts: actIdMap.size,
      chapters: chapterMap.size,
      sections: sectionRows.length,
    };
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

    // Pre-fetch maps to avoid multiple db calls
    const rankMap = new Map();
    const stationMap = new Map();
    let officerRoleId = null;
    if (zcql) {
      try {
        const rankRows = await zcql.executeZCQLQuery(
          `SELECT ROWID, rank_name FROM ${env.TABLE_POLICE_RANK}`,
        );
        for (const row of rankRows) {
          const r = row[env.TABLE_POLICE_RANK] || row;
          if (r && r.rank_name && r.ROWID)
            rankMap.set(r.rank_name.toLowerCase(), r.ROWID);
        }
        const stationRows = await zcql.executeZCQLQuery(
          `SELECT ROWID, station_name FROM ${env.TABLE_POLICE_STATION}`,
        );
        for (const row of stationRows) {
          const s = row[env.TABLE_POLICE_STATION] || row;
          if (s && s.station_name && s.ROWID)
            stationMap.set(s.station_name.toLowerCase(), s.ROWID);
        }
        // Pre-fetch CASE_OFFICER role ID
        const officerRoleName = (env.DEFAULT_OFFICER_ROLE || "CASE_OFFICER").toLowerCase();
        const roleRows = await zcql.executeZCQLQuery(
          `SELECT ROWID, role_name FROM ${env.TABLE_ROLE}`,
        );
        for (const row of roleRows) {
          const role = row[env.TABLE_ROLE] || row;
          if (role && role.role_name && role.role_name.toLowerCase() === officerRoleName) {
            officerRoleId = role.ROWID;
          }
        }
        logger.info("Officer bootstrap maps loaded", {
          ranks: rankMap.size,
          stations: stationMap.size,
          officerRoleId,
        });
      } catch (err) {
        logger.warn(
          "failed to bulk load maps for officer bootstrap",
          err && err.message ? err.message : String(err),
        );
      }
    }

    // Pre-fetch existing badges (dedup) and existing user emails (userInfo lookup)
    const existingBadges = new Set();
    const existingEmailToUserInfoId = new Map(); // email → sys_user_info ROWID
    const existingUserInfoToSysUserId = new Map(); // user_info_id → sys_user ROWID
    if (zcql) {
      try {
        const badgeRows = await zcql.executeZCQLQuery(
          `SELECT badge_number FROM ${env.TABLE_POLICE_OFFICER}`,
        );
        for (const row of badgeRows) {
          const b = row[env.TABLE_POLICE_OFFICER] || row;
          if (b && b.badge_number) existingBadges.add(b.badge_number);
        }
        const infoRows = await zcql.executeZCQLQuery(
          `SELECT ROWID, email FROM ${env.TABLE_USER_INFO}`,
        );
        for (const row of infoRows) {
          const info = row[env.TABLE_USER_INFO] || row;
          if (info && info.email && info.ROWID)
            existingEmailToUserInfoId.set(info.email.toLowerCase(), info.ROWID);
        }
        const sysUserRows = await zcql.executeZCQLQuery(
          `SELECT ROWID, user_info_id FROM ${env.TABLE_USER}`,
        );
        for (const row of sysUserRows) {
          const u = row[env.TABLE_USER] || row;
          if (u && u.user_info_id && u.ROWID)
            existingUserInfoToSysUserId.set(String(u.user_info_id), u.ROWID);
        }
        logger.info("Officer bootstrap dedup maps loaded", {
          existingBadges: existingBadges.size,
          existingEmails: existingEmailToUserInfoId.size,
          existingSysUsers: existingUserInfoToSysUserId.size,
        });
      } catch (err) {
        logger.warn(
          "failed to load dedup maps for officer bootstrap",
          err && err.message ? err.message : String(err),
        );
      }
    }

    for (const e of entries) {
      try {
        // Resolve rank_id from map
        let rank_id = e.rank_id || null;
        const rankName = (e.rank_name || "").trim().toLowerCase();
        if (!rank_id && rankName && rankMap.has(rankName)) {
          rank_id = rankMap.get(rankName);
        }

        // Resolve station_id from map
        let station_id = e.station_id || null;
        const stationName = (e.station_name || "").trim().toLowerCase();
        if (!station_id && stationName && stationMap.has(stationName)) {
          station_id = stationMap.get(stationName);
        }

        // Skip if station is mandatory but could not be resolved
        if (!station_id && stationName) {
          skipped++;
          logger.warn("skipping officer: station not found in DB", {
            badge: e.badge_number,
            station_name: e.station_name,
          });
          continue;
        }

        const badge = e.badge_number || e.badge || e.badgeNo || null;

        // Skip duplicate badges using pre-fetched set
        if (badge && existingBadges.has(badge)) {
          skipped++;
          logger.warn("skipping officer: badge already exists", { badge });
          continue;
        }

        const officerId =
          e.user_id && e.user_id.match(/\d+/)
            ? parseInt(e.user_id.match(/\d+/)[0], 10)
            : null;

        const officerEmail = (
          (officerId && emailMap[officerId]) ||
          e.email ||
          `${badge}@police.local`
        ).trim().toLowerCase();

        const officerName =
          (officerId && fullNameMap[officerId]) ||
          e.name ||
          e.full_name ||
          `${e.first_name || ""} ${e.last_name || ""}`.trim();

        const nameParts = officerName.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Resolve or reuse sys_user_info (skip DB query using map)
        let userInfoId = existingEmailToUserInfoId.get(officerEmail) || null;
        if (!userInfoId) {
          const infoTable = req.catalyst.datastore().table(env.TABLE_USER_INFO);
          const savedInfo = await infoTable.insertRow({
            user_first_name: firstName,
            user_last_name: lastName,
            email: officerEmail,
            phone: e.contact_number || e.phone || null,
            isOfficer: true,
            badge_number: badge,
            rank_id: rank_id || null,
            station_id: station_id || null,
            date_of_joining: e.date_of_joining || null,
            operational_status: e.operational_status || "ACTIVE",
          });
          userInfoId = savedInfo.ROWID;
          existingEmailToUserInfoId.set(officerEmail, userInfoId);
        }

        // Resolve or reuse sys_user (skip DB query using map)
        let sysUserId = existingUserInfoToSysUserId.get(String(userInfoId)) || null;
        if (!sysUserId) {
          const userTable = req.catalyst.datastore().table(env.TABLE_USER);
          const savedUser = await userTable.insertRow({
            user_info_id: userInfoId,
            is_archived: false,
          });
          sysUserId = savedUser.ROWID;
          existingUserInfoToSysUserId.set(String(userInfoId), sysUserId);

          // Assign CASE_OFFICER role
          if (officerRoleId) {
            const urTable = req.catalyst.datastore().table(env.TABLE_USER_ROLE);
            await urTable.insertRow({ user_id: sysUserId, role_id: officerRoleId });
          } else {
            logger.warn("CASE_OFFICER role not found — sys_user_role skipped", { sysUserId });
          }
        }

        // Insert biz_police_officer record
        const officerTable = req.catalyst.datastore().table(env.TABLE_POLICE_OFFICER);
        await officerTable.insertRow({
          user_id: sysUserId,
          badge_number: badge,
          rank_id: rank_id || null,
          station_id: station_id || null,
          date_of_joining: e.date_of_joining || null,
          operational_status: e.operational_status || "ACTIVE",
          contact_number: e.contact_number || e.phone || null,
        });
        existingBadges.add(badge);
        created++;

        // Store password in sys_password
        try {
          const defaultPassword = "Police@123";
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);
          const passTable = req.catalyst.datastore().table("sys_password");
          await passTable.insertRow({ user_id: sysUserId, password: hashedPassword });
          createdAuth++;
          logger.info("Created local auth for officer", {
            badge,
            email: officerEmail,
          });
        } catch (err) {
          logger.warn("Failed to create local auth for officer", {
            badge,
            email: officerEmail,
            error: err && err.message ? err.message : String(err),
          });
        }
      } catch (err) {
        skipped++;
        const _officerId =
          e.user_id && e.user_id.match(/\d+/)
            ? parseInt(e.user_id.match(/\d+/)[0], 10)
            : null;
        const _resolvedName =
          (_officerId && fullNameMap[_officerId]) ||
          e.name ||
          e.full_name ||
          "unknown";
        logger.warn("skipping officer insert", {
          badge: e.badge_number || e.user_id || "unknown",
          name: _resolvedName,
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
    const table = req.catalyst.datastore().table(env.TABLE_CRIMINAL);
    const biometricsTable = req.catalyst
      .datastore()
      .table(env.TABLE_CRIMINAL_BIOMETRICS);

    // Pre-fetch districts map
    const districtMap = new Map();
    if (zcql) {
      try {
        const rows = await zcql.executeZCQLQuery(
          `SELECT ROWID, district_code FROM ${env.TABLE_DISTRICT_GEODATA}`,
        );
        for (const row of rows) {
          const d = row[env.TABLE_DISTRICT_GEODATA];
          if (d && d.district_code && d.ROWID) {
            districtMap.set(d.district_code.replace(/_/g, "-"), d.ROWID);
          }
        }
      } catch (err) {
        logger.warn(
          "failed to bulk load districts for criminal bootstrap",
          err && err.message ? err.message : String(err),
        );
      }
    }

    let faceImagePaths = [];
    try {
      const allFaceObjects = await StorageService.listBucketObjectKeys(
        req,
        `${storageConstants.PREFIX_MAP.face}/`,
      );
      faceImagePaths = allFaceObjects
        .filter((key) => /\.(jpe?g|png|tiff?)$/i.test(key))
        .sort((a, b) => a.localeCompare(b));

      if (faceImagePaths.length === 0) {
        logger.warn(
          "No face images found in storage bucket for criminal bootstrap",
        );
      }
    } catch (err) {
      logger.warn(
        "Failed to fetch face images from storage for criminal bootstrap",
        {
          error: err && err.message ? err.message : String(err),
        },
      );
      faceImagePaths = [];
    }

    if (faceImagePaths.length && faceImagePaths.length < entries.length) {
      logger.warn("Insufficient face images for criminal bootstrap", {
        availableFaceImages: faceImagePaths.length,
        criminalsToInsert: entries.length,
      });
    }

    // Also fetch fingerprint and footprints
    let fingerprintPaths = [];
    let footprintPaths = [];
    try {
      const allFp = await StorageService.listBucketObjectKeys(
        req,
        `${storageConstants.PREFIX_MAP.fingerprint}/`,
      );
      fingerprintPaths = allFp
        .filter((key) => /\.(jpe?g|png|tiff?)$/i.test(key))
        .sort((a, b) => a.localeCompare(b));
    } catch (err) {
      logger.warn("Failed to fetch fingerprint images from storage", {
        error: err && err.message ? err.message : String(err),
      });
      fingerprintPaths = [];
    }

    try {
      const allFp2 = await StorageService.listBucketObjectKeys(
        req,
        `${storageConstants.PREFIX_MAP.footprints}/`,
      );
      footprintPaths = allFp2
        .filter((key) => /\.(jpe?g|png|tiff?)$/i.test(key))
        .sort((a, b) => a.localeCompare(b));
    } catch (err) {
      logger.warn("Failed to fetch footprint images from storage", {
        error: err && err.message ? err.message : String(err),
      });
      footprintPaths = [];
    }

    // Group fingerprint images by inferred group id from filename (e.g. "1_1_1" in filename)
    const fingerprintGroupMap = new Map();
    for (const key of fingerprintPaths) {
      const base = key.split("/").pop() || key;
      const m = base.match(/(\d+(?:_\d+)+)/);
      const gid = m ? m[1] : base; // fallback to full basename if no numeric group
      if (!fingerprintGroupMap.has(gid)) fingerprintGroupMap.set(gid, []);
      fingerprintGroupMap.get(gid).push(key);
    }
    const fingerprintGroups = Array.from(fingerprintGroupMap.entries()).map(
      ([k, v]) => ({ id: k, files: v }),
    );

    const rowsToInsert = [];
    const biometricsToInsert = [];
    const criminalMap = {}; // Track inserted criminals: criminal_number -> ROWID
    let faceIndex = 0;
    let fpGroupIndex = 0;
    let footprintIndex = 0;
    let fileUpdatesMade = false;

    for (const e of entries) {
      let district_id = null;
      const code = (
        e.district_code_of_criminal ||
        e.district_code ||
        ""
      ).replace(/_/g, "-");

      if (code && districtMap.has(code)) {
        district_id = districtMap.get(code);
      } else if (code) {
        logger.warn("district lookup failed for criminal", { code });
      }

      const assignedPhotoUrl = faceImagePaths[faceIndex] || e.photo_url || null;
      if (faceIndex < faceImagePaths.length) {
        faceIndex += 1;
      }

      // fingerprint group assign
      let assignedFingerprint = null;
      if (
        fingerprintGroups &&
        fingerprintGroups.length > 0 &&
        fpGroupIndex < fingerprintGroups.length
      ) {
        assignedFingerprint = fingerprintGroups[fpGroupIndex].files.slice();
        fpGroupIndex += 1;
      }

      // footprint assign (single per criminal)
      const assignedFootprint =
        footprintPaths[footprintIndex] || e.footprint_url || null;
      if (footprintIndex < footprintPaths.length) footprintIndex += 1;

      const criminalNumber = e.criminal_number || null;

      rowsToInsert.push({
        criminal_number: criminalNumber,
        full_name: e.full_name || e.name || null,
        gender: e.gender || null,
        date_of_birth: e.date_of_birth || null,
        nationality: e.nationality || null,
        status: e.status || "ACTIVE",
        address: e.address || null,
        district_id_of_criminal: district_id,
      });

      // Store biometrics data separately (will be linked after criminal is created)
      biometricsToInsert.push({
        criminal_number: criminalNumber,
        photo_url: assignedPhotoUrl,
        fingerprint_url: assignedFingerprint
          ? JSON.stringify(assignedFingerprint)
          : e.fingerprint_url || null,
        footprint_url: assignedFootprint,
      });

      // Update source JSON entries
      try {
        if (assignedPhotoUrl && !e.face_url) {
          e.face_url = assignedPhotoUrl;
          fileUpdatesMade = true;
        }
        if (assignedFingerprint && !e.fingerprint_url) {
          e.fingerprint_url = assignedFingerprint;
          fileUpdatesMade = true;
        }
        if (assignedFootprint && !e.footprint_url) {
          e.footprint_url = assignedFootprint;
          fileUpdatesMade = true;
        }
      } catch (err) {
        // ignore
      }
    }

    // 1. Insert criminals and track successfully inserted ones
    if (rowsToInsert.length > 0 && table) {
      const BATCH_SIZE = 200;
      const insertedCriminalNumbers = [];
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
        try {
          const result = await table.insertRows(chunk);
          created += chunk.length;
          // Track inserted criminal numbers
          for (const row of chunk) {
            if (row.criminal_number) {
              insertedCriminalNumbers.push(row.criminal_number);
            }
          }
        } catch (err) {
          const errorMessage = err && err.message ? err.message : String(err);
          logger.warn("failed to bulk insert criminals", {
            batchStart: i + 1,
            batchSize: chunk.length,
            error: errorMessage,
            errorObject: err,
          });

          for (let j = 0; j < chunk.length; j += 1) {
            const row = chunk[j];
            try {
              await table.insertRow(row);
              created += 1;
              if (row.criminal_number) {
                insertedCriminalNumbers.push(row.criminal_number);
              }
            } catch (singleErr) {
              skipped += 1;
              logger.warn("failed to insert single criminal row", {
                rowIndex: i + j + 1,
                row,
                error:
                  singleErr && singleErr.message
                    ? singleErr.message
                    : String(singleErr),
                errorObject: singleErr,
              });
            }
          }
        }
      }

      // 2. Fetch created criminals and link biometrics (only for successfully inserted criminals)
      if (
        insertedCriminalNumbers.length > 0 &&
        biometricsToInsert.length > 0 &&
        biometricsTable &&
        zcql
      ) {
        try {
          logger.info(
            `Starting biometrics linking. Inserted criminal count: ${insertedCriminalNumbers.length}`,
          );

          // Fetch only the inserted criminal IDs - use smaller chunks to avoid query size limits
          const criminalNumberChunks = [];
          const CHUNK_SIZE = 100; // Fetch in smaller chunks to avoid hitting query limits
          for (let c = 0; c < insertedCriminalNumbers.length; c += CHUNK_SIZE) {
            criminalNumberChunks.push(
              insertedCriminalNumbers.slice(c, c + CHUNK_SIZE),
            );
          }

          logger.info(
            `Splitting ${insertedCriminalNumbers.length} criminals into ${criminalNumberChunks.length} query chunks of max ${CHUNK_SIZE}`,
          );

          let totalFetched = 0;
          for (
            let chunkIdx = 0;
            chunkIdx < criminalNumberChunks.length;
            chunkIdx++
          ) {
            const cnChunk = criminalNumberChunks[chunkIdx];
            const placeholders = cnChunk
              .map((cn) => `'${cn.replace(/'/g, "''")}'`)
              .join(",");

            logger.debug(
              `Chunk ${chunkIdx + 1}/${criminalNumberChunks.length}: Querying for ${cnChunk.length} criminals`,
            );

            try {
              const criminalRows = await zcql.executeZCQLQuery(
                `SELECT ROWID, criminal_number FROM ${env.TABLE_CRIMINAL} WHERE criminal_number IN (${placeholders})`,
              );

              logger.info(
                `Chunk ${chunkIdx + 1}: Query returned ${criminalRows.length} records (expected ${cnChunk.length})`,
              );

              if (criminalRows.length === 0) {
                logger.warn(
                  `Chunk ${chunkIdx + 1}: Query returned 0 results for criminal numbers starting with ${cnChunk[0]}`,
                );
              }

              totalFetched += criminalRows.length;
              for (const r of criminalRows) {
                const rec = r[env.TABLE_CRIMINAL] || r;
                if (rec && rec.criminal_number && rec.ROWID) {
                  criminalMap[rec.criminal_number] = rec.ROWID;
                }
              }
            } catch (queryErr) {
              logger.error(
                `Chunk ${chunkIdx + 1}: Query failed. Error: ${queryErr.message}`,
              );
            }
          }

          logger.info(
            `Total criminals fetched from DB: ${totalFetched}. Mapped: ${Object.keys(criminalMap).length} out of ${insertedCriminalNumbers.length}`,
          );

          if (Object.keys(criminalMap).length === 0) {
            logger.error(
              "CRITICAL: No criminals were found! Checking database state...",
            );
            try {
              const allCount = await zcql.executeZCQLQuery(
                `SELECT COUNT(ROWID) as cnt FROM ${env.TABLE_CRIMINAL}`,
              );
              logger.error(`Total in DB: ${JSON.stringify(allCount)}`);

              const samples = await zcql.executeZCQLQuery(
                `SELECT criminal_number FROM ${env.TABLE_CRIMINAL} LIMIT 3`,
              );
              logger.error(`Sample DB records: ${JSON.stringify(samples)}`);
            } catch (e) {
              logger.error(`DB check failed: ${e.message}`);
            }
          }

          // Prepare biometrics rows with criminal_id (only for successfully inserted criminals)
          const biometricsRowsToInsert = [];
          let unmappedBiometrics = 0;

          for (const bio of biometricsToInsert) {
            const criminalId = criminalMap[bio.criminal_number];
            if (criminalId) {
              biometricsRowsToInsert.push({
                criminal_id: criminalId,
                photo_url: bio.photo_url,
                fingerprint_url: bio.fingerprint_url,
                footprint_url: bio.footprint_url,
              });
            } else {
              unmappedBiometrics++;
              logger.debug(
                `Skipping biometrics for unmapped criminal: ${bio.criminal_number}`,
              );
            }
          }

          logger.info(
            `Prepared ${biometricsRowsToInsert.length} biometrics records for insert. Unmapped: ${unmappedBiometrics}`,
          );

          // Insert biometrics in batches
          if (biometricsRowsToInsert.length > 0) {
            const BATCH_SIZE = 200;
            let biometricsCreated = 0;
            let biometricsSkipped = 0;

            for (
              let i = 0;
              i < biometricsRowsToInsert.length;
              i += BATCH_SIZE
            ) {
              const chunk = biometricsRowsToInsert.slice(i, i + BATCH_SIZE);
              try {
                logger.debug(
                  `Attempting batch insert for biometrics ${i + 1}-${i + chunk.length}. Sample row: ${JSON.stringify(chunk[0])}`,
                );

                await biometricsTable.insertRows(chunk);
                biometricsCreated += chunk.length;

                logger.info(
                  `Inserted ${chunk.length} criminal biometrics (${i + chunk.length}/${biometricsRowsToInsert.length})`,
                );
              } catch (err) {
                logger.warn(
                  `Failed to bulk insert biometrics batch ${i + 1}-${i + chunk.length}, falling back to single inserts...`,
                  {
                    error: err.message || err,
                    errorCode: err.code,
                    statusCode: err.statusCode,
                  },
                );

                for (const bio of chunk) {
                  try {
                    logger.debug(
                      `Attempting single insert for criminal_id: ${bio.criminal_id}`,
                    );

                    await biometricsTable.insertRow(bio);
                    biometricsCreated++;
                  } catch (singleErr) {
                    biometricsSkipped++;
                    logger.error("Failed to insert single biometric row", {
                      bio,
                      criminal_id: bio.criminal_id,
                      error: singleErr.message || singleErr,
                      errorCode: singleErr.code,
                      statusCode: singleErr.statusCode,
                      fullError: singleErr,
                    });
                  }
                }
              }
            }

            logger.info(
              `Biometrics insertion complete. Created: ${biometricsCreated}, Skipped: ${biometricsSkipped}`,
            );
          } else {
            logger.warn(
              `No biometrics rows to insert after mapping. All ${biometricsToInsert.length} biometrics failed to map to criminals`,
            );
          }
        } catch (err) {
          logger.error("Failed to insert criminal biometrics", {
            error: err && err.message ? err.message : err,
            errorCode: err.code,
            statusCode: err.statusCode,
            stack: err.stack,
          });
        }
      }
    }

    // Persist the updated criminal.json with assigned urls if we modified entries
    if (fileUpdatesMade) {
      try {
        await fs.writeFile(filePath, JSON.stringify(entries, null, 2), "utf8");
        logger.info(
          "Updated criminal.json with assigned face/fingerprint/footprint urls.",
        );
      } catch (err) {
        logger.warn(
          "Failed to write updated criminal.json",
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

    // 5. Lazy FIR cache
    const firsCache = {};
    const getFirId = async (firNumber) => {
      if (!firNumber) return null;
      const key = firNumber.trim().toLowerCase();
      if (firsCache[key] !== undefined) {
        logger.debug && logger.debug(`FIR cache hit for ${firNumber}`);
        return firsCache[key];
      }
      return null;
    };

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
        const crimeNumber = (e.crimeNo || e.crime_number || "").trim();
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

        const fir_id = await getFirId(e.fir_number);

        const row = {
          crime_number: (e.crimeNo || e.crime_number || "").trim() || null,
          case_number: (e.caseNo || e.case_number || "").trim() || null,
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

    // 1️⃣ Cache crime incidents (crime_number → ROWID) - Limit to 1000 to save time (we don't need all 40k)
    const crimeMap = {};
    const validCrimes = [];
    try {
      let offset = 0;
      const limit = 200;
      while (validCrimes.length < 1000) {
        const crimeRows = await zcql.executeZCQLQuery(
          `SELECT ROWID, crime_number FROM ${env.TABLE_CRIME_INCIDENT} LIMIT ${limit} OFFSET ${offset}`,
        );
        if (!crimeRows || crimeRows.length === 0) break;
        for (const r of crimeRows) {
          const rec = r[env.TABLE_CRIME_INCIDENT] || r;
          if (rec && rec.crime_number) {
            crimeMap[rec.crime_number.trim().toLowerCase()] = rec.ROWID;
            validCrimes.push(rec.crime_number);
          }
        }
        if (crimeRows.length < limit) break;
        offset += limit;
      }
    } catch (e) {
      logger.warn("Failed to cache crime incidents", e);
    }

    // 2️⃣ Cache criminals (criminal_number → ROWID) - Fetch ALL
    const criminalMap = {};
    const validCriminals = [];
    try {
      let offset = 0;
      const limit = 200;
      while (true) {
        const crimRows = await zcql.executeZCQLQuery(
          `SELECT ROWID, criminal_number FROM ${env.TABLE_CRIMINAL} LIMIT ${limit} OFFSET ${offset}`,
        );
        if (!crimRows || crimRows.length === 0) break;
        for (const r of crimRows) {
          const rec = r[env.TABLE_CRIMINAL] || r;
          if (rec && rec.criminal_number) {
            criminalMap[rec.criminal_number.trim().toLowerCase()] = rec.ROWID;
            validCriminals.push(rec.criminal_number);
          }
        }
        if (crimRows.length < limit) break;
        offset += limit;
      }
    } catch (e) {
      logger.warn("Failed to cache criminals", e);
    }

    // Replace invalid crimes and criminals with valid ones
    let fileUpdated = false;
    if (validCrimes.length > 0 && validCriminals.length > 0) {
      const shuffledCrimes = [...validCrimes];
      const shuffledCriminals = [...validCriminals];
      
      for (let i = shuffledCrimes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledCrimes[i], shuffledCrimes[j]] = [shuffledCrimes[j], shuffledCrimes[i]];
      }
      for (let i = shuffledCriminals.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledCriminals[i], shuffledCriminals[j]] = [shuffledCriminals[j], shuffledCriminals[i]];
      }
      let crimeIndex = 0;
      const unusedCriminals = new Set(validCriminals);

      for (const e of entries) {
        // Fix invalid crimes
        const crimeKey = (e.crime_number || "").trim().toLowerCase();
        if (!crimeMap[crimeKey]) {
          e.crime_number = shuffledCrimes[crimeIndex % shuffledCrimes.length];
          crimeIndex++;
          fileUpdated = true;
        }

        // Guarantee all criminals get used exactly once
        const crimKey = (e.criminal_number || "").trim().toLowerCase();
        let criminalToUse = e.criminal_number;
        const validMatch = Object.values(criminalMap).find(id => id === criminalMap[crimKey]);
        const originalValidName = validCriminals.find(c => c.toLowerCase() === crimKey);

        if (originalValidName && unusedCriminals.has(originalValidName)) {
          criminalToUse = originalValidName;
        } else if (unusedCriminals.size > 0) {
          criminalToUse = unusedCriminals.values().next().value;
          fileUpdated = true;
        }
        
        if (criminalToUse) {
          e.criminal_number = criminalToUse;
          unusedCriminals.delete(criminalToUse);
        }
      }
      
      if (fileUpdated) {
        await fs.writeFile(filePath, JSON.stringify(entries, null, 2), "utf8");
        logger.info("Updated incident_criminal.json with valid db references.");
      }
    }

    // 3️⃣ Fetch existing relationships in memory to avoid duplicate checking in the loop
    const existingRelations = new Set();
    const assignedCriminals = new Set();
    try {
      let offset = 0;
      const limit = 200;
      while (true) {
        const rows = await zcql.executeZCQLQuery(
          `SELECT incident_id, criminal_id FROM ${env.TABLE_INCIDENT_CRIMINAL} LIMIT ${limit} OFFSET ${offset}`,
        );
        if (!rows || rows.length === 0) break;
        for (const r of rows) {
          const rec = r[env.TABLE_INCIDENT_CRIMINAL] || r;
          if (rec.incident_id && rec.criminal_id) {
            existingRelations.add(`${rec.incident_id}-${rec.criminal_id}`);
            assignedCriminals.add(rec.criminal_id);
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

      if (assignedCriminals.has(criminalId)) {
        skipped++;
        continue;
      }

      if (existingRelations.has(`${crimeId}-${criminalId}`)) {
        skipped++;
        continue;
      }

      assignedCriminals.add(criminalId);

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

    // Persist incident_criminal.json if we updated crime or criminal numbers
    try {
      if (fileUpdated) {
        await fs.writeFile(filePath, JSON.stringify(entries, null, 2), "utf8");
        logger.info(
          "Updated incident_criminal.json.",
        );
      }
    } catch (err) {
      logger.warn(
        "Failed to write updated incident_criminal.json",
        err && err.message ? err.message : err,
      );
    }

    return { created, skipped };
  },

  async bootstrapCrimeEvidence(req) {
    logger.info("bootstrapCrimeEvidence");
    const zcql = req.catalyst ? req.catalyst.zcql() : null;
    if (!zcql) throw new Error("Catalyst not available");

    let othersPaths = [];
    try {
      const allOthers = await StorageService.listBucketObjectKeys(
        req,
        `${storageConstants.PREFIX_MAP["crime-evidence"]}/`,
      );
      othersPaths = allOthers
        .filter((k) => /\.(jpe?g|png|tiff?|pdf|mp4)$/i.test(k))
        .sort((a, b) => a.localeCompare(b));
    } catch (err) {
      logger.warn(
        "Failed to fetch files for evidence assignment",
        err && err.message ? err.message : err,
      );
      return { created: 0, skipped: 0, reason: "Failed to fetch files" };
    }

    if (othersPaths.length === 0) {
      logger.info("No evidence files found in storage to bootstrap.");
      return { created: 0, skipped: 0, reason: "No evidence files found" };
    }

    // Cache crime incidents
    const validCrimes = [];
    try {
      const crimeRows = await zcql.executeZCQLQuery(
        `SELECT ROWID FROM ${env.TABLE_CRIME_INCIDENT}`,
      );
      for (const r of crimeRows) {
        const rec = r[env.TABLE_CRIME_INCIDENT] || r;
        if (rec && rec.ROWID) {
          validCrimes.push(rec.ROWID);
        }
      }
    } catch (e) {
      logger.warn("Failed to cache crime incidents for evidence", e);
    }

    if (validCrimes.length === 0) {
      logger.info("No crime incidents found to attach evidence to.");
      return { created: 0, skipped: 0, reason: "No crime incidents found" };
    }

    const evidenceToInsert = [];
    
    // Assign evidence sequentially to incidents
    for (let i = 0; i < othersPaths.length; i++) {
      const assignedEvidence = othersPaths[i];
      const crimeId = validCrimes[i % validCrimes.length]; // cycle through incidents if fewer incidents than files
      const evidenceNumber = assignedEvidence.split("/").filter(Boolean).pop();

      evidenceToInsert.push({
        incident_id: crimeId,
        uploaded_by: null,
        file_url: assignedEvidence,
        description: null,
        evidence_number: evidenceNumber || `EVID-${crimeId}`,
      });
    }

    const evidenceTable = req.catalyst.datastore().table(env.TABLE_CRIME_EVIDENCE);
    const BATCH = 100;
    let evidenceCreated = 0;
    let evidenceSkipped = 0;

    for (let s = 0; s < evidenceToInsert.length; s += BATCH) {
      const chunk = evidenceToInsert.slice(s, s + BATCH);
      try {
        await evidenceTable.insertRows(chunk);
        evidenceCreated += chunk.length;
      } catch (err) {
        logger.warn(
          `Failed to batch insert evidence (${s}-${s + chunk.length}), falling back to single inserts`,
          err && err.message ? err.message : err,
        );
        for (const ev of chunk) {
          try {
            await evidenceTable.insertRow(ev);
            evidenceCreated++;
          } catch (singleErr) {
            evidenceSkipped++;
          }
        }
      }
    }

    logger.info(
      `Evidence insertion complete. Created: ${evidenceCreated}, Skipped: ${evidenceSkipped}`,
    );

    return { created: evidenceCreated, skipped: evidenceSkipped };
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

  async bootstrapSuspect(req) {
    logger.info("bootstrapSuspect");
    const filePath = path.join(__dirname, "data", "suspect", "suspect.json");
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");
    let created = 0, skipped = 0;
    const zcql = req.catalyst.zcql();

    for (const e of entries) {
      try {
        let district_id = null;
        if (e.district_code) {
          const dcode = e.district_code.replace(/_/g, "-");
          const rows = await zcql.executeZCQLQuery(
            `SELECT ROWID FROM ${env.TABLE_DISTRICT_GEODATA} WHERE district_code = '${dcode.replace(/'/g, "''")}' LIMIT 1`
          );
          if (rows && rows.length) {
            district_id = rows[0].ROWID || rows[0][env.TABLE_DISTRICT_GEODATA]?.ROWID;
          }
        }
        e.district_id_of_suspect = district_id;
        await suspectRepo.addSuspect(e, req);
        created++;
      } catch (err) {
        skipped++;
        logger.warn("failed to insert suspect", err && err.message ? err.message : err);
      }
    }
    return { created, skipped };
  },

  async bootstrapVictim(req) {
    logger.info("bootstrapVictim");
    const filePath = path.join(__dirname, "data", "victim", "victim.json");
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");
    let created = 0, skipped = 0;
    const zcql = req.catalyst.zcql();

    for (const e of entries) {
      try {
        let incident_id = null;
        if (e.crime_number) {
          const rows = await zcql.executeZCQLQuery(
            `SELECT ROWID FROM ${env.TABLE_CRIME_INCIDENT} WHERE crime_number = '${e.crime_number.replace(/'/g, "''")}' LIMIT 1`
          );
          if (rows && rows.length) {
            incident_id = rows[0].ROWID || rows[0][env.TABLE_CRIME_INCIDENT]?.ROWID;
          }
        }
        if (!incident_id) {
          skipped++;
          continue;
        }
        e.incident_id = incident_id;
        await victimRepo.addVictim(e, req);
        created++;
      } catch (err) {
        skipped++;
        logger.warn("failed to insert victim", err && err.message ? err.message : err);
      }
    }
    return { created, skipped };
  },

  async bootstrapWitness(req) {
    logger.info("bootstrapWitness");
    const filePath = path.join(__dirname, "data", "witness", "witness.json");
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");
    let created = 0, skipped = 0;
    const zcql = req.catalyst.zcql();

    for (const e of entries) {
      try {
        let incident_id = null;
        if (e.crime_number) {
          const rows = await zcql.executeZCQLQuery(
            `SELECT ROWID FROM ${env.TABLE_CRIME_INCIDENT} WHERE crime_number = '${e.crime_number.replace(/'/g, "''")}' LIMIT 1`
          );
          if (rows && rows.length) {
            incident_id = rows[0].ROWID || rows[0][env.TABLE_CRIME_INCIDENT]?.ROWID;
          }
        }
        if (!incident_id) {
          skipped++;
          continue;
        }
        e.incident_id = incident_id;
        await witnessRepo.addWitness(e, req);
        created++;
      } catch (err) {
        skipped++;
        logger.warn("failed to insert witness", err && err.message ? err.message : err);
      }
    }
    return { created, skipped };
  },

  async bootstrapIncidentOfficer(req) {
    logger.info("bootstrapIncidentOfficer");
    const filePath = path.join(__dirname, "data", "incident-officer", "incident_officer.json");
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw || "[]");
    let created = 0, skipped = 0;
    const zcql = req.catalyst.zcql();

    for (const e of entries) {
      try {
        let incident_id = null;
        let officer_id = null;
        
        if (e.crime_number) {
          const rows = await zcql.executeZCQLQuery(
            `SELECT ROWID FROM ${env.TABLE_CRIME_INCIDENT} WHERE crime_number = '${e.crime_number.replace(/'/g, "''")}' LIMIT 1`
          );
          if (rows && rows.length) {
            incident_id = rows[0].ROWID || rows[0][env.TABLE_CRIME_INCIDENT]?.ROWID;
          }
        }
        if (e.badge_number) {
          const rows = await zcql.executeZCQLQuery(
            `SELECT ROWID FROM ${env.TABLE_POLICE_OFFICER} WHERE badge_number = '${e.badge_number.replace(/'/g, "''")}' LIMIT 1`
          );
          if (rows && rows.length) {
            officer_id = rows[0].ROWID || rows[0][env.TABLE_POLICE_OFFICER]?.ROWID;
          }
        }

        if (!incident_id || !officer_id) {
          skipped++;
          continue;
        }
        
        await incidentOfficerRepo.assignOfficer({ incident_id, officer_id }, req);
        created++;
      } catch (err) {
        skipped++;
        logger.warn("failed to assign officer to incident", err && err.message ? err.message : err);
      }
    }
    return { created, skipped };
  }
};
