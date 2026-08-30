'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  return req.catalyst.zcql().executeZCQLQuery(query);
}

function escapeValue(value) {
  return String(value).replace(/'/g, "''");
}

function unwrap(rows, tableName) {
  return (rows || []).map((row) => row[tableName] || row).filter(Boolean);
}

async function getById(req, tableName, id) {
  const rows = await executeQuery(
    req,
    `SELECT * FROM ${tableName} WHERE ROWID = '${escapeValue(id)}'`
  );
  return unwrap(rows, tableName)[0] || null;
}

async function getByField(req, tableName, fieldName, value) {
  const rows = await executeQuery(
    req,
    `SELECT * FROM ${tableName} WHERE ${fieldName} = '${escapeValue(value)}'`
  );
  return unwrap(rows, tableName);
}

async function getByIds(req, tableName, ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!uniqueIds.length) return [];

  const values = uniqueIds.map((id) => `'${escapeValue(id)}'`).join(',');
  const rows = await executeQuery(req, `SELECT * FROM ${tableName} WHERE ROWID IN (${values})`);
  return unwrap(rows, tableName);
}

function getEvidenceDownloadUrl(req, fileUrl) {
  if (!fileUrl) return null;
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;

  const [folder, fileName, ...remainingPath] = String(fileUrl)
    .replace(/^\/+/, '')
    .split('/');
  if (!folder || !fileName || remainingPath.length) return fileUrl;

  const host = req.get?.('host') || req.headers?.host;
  if (!host) return fileUrl;
  return `${req.protocol || 'https'}://${host}/storage/object/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`;
}

async function getOfficer(req, officerId) {
  const officer = await getById(req, env.TABLE_POLICE_OFFICER, officerId);
  if (!officer) return null;

  const user = officer.user_id ? await getById(req, env.TABLE_USER, officer.user_id) : null;
  const userInfo = user?.user_info_id
    ? await getById(req, env.TABLE_USER_INFO, user.user_info_id)
    : null;
  const rank = officer.rank_id ? await getById(req, env.TABLE_POLICE_RANK, officer.rank_id) : null;
  const station = officer.station_id
    ? await getById(req, env.TABLE_POLICE_STATION, officer.station_id)
    : null;
  const district = officer.district_id
    ? await getById(req, env.TABLE_DISTRICT_GEODATA, officer.district_id)
    : null;

  return {
    ...officer,
    full_name: [userInfo?.user_first_name, userInfo?.user_last_name].filter(Boolean).join(' ') || null,
    email: userInfo?.email || null,
    rank_name: rank?.rank_name || null,
    station_name: station?.station_name || null,
    district_name: district?.district_name || null
  };
}

async function getCrime(req, incidentId) {
  const incident = await getById(req, env.TABLE_CRIME_INCIDENT, incidentId);
  if (!incident) return null;

  const [category, station, district, fir, evidence, victims, witnesses, officerLinks, criminalLinks] = await Promise.all([
    incident.crime_category_id ? getById(req, env.TABLE_CRIME_CATEGORY, incident.crime_category_id) : null,
    incident.police_station_id ? getById(req, env.TABLE_POLICE_STATION, incident.police_station_id) : null,
    incident.crime_happended_at_district_id
      ? getById(req, env.TABLE_DISTRICT_GEODATA, incident.crime_happended_at_district_id)
      : null,
    incident.fir_id ? getById(req, env.TABLE_FIR, incident.fir_id) : null,
    getByField(req, env.TABLE_CRIME_EVIDENCE, 'incident_id', incidentId),
    getByField(req, env.TABLE_CASE_VICTIM, 'incident_id', incidentId),
    getByField(req, env.TABLE_CASE_WITNESS, 'incident_id', incidentId),
    getByField(req, env.TABLE_INCIDENT_OFFICER, 'incident_id', incidentId),
    getByField(req, env.TABLE_INCIDENT_CRIMINAL, 'incident_id', incidentId)
  ]);

  const [officers, criminals] = await Promise.all([
    Promise.all(officerLinks.map((link) => getOfficer(req, link.officer_id))).then((rows) => rows.filter(Boolean)),
    getByIds(req, env.TABLE_CRIMINAL, criminalLinks.map((link) => link.criminal_id))
  ]);
  const stationDistrict = station?.district_id
    ? await getById(req, env.TABLE_DISTRICT_GEODATA, station.district_id)
    : null;

  return {
    incident,
    category,
    station,
    district,
    stationDistrict,
    fir,
    evidence: evidence.map((item) => ({
      ...item,
      download_url: getEvidenceDownloadUrl(req, item.file_url)
    })),
    victims,
    witnesses,
    officers,
    criminals
  };
}

