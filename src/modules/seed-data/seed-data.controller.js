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

};
