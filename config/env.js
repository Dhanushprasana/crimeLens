module.exports = {
  // Core tables used throughout the backend
  TABLE_EVIDENCE_MATCH: process.env.TABLE_EVIDENCE_MATCH || 'sys_evidence_match',
  TABLE_EVIDENCE: process.env.TABLE_EVIDENCE || 'sys_evidence',
  TABLE_CRIME: process.env.TABLE_CRIME || 'sys_crime',
  TABLE_CRIME_CATEGORY: process.env.TABLE_CRIME_CATEGORY || 'sys_crime_category',
  TABLE_DISTRICT_GEODATA: process.env.TABLE_DISTRICT_GEODATA || 'sys_district_geodata',
  TABLE_POLICE_STATION: process.env.TABLE_POLICE_STATION || 'sys_police_station',
  TABLE_POLICE_OFFICER: process.env.TABLE_POLICE_OFFICER || 'sys_police_officer',
  TABLE_POLICE_RANK: process.env.TABLE_POLICE_RANK || 'sys_police_rank',
  TABLE_ROLE: process.env.TABLE_ROLE || 'sys_role',
  TABLE_USER: process.env.TABLE_USER || 'sys_user',
  TABLE_USER_INFO: process.env.TABLE_USER_INFO || 'sys_user_info',
  TABLE_USER_ROLE: process.env.TABLE_USER_ROLE || 'sys_user_role',
  TABLE_LEGAL_ACTS: process.env.TABLE_LEGAL_ACTS || 'sys_legal_acts',
  TABLE_LEGAL_CHAPTERS: process.env.TABLE_LEGAL_CHAPTERS || 'sys_legal_chapters',
  TABLE_LEGAL_SECTIONS: process.env.TABLE_LEGAL_SECTIONS || 'sys_legal_sections',
  // Add any other tables that the code may reference here with sensible defaults
  DEFAULT_OFFICER_ROLE: process.env.DEFAULT_OFFICER_ROLE || 'CASE_OFFICER'
};
