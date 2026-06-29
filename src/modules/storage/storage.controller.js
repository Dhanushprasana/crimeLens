"use strict";

const StorageService = require("./storage.service");

class StorageController {
  static async uploadFile(req, res, next) {
    try {
      const { entityType, entityId } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }
      if (!entityType || !entityId) {
        return res.status(400).json({ error: "entityType and entityId are required" });
      }

      const objectPath = await StorageService.uploadFile(
        req,
        file,
        entityType,
        entityId
      );

      res.status(200).json({
        message: "File uploaded successfully",
        objectPath,
      });
    } catch (error) {
      next(error);
    }
  }

  static async downloadFile(req, res, next) {
    try {
      const { entityType, entityId, filename } = req.params;
      const objectPath = `${entityType}/${entityId}/${filename}`;
      
      if (!entityType || !entityId || !filename) {
        return res.status(400).json({ error: "Invalid object path parameters" });
      }

      const fileBuffer = await StorageService.downloadFile(req, objectPath);
      
      // Determine content type conceptually based on extension, defaulting to application/octet-stream
      const ext = filename.split('.').pop().toLowerCase();
      let contentType = 'application/octet-stream';
      if (['jpg', 'jpeg'].includes(ext)) contentType = 'image/jpeg';
      else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'pdf') contentType = 'application/pdf';
      else if (ext === 'mp4') contentType = 'video/mp4';

      res.setHeader('Content-Type', contentType);
      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  }

  static async deleteFile(req, res, next) {
    try {
      const { entityType, entityId, filename } = req.params;
      const objectPath = `${entityType}/${entityId}/${filename}`;

      if (!entityType || !entityId || !filename) {
        return res.status(400).json({ error: "Invalid object path parameters" });
      }

      await StorageService.deleteFile(req, objectPath);

      res.status(200).json({
        message: "File deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = StorageController;
