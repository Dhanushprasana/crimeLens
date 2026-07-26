"use strict";

const service = require("./seed-data.service");
const sendResponse = require("../../common/response");

module.exports = {
  async bootstrapDistrictGeoJson(req, res, next) {
    try {
      const result = await service.bootstrapDistrictGeoJson(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async bootstrapPoliceRank(req, res, next) {
    try {
      const result = await service.bootstrapPoliceRank(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async bootstrapPoliceStations(req, res, next) {
    try {
      const result = await service.bootstrapPoliceStations(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async bootstrapCrimeCategory(req, res, next) {
    try {
      const result = await service.bootstrapCrimeCategory(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async bootstrapLegal(req, res, next) {
    try {
      const result = await service.bootstrapLegal(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async bootstrapPoliceOfficer(req, res, next) {
    try {
      const result = await service.bootstrapPoliceOfficer(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async bootstrapCriminal(req, res, next) {
    try {
      const result = await service.bootstrapCriminal(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async bootstrapFirs(req, res, next) {
    try {
      const result = await service.bootstrapFirs(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },
  async bootstrapCrimeIncidents(req, res, next) {
    try {
      const result = await service.bootstrapCrimeIncidents(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async bootstrapIncidentCriminals(req, res, next) {
    try {
      const result = await service.bootstrapIncidentCriminals(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async bootstrapCrimeEvidence(req, res, next) {
    try {
      const result = await service.bootstrapCrimeEvidence(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },


  async bootstrapSuspect(req, res, next) {
    try {
      const result = await service.bootstrapSuspect(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async bootstrapVictim(req, res, next) {
    try {
      const result = await service.bootstrapVictim(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async bootstrapWitness(req, res, next) {
    try {
      const result = await service.bootstrapWitness(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async bootstrapIncidentOfficer(req, res, next) {
    try {
      const result = await service.bootstrapIncidentOfficer(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  // Generate a crime incident using valid reference data
  async generateCrime(req, res, next) {
    try {
      const result = await service.generateCrime(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async dumpData(req, res, next) {
    try {
      const result = await service.dumpData(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async calculateDistrictCrimeStats(req, res, next) {
    try {
      const result = await service.calculateDistrictCrimeStats(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllTableCounts(req, res, next) {
    try {
      const result = await service.getAllTableCounts(req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

};
