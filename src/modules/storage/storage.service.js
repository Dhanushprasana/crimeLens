"use strict";

const constants = require("./storage.constants");
const logger = require("../../config/logger");

class StorageService {
  static _buildObjectPath(entityType, entityId, filename) {
    if (!constants.ALLOWED_ENTITY_TYPES.includes(entityType)) {
      throw new Error(`Invalid entityType: ${entityType}`);
    }
    const prefix = constants.PREFIX_MAP[entityType];
    const cleanFileName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "");
    return `${prefix}/${entityId}/${cleanFileName}`;
  }

  /**
   * Uploads a file to Catalyst Stratus
   */
  static async uploadFile(req, file, entityType, entityId) {
    if (!entityId) {
      throw new Error("entityId is required");
    }

    const catalystApp = req.catalyst;
    const bucketName = constants.BUCKET_NAME;
    const objectPath = this._buildObjectPath(entityType, entityId, file.originalname);

    try {
      const bucket = catalystApp.stratus().bucket(bucketName);

      const uploadOptions = {
        contentType: file.mimetype || 'application/octet-stream',
        overwrite: true
      };

      await bucket.putObject(objectPath, file.buffer, uploadOptions);

      logger.info("File uploaded successfully to Stratus Storage", {
        path: objectPath,
        bucket: bucketName,
      });

      return objectPath;
    } catch (error) {
      logger.error("Failed to upload file to Stratus Storage", { error: error.message });
      throw new Error("Failed to upload file: " + error.message);
    }
  }

  /**
   * Downloads a file from Catalyst Stratus
   */
  static async downloadFile(req, entityType, entityId, filename) {
    const catalystApp = req.catalyst;
    const bucketName = constants.BUCKET_NAME;
    const objectPath = this._buildObjectPath(entityType, entityId, filename);

    try {
      const bucket = catalystApp.stratus().bucket(bucketName);
      
      const stream = await bucket.getObject(objectPath);
      
      // Convert Readable stream to Buffer
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      logger.error("Failed to download file from Stratus Storage", { path: objectPath, error: error.message });
      throw new Error("Failed to download file: " + error.message);
    }
  }

  /**
   * Deletes a file from Catalyst Stratus
   */
  static async deleteFile(req, entityType, entityId, filename) {
    const catalystApp = req.catalyst;
    const bucketName = constants.BUCKET_NAME;
    const objectPath = this._buildObjectPath(entityType, entityId, filename);

    try {
      const bucket = catalystApp.stratus().bucket(bucketName);
      
      await bucket.deleteObject(objectPath);
      
      logger.info("File deleted successfully from Stratus Storage", { path: objectPath });
    } catch (error) {
      logger.error("Failed to delete file from Stratus Storage", { path: objectPath, error: error.message });
      throw new Error("Failed to delete file: " + error.message);
    }
  }

  /**
   * Bootstraps images from the local storage-data directory to Catalyst Storage
   */
  static async bootstrapImages(req, type) {
    const fs = require("fs");
    const path = require("path");
    const util = require("util");
    const readdir = util.promisify(fs.readdir);
    const readFile = util.promisify(fs.readFile);

    const folderPath = path.join(__dirname, "storage-data", type);
    let files;
    try {
      files = await readdir(folderPath);
    } catch (error) {
      logger.error(`Failed to read bootstrap directory for ${type}`, { error: error.message });
      throw new Error(`Failed to read bootstrap directory for ${type}: ` + error.message);
    }

    const results = [];

    for (const fileName of files) {
      if (fileName.endsWith(".jpg") || fileName.endsWith(".png") || fileName.endsWith(".mp4") || fileName.endsWith(".pdf")) {
        const filePath = path.join(folderPath, fileName);
        const buffer = await readFile(filePath);

        // Mock a file object for the existing uploadFile method
        const fileObj = {
          originalname: fileName,
          buffer: buffer,
        };

        // Extract entityId from filename (e.g. "1_1_left_real_ZK9500.jpg" -> "1")
        // If not found or invalid, default to a generic name.
        let entityId = fileName.split("_")[0];
        if (!entityId || isNaN(entityId)) {
          entityId = "default";
        }

        try {
          const objectPath = await this.uploadFile(
            req,
            fileObj,
            type,
            entityId
          );
          const publicUrl = `${constants.STRATUS_BASE_URL}/${objectPath}`;
          results.push({ fileName, objectPath, publicUrl, status: "success" });
        } catch (error) {
          results.push({ fileName, error: error.message, status: "failed" });
        }
      }
    }

    return results;
  }
}

module.exports = StorageService;
