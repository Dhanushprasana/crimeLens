'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

module.exports = {
  /**
   * Given an array of file_url paths, returns the crimes (ROWID + title)
   * each evidence belongs to.
   *
   * @param {string[]} paths  - Array of file_url values to look up
   * @param {object}   req    - Express request (carries the Catalyst SDK)
   * @returns {Array<{ path: string, crime: { ROWID: string, title: string } | null }>}
   */
  async getCrimesByEvidencePaths(paths, req) {
    // Build a safe IN-list by escaping single quotes in each path
    const inList = paths
      .map(p => `'${String(p).replace(/'/g, "''")}'`)
      .join(', ');

    // One query: join evidence → crime incident
    const sql =
      `SELECT ` +
        `${env.TABLE_CRIME_EVIDENCE}.file_url, ` +
        `${env.TABLE_CRIME_INCIDENT}.ROWID AS crime_id, ` +
        `${env.TABLE_CRIME_INCIDENT}.title ` +
      `FROM ${env.TABLE_CRIME_EVIDENCE} ` +
      `INNER JOIN ${env.TABLE_CRIME_INCIDENT} ` +
        `ON ${env.TABLE_CRIME_EVIDENCE}.incident_id = ${env.TABLE_CRIME_INCIDENT}.ROWID ` +
      `WHERE ${env.TABLE_CRIME_EVIDENCE}.file_url IN (${inList})`;

    const rows = await executeQuery(req, sql);

    // Build a lookup map: file_url → { ROWID, title }
    // A single path might appear more than once (multiple evidence rows for
    // different crimes), so we store an array per path.
    const map = new Map();
    for (const row of rows) {
      // ZCQL returns nested objects keyed by table name
      const ev     = row[env.TABLE_CRIME_EVIDENCE]     || {};
      const crime  = row[env.TABLE_CRIME_INCIDENT]     || {};

      // Fallback: some ZCQL versions may return a flat object
      const fileUrl  = ev.file_url  || row.file_url;
      const crimeId  = crime.ROWID  || crime.crime_id  || row.crime_id;
      const title    = crime.title  || row.title;

      if (!fileUrl) continue;

      if (!map.has(fileUrl)) map.set(fileUrl, []);
      if (crimeId) {
        map.get(fileUrl).push({ ROWID: String(crimeId), title: title || null });
      }
    }

    // Return results in the same order as the input paths
    return paths.map(path => ({
      path,
      crimes: map.get(path) || []   // empty array if no match
    }));
  }
};
