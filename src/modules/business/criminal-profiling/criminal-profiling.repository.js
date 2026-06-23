'use strict';

const env = require('../../../config/env');

async function executeQuery(req, query) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  const zcql = req.catalyst.zcql();
  return zcql.executeZCQLQuery(query);
}

function getTable(req, name) {
  if (!req.catalyst) throw new Error('Catalyst SDK not initialized');
  return req.catalyst.datastore().table(name);
}

module.exports = {
  

  async getProfileByCriminalId(criminalId, req) {

    const sql = `
      SELECT *
      FROM ${env.TABLE_CRIMINAL_PROFILE}
      WHERE criminal_id = '${criminalId}'
    `;

    const result = await executeQuery(req, sql);

    if (!result || result.length === 0) {
      return null;
    }

    return result[0][env.TABLE_CRIMINAL_PROFILE];
  },

  async getCriminal(criminalId, req) {
    const sql = `
      SELECT *
      FROM ${env.TABLE_CRIMINAL}
      WHERE ROWID = '${criminalId}'
    `;
    const result = await executeQuery(req, sql);

    if (!result || result.length === 0) {
      throw new Error('Criminal not found');
    }

    return result[0][env.TABLE_CRIMINAL];
  },

  async getCriminalIncidents(criminalId, req) {
    const sql = `
      SELECT *
      FROM ${env.TABLE_INCIDENT_CRIMINAL}
      WHERE criminal_id = '${criminalId}'
    `;

    const result = await executeQuery(req, sql);

    return result.map(
      row => row[env.TABLE_INCIDENT_CRIMINAL]
    );
  },

  async getIncidentDetails(incidentIds, req) {
    if (!incidentIds || incidentIds.length === 0) {
      return [];
    }

    const idList = incidentIds
      .map(id => `'${id}'`)
      .join(', ');

    const sql = `
      SELECT *
      FROM ${env.TABLE_CRIME_INCIDENT}
      WHERE ROWID IN (${idList})
    `;

    const result = await executeQuery(req, sql);

    return result.map(
      row => row[env.TABLE_CRIME_INCIDENT]
    );
  },

  async getDistrictById(districtId, req) {
    const sql = `
      SELECT *
      FROM ${env.TABLE_DISTRICT_GEODATA}
      WHERE ROWID = '${districtId}'
    `;

    const result = await executeQuery(req, sql);

    if (!result || result.length === 0) {
      return null;
    }

    return result[0][env.TABLE_DISTRICT_GEODATA];
  },

  async getAssociatedCriminals(incidentIds, criminalId, req) {
    if (!incidentIds || incidentIds.length === 0) {
      return [];
    }

    const idList = incidentIds
      .map(id => `'${id}'`)
      .join(', ');

    const sql = `
      SELECT *
      FROM ${env.TABLE_INCIDENT_CRIMINAL}
      WHERE incident_id IN (${idList})
        AND criminal_id != '${criminalId}'
    `;

    const result = await executeQuery(req, sql);

    const uniqueIds = [
      ...new Set(
        result.map(
          row => row[env.TABLE_INCIDENT_CRIMINAL].criminal_id
        )
      )
    ];

    return uniqueIds;
  },

  async getPhoneNumbers(criminalId, req) {
    const sql = `
      SELECT *
      FROM ${env.TABLE_CRIMINAL_PHONE}
      WHERE criminal_id = '${criminalId}'
    `;

    const result = await executeQuery(req, sql);

    return result.map(
      row => row[env.TABLE_CRIMINAL_PHONE]
    );
  },

  async getVehicles(criminalId, req) {
    const sql = `
      SELECT *
      FROM ${env.TABLE_CRIMINAL_VEHICLE}
      WHERE criminal_id = '${criminalId}'
    `;

    const result = await executeQuery(req, sql);

    return result.map(
      row => row[env.TABLE_CRIMINAL_VEHICLE]
    );
  },

  async getBehavioralFlags(criminalId, req) {
    const sql = `
      SELECT *
      FROM ${env.TABLE_BEHAVIORAL_FLAG}
      WHERE criminal_id = '${criminalId}'
    `;

    const result = await executeQuery(req, sql);

    return result.map(
      row => row[env.TABLE_BEHAVIORAL_FLAG]
    );
  },

  async getRiskFactors(profileId, req) {
    const sql = `
      SELECT *
      FROM ${env.TABLE_CRIMINAL_RISK_FACTOR}
      WHERE profile_id = '${profileId}'
    `;

    const result = await executeQuery(req, sql);

    return result.map(
      row => row[env.TABLE_CRIMINAL_RISK_FACTOR]
    );
  },

  async deleteRiskFactors(profileId, req) {
    const sql = `
      DELETE FROM ${env.TABLE_CRIMINAL_RISK_FACTOR}
      WHERE profile_id = '${profileId}'
    `;

    await executeQuery(req, sql);
  },

  async saveRiskFactors(profileId, factors, req) {
    const table = getTable(
      req,
      env.TABLE_CRIMINAL_RISK_FACTOR
    );

    const rows = factors.map(f => ({
      profile_id: profileId,
      factor_name: f.factor_name,
      factor_score: f.factor_score,
      factor_description: f.factor_description
    }));

    const saved = [];
    for (const row of rows) {
      const result = await table.insertRow(row);
      saved.push(result);
    }

    return saved;
  },

  async createProfile(data, req) {
    const table = getTable(req, env.TABLE_CRIMINAL_PROFILE);

    const saved = await table.insertRow(data);

    return {
      id: saved.ROWID
    };
  },

  async updateProfile(id, data, req) {
    const table = getTable(req, env.TABLE_CRIMINAL_PROFILE);

    await table.updateRow({
      ROWID: id,
      ...data
    });

    return {
      message: 'Profile updated'
    };
  }
};