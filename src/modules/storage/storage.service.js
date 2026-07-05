"use strict";

const constants = require("./storage.constants");
const logger = require("../../config/logger");
const { Readable } = require("stream");

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

    // Construct the object path (including prefix folder)
    const objectPath = `${prefix}/${entityType}_${entityId}_${cleanFileName}`;

    try {
      // Use Stratus bucket API (not File Store)
      if (!catalystApp || typeof catalystApp.stratus !== "function") {
        const msg = "Catalyst Stratus API not available on req.catalyst";
        logger.error("Storage initialization error", {
          msg,
          hasCatalyst: !!catalystApp,
        });
        throw new Error(msg);
      }

      const stratus = catalystApp.stratus();
      const bucket = stratus.bucket(bucketName);

      if (!bucket || typeof bucket.putObject !== "function") {
        const msg =
          "Stratus bucket does not expose putObject(). Check Catalyst SDK version.";
        logger.error("Unexpected stratus API", { msg, bucketName, objectPath });
        throw new Error(msg);
      }

      // Prefer a readable stream for upload to match SDK docs
      const contentType = file.mimetype || "application/octet-stream";
      const stream = Readable.from(file.buffer);

      try {
        await bucket.putObject(objectPath, stream, {
          overwrite: true,
          contentType,
        });
      } catch (innerErr) {
        logger.error("Failed to perform bucket.putObject()", {
          bucket: bucketName,
          objectPath,
          fileSize: file && file.buffer ? file.buffer.length : 0,
          errorMessage: innerErr && innerErr.message,
          errorStack: innerErr && innerErr.stack,
        });
        throw innerErr;
      }

      logger.info("File uploaded successfully to Storage", {
        path: objectPath,
        bucket: bucketName,
      });

      return objectPath;
    } catch (error) {
      logger.error("Failed to upload file to Storage", {
        errorMessage: error && error.message,
        errorStack: error && error.stack,
      });
      throw new Error(
        "Failed to upload file: " +
          (error && error.message ? error.message : "unknown error"),
      );
    }
  }

  /**
   * Downloads a file from Catalyst Storage
   */
  static async downloadFile(req, folderName, fileName) {
    const catalystApp = req.catalyst;

    try {
      if (!catalystApp || typeof catalystApp.stratus !== "function") {
        throw new Error("Catalyst Stratus API not available on req.catalyst");
      }

      const stratus = catalystApp.stratus();
      const bucket = stratus.bucket(constants.BUCKET_NAME);
      const objectPath = `${folderName}/${fileName}`;

      const result = await bucket.getObject(objectPath);

      // result may be a Buffer or a stream
      if (result && typeof result.pipe === "function") {
        const chunks = [];
        for await (const chunk of result) chunks.push(chunk);
        return Buffer.concat(chunks);
      }

      return result;
    } catch (error) {
      logger.error("Failed to download file from Storage", {
        folder: folderName,
        file: fileName,
        error: error.message,
      });
      throw new Error("Failed to download file: " + error.message);
    }
  }

  /**
   * Deletes a file from Catalyst Storage
   */
  static async deleteFile(req, folderName, fileName) {
    const catalystApp = req.catalyst;

    try {
      if (!catalystApp || typeof catalystApp.stratus !== "function") {
        throw new Error("Catalyst Stratus API not available on req.catalyst");
      }

      const stratus = catalystApp.stratus();
      const bucket = stratus.bucket(constants.BUCKET_NAME);
      const objectPath = `${folderName}/${fileName}`;

      await bucket.deleteObject(objectPath);

      logger.info("File deleted successfully from Storage", {
        folder: folderName,
        file: fileName,
      });
    } catch (error) {
      logger.error("Failed to delete file from Storage", {
        folder: folderName,
        file: fileName,
        error: error.message,
      });
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
      logger.error(`Failed to read bootstrap directory for ${type}`, {
        error: error.message,
      });
      throw new Error(
        `Failed to read bootstrap directory for ${type}: ` + error.message,
      );
    }

    const results = [];

    // Build a flat list of files to process, including files in one-level subdirectories.
    const stat = util.promisify(fs.stat);
    const entriesToProcess = [];

    for (const name of files) {
      const fullPath = path.join(folderPath, name);
      let s;
      try {
        s = await stat(fullPath);
      } catch (err) {
        // skip if unable to stat
        logger.warn("Skipping entry during bootstrap stat error", {
          type,
          name,
          error: err && err.message,
        });
        continue;
      }

      if (s.isDirectory()) {
        let innerFiles = [];
        try {
          innerFiles = await readdir(fullPath);
        } catch (err) {
          logger.warn("Failed to read nested bootstrap directory", {
            type,
            dir: fullPath,
            error: err && err.message,
          });
          continue;
        }
        for (const innerName of innerFiles) {
          entriesToProcess.push({
            fileName: innerName,
            filePath: path.join(fullPath, innerName),
          });
        }
      } else if (s.isFile()) {
        entriesToProcess.push({ fileName: name, filePath: fullPath });
      }
    }

    for (const entry of entriesToProcess) {
      const fileName = entry.fileName;
      const filePath = entry.filePath;
      const lower = fileName.toLowerCase();

      if (
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".tif") ||
        lower.endsWith(".tiff") ||
        lower.endsWith(".mp4") ||
        lower.endsWith(".pdf")
      ) {
        const buffer = await readFile(filePath);

        logger.info("Bootstrapping file found", {
          type,
          fileName,
          filePath,
          fileSize: buffer.length,
        });

        // Mock a file object for potential upload helper
        const fileObj = {
          originalname: fileName,
          buffer: buffer,
        };

        // If type is 'others', upload directly into the prefix folder without extra subfolders
        if (type === "others") {
          const catalystApp = req.catalyst;
          const prefix = constants.PREFIX_MAP[type] || type;
          const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "");
          const objectPath = `${prefix}/${cleanFileName}`;

          try {
            if (!catalystApp || typeof catalystApp.stratus !== "function") {
              throw new Error(
                "Catalyst Stratus API not available on req.catalyst",
              );
            }

            const stratus = catalystApp.stratus();
            const bucket = stratus.bucket(constants.BUCKET_NAME);

            // Infer a basic content type from extension
            let contentType = "application/octet-stream";
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
              contentType = "image/jpeg";
            else if (lower.endsWith(".png")) contentType = "image/png";
            else if (lower.endsWith(".tif") || lower.endsWith(".tiff"))
              contentType = "image/tiff";
            else if (lower.endsWith(".mp4")) contentType = "video/mp4";
            else if (lower.endsWith(".pdf")) contentType = "application/pdf";

            const stream = Readable.from(buffer);

            await bucket.putObject(objectPath, stream, {
              overwrite: true,
              contentType,
            });

            logger.info("Bootstrapped file uploaded (others)", {
              type,
              fileName,
              objectPath,
            });
            results.push({ fileName, objectPath, status: "success" });
          } catch (error) {
            logger.error("Bootstrapped file upload failed (others)", {
              type,
              fileName,
              error: error && error.message,
            });
            results.push({
              fileName,
              error: error && error.message,
              status: "failed",
            });
          }
          // continue to next file
          continue;
        }

        // For non-'others' types, extract entityId from filename (e.g. "1_1_left_real_ZK9500.jpg" -> "1")
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
            entityId,
          );
          logger.info("Bootstrapped file uploaded", {
            type,
            fileName,
            objectPath,
          });
          results.push({ fileName, objectPath, status: "success" });
        } catch (error) {
          logger.error("Bootstrapped file upload failed", {
            type,
            fileName,
            error: error && error.message,
          });
          results.push({
            fileName,
            error: error && error.message,
            status: "failed",
          });
        }
      }
    }

    return results;
  }
}

module.exports = StorageService;
