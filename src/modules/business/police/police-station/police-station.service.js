"use strict";

const repository = require("./police-station.repository");
const logger = require("../../../../config/logger");

module.exports = {
  async addPoliceStation(dto, req) {
    logger.info("addPoliceStation called");
    if (!dto || !dto.station_name) throw new Error("station_name is required");
    return repository.addPoliceStation(dto, req);
  },

  async getAllPoliceStation(query, req) {
    logger.info("getAllPoliceStation");
    return repository.getAllPoliceStation(query, req);
  },
  async getOnePoliceStation(id, req) {
    logger.info(`getOnePoliceStation ${id}`);
    return repository.getOnePoliceStation(id, req);
  },
  async updatePoliceStation(id, dto, req) {
    logger.info(`updatePoliceStation ${id}`);
    return repository.updatePoliceStation(id, dto, req);
  },
  async deletePoliceStation(id, req) {
    logger.info(`deletePoliceStation ${id}`);
    return repository.deletePoliceStation(id, req);
  },

  async addStationType(dto, req) {
    logger.info("addStationType");
    if (!dto || !dto.station_type_name)
      throw new Error("station_type_name required");
    return repository.addStationType(dto, req);
  },
  async getAllStationType(query, req) {
    logger.info("getAllStationType");
    return repository.getAllStationType(query, req);
  },
  async deleteStationType(id, req) {
    logger.info(`deleteStationType ${id}`);
    return repository.deleteStationType(id, req);
  },
  async bootstrapPoliceStations(req) {
    logger.info("bootstrapPoliceStations");
    return repository.bootstrapPoliceStations(req);
  },
};
