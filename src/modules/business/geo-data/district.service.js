"use strict";

const repository = require("./district.repository");
const logger = require("../../../config/logger");

module.exports = {
  async addDistrict(dto, req) {
    logger.info("addDistrict");
    if (!dto || !dto.district_name) throw new Error("district_name required");
    return repository.addDistrict(dto, req);
  },
  async getAllDistrict(query, req) {
    logger.info("getAllDistrict");
    return repository.getAllDistrict(query, req);
  },
  async getOneDistrict(id, req) {
    logger.info(`getOneDistrict ${id}`);
    return repository.getOneDistrict(id, req);
  },
  async deleteDistrict(id, req) {
    logger.info(`deleteDistrict ${id}`);
    return repository.deleteDistrict(id, req);
  },
  async addDistrictGeoJson(dto, req) {
    logger.info("addDistrictGeoJson");
    if (!dto || !dto.district_name || !dto.boundary)
      throw new Error("district_name and boundary required");
    return repository.addDistrictGeoJson(dto, req);
  },

  async getAllDistrictGeoJson(query, req) {
    logger.info("getAllDistrictGeoJson");
    return repository.getAllDistrictGeoJson(query, req);
  },

  async getOneDistrictGeoJson(id, req) {
    logger.info(`getOneDistrictGeoJson ${id}`);
    return repository.getOneDistrictGeoJson(id, req);
  },

  async deleteDistrictGeoJson(id, req) {
    logger.info(`deleteDistrictGeoJson ${id}`);
    return repository.deleteDistrictGeoJson(id, req);
  },

  async bootstrapDistrictGeoJson(req) {
    logger.info("bootstrapDistrictGeoJson");
    return repository.bootstrapDistrictGeoJson(req);
  },
};
