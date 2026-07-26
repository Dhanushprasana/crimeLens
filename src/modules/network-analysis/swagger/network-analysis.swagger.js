/**
 * @openapi
 * tags:
 *   - name: Network Analysis
 *     description: >
 *       AI-powered generic graph traversal engine. Builds an entity relationship
 *       network starting from any root node (criminal, incident, vehicle, evidence, alias, etc.)
 *       and returns a graph consumable directly by Cytoscape.js or React Flow.
 *
 * /network-analysis:
 *   post:
 *     summary: Build Network Analysis Graph
 *     tags: [Network Analysis]
 *     description: >
 *       Executes a generic Breadth-First Search (BFS) graph traversal starting
 *       from any root entity in the CrimeLens database.
 *
 *
 *       **How it works:**
 *
 *       The engine uses a Relationship Registry to discover connections without
 *       hardcoded SQL joins. For each node popped off the queue, the registry
 *       looks up all registered resolvers for that type, executes them to fetch
 *       neighbor nodes and edges, then adds unvisited neighbors back to the queue.
 *       A visited set prevents cycles and infinite loops.
 *
 *
 *       **Supported root entity types:**
 *
 *       `criminal`, `incident`, `vehicle`, `alias`, `evidence`
 *
 *
 *       **Supported relationships traversed:**
 *
 *       - Criminal ↔ Incident (`INVOLVED_IN`)
 *
 *       - Criminal ↔ Vehicle (`USES`)
 *
 *       - Criminal ↔ Alias (`KNOWN_AS`)
 *
 *       - Incident → Evidence (`HAS_EVIDENCE`) _(unidirectional — evidence does not traverse back to incident)_
 *
 *       - Incident → Police Station (`REPORTED_AT`) _(unidirectional — prevents cross-district loops)_
 *
 *       **Extending the graph:**
 *       To add new entity types (e.g. Phone, CDR, Bank Account), simply create
 *       a new resolver function and register it in `registry-initializer.js`.
 *       The traversal engine requires zero changes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - root
 *             properties:
 *               root:
 *                 type: object
 *                 description: The starting entity for the graph traversal.
 *                 required:
 *                   - type
 *                   - id
 *                 properties:
 *                   type:
 *                     type: string
 *                     description: >
 *                       Entity type of the root node.
 *                       Supported values: `criminal`, `incident`, `vehicle`, `alias`, `evidence`
 *                     example: criminal
 *                   id:
 *                     type: string
 *                     description: The ROWID of the root entity in the database.
 *                     example: "46044000000114080"
 *               filters:
 *                 type: object
 *                 description: >
 *                   Optional filters applied during traversal (not after). Setting
 *                   a node type to `false` prevents that entire relationship branch
 *                   from being fetched, improving performance.
 *                 properties:
 *                   criminal:
 *                     type: boolean
 *                     default: true
 *                     description: Include criminal nodes in the graph.
 *                   incident:
 *                     type: boolean
 *                     default: true
 *                     description: Include incident (FIR) nodes in the graph.
 *                   vehicle:
 *                     type: boolean
 *                     default: true
 *                     description: Include vehicle nodes in the graph.
 *                   evidence:
 *                     type: boolean
 *                     default: true
 *                     description: Include evidence nodes in the graph.
 *                   alias:
 *                     type: boolean
 *                     default: true
 *                     description: Include alias nodes in the graph.
 *                   biometric:
 *                     type: boolean
 *                     default: true
 *                     description: Include biometric nodes (photo, fingerprint, footprint).
 *                   district:
 *                     type: boolean
 *                     default: true
 *                     description: Include district nodes in the graph.
 *                   policeStation:
 *                     type: boolean
 *                     default: true
 *                     description: Include police station nodes in the graph.
 *                   matchedEvidence:
 *                     type: boolean
 *                     default: true
 *                     description: Include matched evidence nodes (cross-incident similarity).
 *           examples:
 *             StartFromCriminal:
 *               summary: Start traversal from a criminal
 *               value:
 *                 root:
 *                   type: criminal
 *                   id: "46044000000114080"
 *                 filters:
 *                   criminal: true
 *                   incident: true
 *                   vehicle: true
 *                   alias: true
 *                   evidence: true
 *             StartFromVehicle:
 *               summary: Start traversal from a vehicle
 *               value:
 *                 root:
 *                   type: vehicle
 *                   id: "46044000000114080"
 *                 filters:
 *                   criminal: true
 *                   incident: true
 *             StartFromIncident:
 *               summary: Start traversal from an incident (FIR)
 *               value:
 *                 root:
 *                   type: incident
 *                   id: "46044000000114999"
 *                 filters:
 *                   criminal: true
 *                   evidence: true
 *                   vehicle: false
 *                   alias: false
 *     responses:
 *       200:
 *         description: Graph built successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       description: Count of each entity type discovered in the graph.
 *                       properties:
 *                         criminals:
 *                           type: integer
 *                           example: 3
 *                         incidents:
 *                           type: integer
 *                           example: 5
 *                         vehicles:
 *                           type: integer
 *                           example: 2
 *                         aliases:
 *                           type: integer
 *                           example: 4
 *                         evidence:
 *                           type: integer
 *                           example: 7
 *                         districts:
 *                           type: integer
 *                           example: 1
 *                         policeStations:
 *                           type: integer
 *                           example: 2
 *                     nodes:
 *                       type: array
 *                       description: List of graph nodes ready for Cytoscape.js rendering.
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Unique node ID in format `{type}_{rowid}`.
 *                             example: criminal_45
 *                           type:
 *                             type: string
 *                             description: Entity type of the node.
 *                             example: criminal
 *                           label:
 *                             type: string
 *                             description: Primary display label for the node.
 *                             example: Rahul Kumar
 *                           subtitle:
 *                             type: string
 *                             description: Secondary label (e.g. ID number, category).
 *                             example: CR-00045
 *                           properties:
 *                             type: object
 *                             description: Additional entity-specific metadata.
 *                             example: { status: "ACTIVE", gender: "MALE" }
 *                     edges:
 *                       type: array
 *                       description: List of graph edges ready for Cytoscape.js rendering.
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Unique edge ID.
 *                             example: edge_criminal_45_INVOLVED_IN_incident_12
 *                           source:
 *                             type: string
 *                             description: Source node ID.
 *                             example: criminal_45
 *                           target:
 *                             type: string
 *                             description: Target node ID.
 *                             example: incident_12
 *                           relationship:
 *                             type: string
 *                             description: Relationship label on the edge.
 *                             example: INVOLVED_IN
 *             example:
 *               status: success
 *               data:
 *                 summary:
 *                   criminals: 1
 *                   incidents: 2
 *                   vehicles: 1
 *                   aliases: 0
 *                   evidence: 3
 *                   districts: 0
 *                   policeStations: 0
 *                 nodes:
 *                   - id: criminal_45
 *                     type: criminal
 *                     label: Rahul Kumar
 *                     subtitle: CR-00045
 *                     properties:
 *                       status: ACTIVE
 *                       gender: MALE
 *                   - id: incident_12
 *                     type: incident
 *                     label: FIR-2025-001
 *                     subtitle: Murder
 *                     properties:
 *                       status: OPEN
 *                 edges:
 *                   - id: edge_criminal_45_INVOLVED_IN_incident_12
 *                     source: criminal_45
 *                     target: incident_12
 *                     relationship: INVOLVED_IN
 *       400:
 *         description: Bad request — missing or invalid root node.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Valid root object with type and id is required
 *       500:
 *         description: Internal server error during graph traversal.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Internal server error
 *
 * /network-analysis/global:
 *   get:
 *     summary: Get global network graph structure
 *     tags: [Network Analysis]
 *     description: >
 *       Retrieves nodes and edges for the network graph visualization based on the user's role
 *       and the requested zoom level (STATE -> DISTRICT -> STATION -> full crime network).
 *
 *
 *       **Self-Contained Flow**: Every node in the response includes a `drillDown` field that
 *       tells the frontend exactly what params to pass on the next click. The frontend never
 *       needs to look up any IDs manually.
 *
 *
 *       **Role Enforcement (automatic)**:
 *
 *       - `STATE_COMMANDER` starts from the top (STATE).
 *
 *       - `DISTRICT_COMMANDER` starts at the DISTRICT level, locked to their district.
 *
 *       - `STATION_COMMANDER` immediately receives the full station crime network.
 *
 *
 *       **Drill-down into a specific entity (NODE level)**:
 *
 *       When `nodeId` is provided alongside `stationId` and `nodeId` differs from `stationId`,
 *       the service automatically routes to `level=NODE` and runs a full BFS traversal starting
 *       from that entity. Pass `nodeType` to tell the engine what kind of entity `nodeId` is
 *       (defaults to `incident` for backward compatibility).
 *
 *
 *       **BFS traversal limits (NODE / STATION level)**:
 *
 *       - Max depth: 2 hops from the root entity.
 *
 *       - Max nodes: 200 (hard cap — BFS halts early if the graph grows too large).
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [STATE, DISTRICT, STATION, NODE, CRIME]
 *           default: STATE
 *         description: >
 *           The hierarchy level to query. Usually auto-detected — do not set manually unless needed.
 *
 *           - `STATE` — returns all districts connected to the state root node.
 *
 *           - `DISTRICT` — returns all police stations in the given district.
 *
 *           - `STATION` — returns the full crime network for the given station (BFS from each incident).
 *
 *           - `NODE` — BFS from a specific entity (incident, criminal, vehicle, alias, or evidence).
 *             Auto-detected when `nodeId` is present and differs from `stationId`.
 *
 *           - `CRIME` — Alias for `NODE`, kept for backward compatibility.
 *       - in: query
 *         name: nodeId
 *         schema:
 *           type: string
 *         description: >
 *           The raw DB ROWID of the entity to drill into. **Do not hardcode this** —
 *           always read `node.drillDown.nodeId` from the previous response.
 *           When `nodeId` is present and differs from `stationId`, `level` is automatically
 *           set to `NODE` and `nodeType` determines what kind of entity this ID refers to.
 *       - in: query
 *         name: nodeType
 *         schema:
 *           type: string
 *           enum: [incident, criminal, vehicle, alias, evidence]
 *           default: incident
 *         description: >
 *           The entity type that `nodeId` refers to. Only relevant when drilling into a
 *           specific node (i.e. when `level=NODE` or `nodeId` is provided alongside `stationId`).
 *
 *           - `incident` — a crime incident / FIR (default)
 *
 *           - `criminal` — a criminal profile
 *
 *           - `vehicle` — a vehicle linked to a criminal
 *
 *           - `alias` — a criminal alias
 *
 *           - `evidence` — a piece of evidence linked to an incident
 *
 *           Invalid values are silently ignored and fall back to `incident`.
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *         description: >
 *           The station ROWID. Required for `STATION_COMMANDER` and `CASE_OFFICER` roles.
 *           Also used by STATE_COMMANDER as context when drilling into a specific node.
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *         description: >
 *           The district ROWID. Required for `DISTRICT_COMMANDER` role.
 *           Also used by STATE_COMMANDER as context when drilling into a district.
 *     examples:
 *       StateOverview:
 *         summary: Get full state overview (STATE_COMMANDER)
 *         value:
 *           level: STATE
 *       DistrictDrillDown:
 *         summary: Drill into a district
 *         value:
 *           level: DISTRICT
 *           nodeId: "46044000000317002"
 *           districtId: "46044000000317002"
 *       StationNetwork:
 *         summary: Get full crime network for a station
 *         value:
 *           stationId: "46044000000353832"
 *           districtId: "46044000000317002"
 *       DrillIntoIncident:
 *         summary: Drill into a specific crime incident
 *         value:
 *           nodeId: "46044000000374758"
 *           nodeType: incident
 *           stationId: "46044000000353832"
 *           districtId: "46044000000317002"
 *       DrillIntoCriminal:
 *         summary: Drill into a specific criminal
 *         value:
 *           nodeId: "46044000000114080"
 *           nodeType: criminal
 *           stationId: "46044000000353832"
 *           districtId: "46044000000317002"
 *       DrillIntoVehicle:
 *         summary: Drill into a vehicle
 *         value:
 *           nodeId: "46044000000221001"
 *           nodeType: vehicle
 *           stationId: "46044000000353832"
 *           districtId: "46044000000317002"
 *     responses:
 *       200:
 *         description: Successfully retrieved nodes and edges.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     nodes:
 *                       type: array
 *                       description: >
 *                         List of graph nodes. Each node with `canDrillDown: true` can be expanded
 *                         by passing its `drillDown.level` and `drillDown.nodeId` to the next request.
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Unique node ID used internally by the graph library.
 *                             example: dist_46044000000058003
 *                           label:
 *                             type: string
 *                             description: Human-readable display label for the node.
 *                             example: North District
 *                           type:
 *                             type: string
 *                             description: Entity type of the node.
 *                             enum: [STATE, DISTRICT, STATION, policeStation, incident, criminal, vehicle, alias, evidence]
 *                             example: DISTRICT
 *                           rawId:
 *                             type: string
 *                             description: The raw database ROWID of this entity.
 *                             example: "46044000000058003"
 *                           canDrillDown:
 *                             type: boolean
 *                             description: If true, this node can be expanded further by clicking on it.
 *                             example: true
 *                           drillDown:
 *                             type: object
 *                             nullable: true
 *                             description: >
 *                               The exact params to send in the next API call when this node is clicked.
 *                               Pass these directly as query params to GET /network-analysis/global.
 *                               Null for leaf nodes (criminals, evidence, etc.) that cannot be expanded.
 *                             properties:
 *                               level:
 *                                 type: string
 *                                 example: DISTRICT
 *                               nodeId:
 *                                 type: string
 *                                 example: "46044000000058003"
 *                     edges:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           source:
 *                             type: string
 *                           target:
 *                             type: string
 *                           label:
 *                             type: string
 *       500:
 *         description: Server error
 *
 * /network-analysis/global/options:
 *   get:
 *     summary: Get available drill-down options based on user role
 *     tags: [Network Analysis]
 *     description: Returns the list of districts, stations, and crimes the current user is allowed to view in the global network graph, tailored by their Commander role constraints.
 *     parameters:
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *         description: >
 *           Required for STATION_COMMANDER. The station ID from their profile.
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *         description: >
 *           Required for DISTRICT_COMMANDER. The district ID from their profile.
 *     responses:
 *       200:
 *         description: Successfully retrieved allowed options.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     districts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                     stations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                     crimes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *       500:
 *         description: Server error
 */
