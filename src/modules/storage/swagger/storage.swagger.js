"use strict";

/**
 * @swagger
 * tags:
 *   name: Storage
 *   description: Endpoints for Catalyst Stratus file storage
 */

/**
 * @swagger
 * /storage/upload:
 *   post:
 *     summary: Upload a file to Stratus storage
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload
 *               entityType:
 *                 type: string
 *                 enum: [criminal, police, crime-evidence, crime-spot, forensic-report]
 *                 description: The type of entity the file belongs to
 *               entityId:
 *                 type: string
 *                 description: The unique identifier for the entity
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 objectPath:
 *                   type: string
 *                   description: The path to the uploaded file in Stratus
 *       400:
 *         description: Bad request (missing file, entityType, or entityId)
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /storage/object/{entityType}/{entityId}/{filename}:
 *   get:
 *     summary: Download a file from Stratus storage
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *         description: The prefix or entity type (e.g. criminal-photos)
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier for the entity
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: The actual name of the file
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request (missing parameters)
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /storage/object/{entityType}/{entityId}/{filename}:
 *   delete:
 *     summary: Delete a file from Stratus storage
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       400:
 *         description: Bad request (missing parameters)
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /storage/bootstrap/{type}:
 *   post:
 *     summary: Bootstrap images from local storage-data directory into Stratus
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [fingerprint, cctv, footprints, tools]
 *         description: The type of data to bootstrap (maps to a folder inside storage-data)
 *     responses:
 *       200:
 *         description: Images bootstrapped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fileName:
 *                         type: string
 *                       objectPath:
 *                         type: string
 *                       status:
 *                         type: string
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */

