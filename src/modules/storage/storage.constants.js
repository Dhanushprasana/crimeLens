"use strict";

module.exports = {
  BUCKET_NAME: "crimelens-storage",
  ALLOWED_ENTITY_TYPES: [
    "criminal",
    "police",
    "crime-evidence",
    "crime-spot",
    "forensic-report",
    "fingerprint",
    "cctv",
    "footprints",
    "tools",
    "face",
    "others"
  ],
  PREFIX_MAP: {
    criminal: "face",
    police: "face",
    fingerprint: "fingerprint",
    footprints: "footprints",
    "crime-evidence": "others",
    "crime-spot": "others",
    "forensic-report": "others",
    cctv: "others",
    tools: "others",
    face: "face",
    others: "others"
  },
};

