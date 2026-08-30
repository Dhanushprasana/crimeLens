"use strict";

const express = require("express");
const multer = require("multer");
const StorageController = require("./storage.controller");

const router = express.Router();

// Configure multer to store file in memory
// so that we have req.file.buffer available to upload to Stratus
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (adjust as needed)
  },
});

// Upload API
router.post("/upload", upload.single("file"), StorageController.uploadFile);

// Download API
router.get("/object/:folder/:filename", StorageController.downloadFile);

// Accepts a full bucket path and returns the blob
// This must stay as a wildcard route so nested keys like
// "face/face_default_003602.jpg" are captured correctly after /blob/.
router.get("/blob", StorageController.downloadBlobByPath);
router.get("/blob/*path", StorageController.downloadBlobByPath);

// Delete API
router.delete("/object/:folder/:filename", StorageController.deleteFile);

// Bootstrap API
router.post("/bootstrap/:type", StorageController.bootstrapImages);
router.get("/storage/debug/face-keys", StorageController.debugListFace);
module.exports = router;
