"use strict";

module.exports = {
  BUCKET_NAME: "crimelens-storage",
  ALLOWED_ENTITY_TYPES: [
    "criminal",
    "police",
    "crime-evidence",
    "crime-spot",
    "forensic-report",
  ],
  PREFIX_MAP: {
    criminal: "criminal-photos",
    police: "police-photos",
    "crime-evidence": "crime-evidence",
    "crime-spot": "crime-spots",
    "forensic-report": "forensic-reports",
  },
};
