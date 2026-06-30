"use strict";

const constants = require("./storage.constants");
const logger = require("../../config/logger");

class StorageService {
  /**
   * Uploads a file to Catalyst Stratus (or Filestore)
   */
  static async uploadFile(req, file, entityType, entityId) {
    if (!constants.ALLOWED_ENTITY_TYPES.includes(entityType)) {
      throw new Error(`Invalid entityType: ${entityType}`);
    }
    if (!entityId) {
      throw new Error("entityId is required");
    }

    const catalystApp = req.catalyst;
    const bucketName = constants.BUCKET_NAME;
    const prefix = constants.PREFIX_MAP[entityType];

    // Clean original filename
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "");
    
    // Construct the object path
    const objectPath = `${prefix}/${entityId}/${cleanFileName}`;

    try {
      // Assuming standard Catalyst filestore SDK usage. 
      // If Catalyst Stratus has a specific SDK (e.g. catalystApp.stratus()), 
      // you may need to update this to match the exact SDK structure.
      const filestore = catalystApp.filestore();
      const folder = filestore.folder(bucketName);

      const uploadConfig = {
        code: file.buffer,
        name: objectPath
      };

      await folder.uploadFile(uploadConfig);

      logger.info("File uploaded successfully to Storage", {
        path: objectPath,
        bucket: bucketName,
      });

      return objectPath;
    } catch (error) {
      logger.error("Failed to upload file to Storage", { error: error.message });
      throw new Error("Failed to upload file: " + error.message);
    }
  }

  /**
   * Downloads a file from Catalyst Storage
   */
  static async downloadFile(req, objectPath) {
    const catalystApp = req.catalyst;
    const bucketName = constants.BUCKET_NAME;

    try {
      const filestore = catalystApp.filestore();
      const folder = filestore.folder(bucketName);
      
      const fileData = await folder.downloadFile(objectPath);
      
      return fileData; // Buffer
    } catch (error) {
      logger.error("Failed to download file from Storage", { path: objectPath, error: error.message });
      throw new Error("Failed to download file: " + error.message);
    }
  }

  /**
   * Deletes a file from Catalyst Storage
   */
  static async deleteFile(req, objectPath) {
    const catalystApp = req.catalyst;
    const bucketName = constants.BUCKET_NAME;

    try {
      const filestore = catalystApp.filestore();
      const folder = filestore.folder(bucketName);
      
      await folder.deleteFile(objectPath);
      
      logger.info("File deleted successfully from Storage", { path: objectPath });
    } catch (error) {
      logger.error("Failed to delete file from Storage", { path: objectPath, error: error.message });
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
          results.push({ fileName, objectPath, status: "success" });
        } catch (error) {
          results.push({ fileName, error: error.message, status: "failed" });
        }
      }
    }

    return results;
  }
}

module.exports = StorageService;
