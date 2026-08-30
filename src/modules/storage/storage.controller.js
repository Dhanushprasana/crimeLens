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
      const { folder, filename } = req.params;
      if (!folder || !filename) {
        return res.status(400).json({ error: "Invalid object path parameters" });
      }

      const fileBuffer = await StorageService.downloadFile(req, folder, filename);

      const ext = String(filename).split('.').pop().toLowerCase();
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

  static async downloadBlobByPath(req, res, next) {
    try {
      const objectPath = req.params?.path || req.params?.[0] || req.query?.path;
      if (!objectPath) {
        return res.status(400).json({ error: "path is required" });
      }

      const normalizedPath = String(objectPath).replace(/^\/+/, "");
      const fileBuffer = await StorageService.downloadByObjectPath(req, normalizedPath);

      const fileName = normalizedPath.split('/').pop() || 'blob';
      const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
      let contentType = 'application/octet-stream';
      if (['jpg', 'jpeg'].includes(ext)) contentType = 'image/jpeg';
      else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'pdf') contentType = 'application/pdf';
      else if (['mp4', 'mov'].includes(ext)) contentType = 'video/' + ext;
      else if (['txt', 'json', 'csv'].includes(ext)) contentType = 'text/' + ext;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  }

  static async deleteFile(req, res, next) {
    try {
      const { folder, filename } = req.params;
      if (!folder || !filename) {
        return res.status(400).json({ error: "Invalid object path parameters" });
      }

      await StorageService.deleteFile(req, folder, filename);

      res.status(200).json({
        message: "File deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  static async bootstrapImages(req, res, next) {
    try {
      const { type } = req.params;
      
      if (!type) {
        return res.status(400).json({ error: "type parameter is required" });
      }

      const results = await StorageService.bootstrapImages(req, type);
      res.status(200).json({
        message: `Images from ${type} bootstrapped successfully`,
        results,
      });
    } catch (error) {
      next(error);
    }
  }

  static async debugListFace(req, res, next) {
  try {
    const keys = await StorageService.listBucketObjectKeys(req, "face/");
    res.json({ count: keys.length, keys });
  } catch (error) {
    next(error);
  }
}
}

module.exports = StorageController;
