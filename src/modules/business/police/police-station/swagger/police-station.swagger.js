/**
 * @openapi
 * /police/stations:
 *   post:
 *     summary: Add police station
 *     tags: [Police Stations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               station_name:
 *                 type: string
 *               station_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Station added
 *   get:
 *     summary: Get all police stations
 *     tags: [Police Stations]
 *     responses:
 *       200:
 *         description: List of stations
 *
 * /police/stations/getOnePoliceStation/{id}:
 *   get:
 *     summary: Get single station
 *     tags: [Police Stations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Station
 *   put:
 *     summary: Update station
 *     tags: [Police Stations]
 *   delete:
 *     summary: Delete station
 *     tags: [Police Stations]
 *
 * /police/stations/types:
 *   post:
 *     summary: Add station type
 *     tags: [Station Types]
 *   get:
 *     summary: Get all station types
 *     tags: [Station Types]
 * /police/stations/types/{id}:
 *   delete:
 *     summary: Delete station type
 *     tags: [Station Types]
 *
 * /police/stations/geojson:
 *   post:
 *     summary: Add police station geojson entry (single)
 *     tags: [Police Stations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               station_name:
 *                 type: string
 *               boundary:
 *                 type: object
 *     responses:
 *       200:
 *         description: Station geojson added
 *
 * /police/stations/geojson/bootstrap:
 *   post:
 *     summary: Bootstrap police stations from seed-data (imports all geojson files)
 *     tags: [Police Stations]
 *     responses:
 *       200:
 *         description: Bootstrap summary
 */