async function getCriminal(req, criminalId) {
  const criminal = await getById(req, env.TABLE_CRIMINAL, criminalId);
  if (!criminal) return null;

  const [district, biometrics, profile, aliases, phones, vehicles, behavioralFlags, incidentLinks] = await Promise.all([
    criminal.district_id_of_criminal
      ? getById(req, env.TABLE_DISTRICT_GEODATA, criminal.district_id_of_criminal)
      : null,
    getByField(req, env.TABLE_CRIMINAL_BIOMETRICS, 'criminal_id', criminalId),
    getByField(req, env.TABLE_CRIMINAL_PROFILE, 'criminal_id', criminalId).then((rows) => rows[0] || null),
    getByField(req, env.TABLE_CRIMINAL_ALIAS, 'criminal_id', criminalId),
    getByField(req, env.TABLE_CRIMINAL_PHONE, 'criminal_id', criminalId),
    getByField(req, env.TABLE_CRIMINAL_VEHICLE, 'criminal_id', criminalId),
    getByField(req, env.TABLE_BEHAVIORAL_FLAG, 'criminal_id', criminalId),
    getByField(req, env.TABLE_INCIDENT_CRIMINAL, 'criminal_id', criminalId)
  ]);

  const incidentIds = incidentLinks.map((link) => link.incident_id);
  const [incidents, riskFactors, associateLinks, primaryDistrict] = await Promise.all([
    getByIds(req, env.TABLE_CRIME_INCIDENT, incidentIds),
    profile ? getByField(req, env.TABLE_CRIMINAL_RISK_FACTOR, 'profile_id', profile.ROWID) : [],
    incidentIds.length
      ? executeQuery(
        req,
        `SELECT * FROM ${env.TABLE_INCIDENT_CRIMINAL} WHERE incident_id IN (${incidentIds
          .map((id) => `'${escapeValue(id)}'`)
          .join(',')}) AND criminal_id != '${escapeValue(criminalId)}'`
      ).then((rows) => unwrap(rows, env.TABLE_INCIDENT_CRIMINAL))
      : [],
    profile?.primary_district
      ? getById(req, env.TABLE_DISTRICT_GEODATA, profile.primary_district)
      : null
  ]);

  const [associates, categories] = await Promise.all([
    getByIds(
      req,
      env.TABLE_CRIMINAL,
      associateLinks.map((link) => link.criminal_id)
    ),
    getByIds(
      req,
      env.TABLE_CRIME_CATEGORY,
      incidents.map((incident) => incident.crime_category_id)
    )
  ]);
  const categoryNames = new Map(categories.map((category) => [category.ROWID, category.crime_category_name]));

  return {
    criminal,
    district,
    primaryDistrict,
    biometrics,
    profile,
    riskFactors,
    aliases,
    phones,
    vehicles,
    behavioralFlags,
    incidents: incidents.map((incident) => ({
      ...incident,
      crime_category_name: categoryNames.get(incident.crime_category_id) || null
    })),
    associates
  };
}

async function getOfficerReport(req, officerId) {
  const officer = await getOfficer(req, officerId);
  if (!officer) return null;

  const [incidentLinks, firs] = await Promise.all([
    getByField(req, env.TABLE_INCIDENT_OFFICER, 'officer_id', officerId),
    getByField(req, env.TABLE_FIR, 'assigned_officer_id', officerId)
  ]);
  const incidents = await getByIds(req, env.TABLE_CRIME_INCIDENT, incidentLinks.map((link) => link.incident_id));
  const categories = await getByIds(
    req,
    env.TABLE_CRIME_CATEGORY,
    incidents.map((incident) => incident.crime_category_id)
  );
  const categoryNames = new Map(categories.map((category) => [category.ROWID, category.crime_category_name]));

  return {
    officer,
    incidents: incidents.map((incident) => ({
      ...incident,
      crime_category_name: categoryNames.get(incident.crime_category_id) || null
    })),
    firs
  };
}

module.exports = {
  getCrime,
  getCriminal,
  getOfficerReport
};
