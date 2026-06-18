"use strict";

const service = require("./police-station.service");
const sendResponse = require("../../../../common/response");

module.exports = {
  async addPoliceStation(req, res, next) {
    try {
      const result = await service.addPoliceStation(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllPoliceStation(req, res, next) {
    try {
      const result = await service.getAllPoliceStation(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getOnePoliceStation(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.getOnePoliceStation(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async updatePoliceStation(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.updatePoliceStation(id, req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async deletePoliceStation(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.deletePoliceStation(id, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async addStationType(req, res, next) {
    try {
      const result = await service.addStationType(req.body, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAllStationType(req, res, next) {
    try {
      const result = await service.getAllStationType(req.query, req);
      sendResponse(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  async deleteStationType(req, res, next) {
    try {
      const { id } = req.params;
      const result = await service.deleteStationType(id, req);
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
};
