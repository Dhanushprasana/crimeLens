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
  ],
  PREFIX_MAP: {
    criminal: "criminal-photos",
    police: "police-photos",
    "crime-evidence": "crime-evidence",
    "crime-spot": "crime-spots",
    "forensic-report": "forensic-reports",
    "fingerprint": "crime-evidence/fingerprint",
    "cctv": "crime-evidence/cctv",
    "footprints": "crime-evidence/footprints",
    "tools": "crime-evidence/tools",
  },
};

