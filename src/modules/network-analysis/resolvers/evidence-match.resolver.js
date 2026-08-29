'use strict';

const env = require('../../../../config/env');

// Resolves sys_evidence_match links (evidence -> matched_evidence)
async function resolveEvidenceMatches(req, evidenceId, filters) {
  const zcql = req.catalyst.zcql();
  const nodes = [];
  const edges = [];

  // Find all matches where this evidence is the source
  const sourceQuery = `SELECT * FROM ${env.TABLE_EVIDENCE_MATCH} WHERE source_evidence_id = '${evidenceId}'`;
  const sourceRows = await zcql.executeZCQLQuery(sourceQuery);

  // Find all matches where this evidence is the target
  const targetQuery = `SELECT * FROM ${env.TABLE_EVIDENCE_MATCH} WHERE matched_evidence_id = '${evidenceId}'`;
  const targetRows = await zcql.executeZCQLQuery(targetQuery);

  const processRow = (row, isTarget) => {
    const record = row[env.TABLE_EVIDENCE_MATCH];
    const otherId = isTarget ? record.source_evidence_id : record.matched_evidence_id;
    const matchId = record.ROWID;
    
    // We don't fetch the full evidence node here, just create the edge. 
    // If the graph wants the node data, it will call loadNode on evidence.
    const neighborId = `evidence_${otherId}`;
    nodes.push({ id: neighborId, type: 'evidence', label: `Evidence ${otherId}` });
    edges.push({
      id: `edge_match_${matchId}`,
      source: `evidence_${evidenceId}`,
      target: neighborId,
      relationship: 'MATCHED_WITH',
      label: 'Matched'
    });
  };

  sourceRows.forEach(row => processRow(row, false));
  targetRows.forEach(row => processRow(row, true));

  return { nodes, edges };
}

module.exports = { resolveEvidenceMatches };
