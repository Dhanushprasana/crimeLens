'use strict';

const PDFDocument = require('pdfkit');
const { AppError } = require('../../../common/exceptions');
const repository = require('./report.repository');

const ENTITY_ALIASES = {
  crime: 'crime',
  crimes: 'crime',
  criminal: 'criminal',
  criminals: 'criminal',
  officer: 'officer',
  officers: 'officer'
};

const HIDDEN_FIELDS = new Set([
  'rowid',
  'creatorid',
  'createdtime',
  'modifiedtime',
  'criminal_id',
  'profile_id'
]);

function compact(record) {
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter(([key, value]) =>
      !HIDDEN_FIELDS.has(key.toLowerCase()) && value !== undefined && value !== null && value !== ''
    )
  );
}

function toText(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function humanize(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function writeSectionTitle(doc, title) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#163a5f').text(title);
  doc.moveDown(0.25);
}

function writeRecord(doc, record) {
  const fields = Object.entries(compact(record));
  if (!fields.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text('No data available.');
    return;
  }

  for (const [key, value] of fields) {
    if (doc.y > doc.page.height - 70) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#222222').text(`${humanize(key)}: `, { continued: true });
    doc.font('Helvetica').fillColor('#333333').text(toText(value));
  }
}

function writeRecords(doc, records, emptyMessage = 'No records found.') {
  if (!records?.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text(emptyMessage);
    return;
  }

  records.forEach((record, index) => {
    if (doc.y > doc.page.height - 130) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#222222').text(`${index + 1}.`);
    writeRecord(doc, record);
    doc.moveDown(0.35);
  });
}

function writeEvidenceRecords(doc, records) {
  if (!records?.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text('No records found.');
    return;
  }

  records.forEach((record, index) => {
    if (doc.y > doc.page.height - 130) doc.addPage();
    const { file_url: _fileUrl, download_url: downloadUrl, ...details } = record;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#222222').text(`${index + 1}.`);
    writeRecord(doc, details);
    if (downloadUrl) {
      doc.font('Helvetica').fontSize(9).fillColor('#333333').text('• ', { continued: true });
      doc.fillColor('#1d4ed8').text(downloadUrl, { link: downloadUrl, underline: true });
    }
    doc.moveDown(0.35);
  });
}

function writeRelatedCrimes(doc, incidents, frontendOrigin) {
  if (!incidents?.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text('No records found.');
    return;
  }

  const baseUrl = frontendOrigin ? frontendOrigin.replace(/\/$/, '') : null;
  incidents.forEach((incident) => {
    if (doc.y > doc.page.height - 70) doc.addPage();
    const label = [
      incident.crime_number || incident.case_number || 'Crime',
      incident.title,
      incident.status ? `(${incident.status})` : null
    ].filter(Boolean).join(' — ');
    const crimeUrl = baseUrl && incident.ROWID
      ? `${baseUrl}/entities/crimes/${encodeURIComponent(incident.ROWID)}`
      : null;

    doc.font('Helvetica').fontSize(9).fillColor('#333333').text('• ', { continued: true });
    if (crimeUrl) {
      doc.fillColor('#1d4ed8').text(label, { link: crimeUrl, underline: true });
    } else {
      doc.fillColor('#333333').text(label);
    }
  });
}

function writeAssociatedCriminals(doc, criminals, frontendOrigin) {
  if (!criminals?.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text('No records found.');
    return;
  }

  const baseUrl = frontendOrigin ? frontendOrigin.replace(/\/$/, '') : null;
  criminals.forEach((criminal) => {
    if (doc.y > doc.page.height - 70) doc.addPage();
    const label = [
      criminal.criminal_number || 'Criminal',
      criminal.full_name,
      criminal.status ? `(${criminal.status})` : null
    ].filter(Boolean).join(' — ');
    const criminalUrl = baseUrl && criminal.ROWID
      ? `${baseUrl}/entities/criminals/${encodeURIComponent(criminal.ROWID)}`
      : null;

    doc.font('Helvetica').fontSize(9).fillColor('#333333').text('• ', { continued: true });
    if (criminalUrl) {
      doc.fillColor('#1d4ed8').text(label, { link: criminalUrl, underline: true });
    } else {
      doc.fillColor('#333333').text(label);
    }
  });
}

const REPORT_COLORS = {
  navy: '#102A43', blue: '#1D4ED8', paleBlue: '#EDF5FF', border: '#D9E2EC',
  text: '#243B53', muted: '#627D98', danger: '#C53030', dangerPale: '#FFF1F0',
  warning: '#B7791F', warningPale: '#FFF8E1', success: '#2F855A', successPale: '#F0FFF4'
};

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusStyle(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized.includes('WANTED') || normalized.includes('CRITICAL') || normalized.includes('OPEN')) {
    return { fill: REPORT_COLORS.dangerPale, text: REPORT_COLORS.danger };
  }
  if (normalized.includes('UNDER') || normalized.includes('WATCH')) {
    return { fill: REPORT_COLORS.warningPale, text: REPORT_COLORS.warning };
  }
  return { fill: REPORT_COLORS.successPale, text: REPORT_COLORS.success };
}

function drawCriminalHeader(doc, report, continuation = false) {
  const reportName = `${humanize(report.entity).toUpperCase()} REPORT`;
  doc.rect(0, 0, doc.page.width, continuation ? 70 : 92).fill(REPORT_COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(continuation ? 14 : 20).fillColor('#FFFFFF')
    .text(continuation ? `${reportName} - CONTINUED` : reportName, 50, continuation ? 24 : 28);
  doc.font('Helvetica-Bold').fontSize(continuation ? 11 : 13).fillColor('#D9EAF7')
    .text(report.subject, 330, continuation ? 27 : 33, { width: 215, align: 'right' });
  if (!continuation) {
    doc.font('Helvetica').fontSize(9).fillColor('#C7D9EA')
      .text(`Generated: ${formatDate(report.generatedAt)}`, 50, 63);
  }
  doc.y = continuation ? 91 : 114;
}

function addCriminalPage(doc, report) {
  doc.addPage();
  drawCriminalHeader(doc, report, true);
}

function ensureCriminalSpace(doc, report, requiredHeight) {
  if (doc.y + requiredHeight > doc.page.height - 50) addCriminalPage(doc, report);
}

function drawSectionHeading(doc, report, title) {
  ensureCriminalSpace(doc, report, 32);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(REPORT_COLORS.navy).text(title.toUpperCase(), 50, doc.y);
  doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).lineWidth(0.8).strokeColor(REPORT_COLORS.border).stroke();
  doc.moveDown(0.8);
}

function drawStatusPill(doc, status, x, y) {
  const label = String(status || 'ACTIVE').replace(/_/g, ' ');
  const style = statusStyle(label);
  const width = Math.max(64, doc.widthOfString(label, { font: 'Helvetica-Bold', size: 8 }) + 22);
  doc.roundedRect(x, y, width, 20, 10).fill(style.fill);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(style.text).text(label, x + 11, y + 6, { width: width - 18, align: 'center' });
}

function drawCriminalIdentity(doc, data) {
  const criminal = data.criminal || {};
  const y = doc.y;
  doc.roundedRect(50, y, 495, 78, 8).fill('#F8FBFF').strokeColor(REPORT_COLORS.border).stroke();
  doc.font('Helvetica-Bold').fontSize(18).fillColor(REPORT_COLORS.navy).text(criminal.full_name || 'Unknown Criminal', 66, y + 17, { width: 290 });
  drawStatusPill(doc, criminal.status, 425, y + 18);
  const identityParts = [data.district?.district_name, criminal.nationality, criminal.gender, criminal.date_of_birth ? formatDate(criminal.date_of_birth) : null].filter(Boolean);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.muted).text(identityParts.join('  |  ') || 'No profile details recorded', 66, y + 50, { width: 450 });
  doc.y = y + 92;
}

function drawMetricCards(doc, report, data) {
  const profile = data.profile || {};
  drawSectionHeading(doc, report, 'Risk Assessment');
  const cards = [
    ['Risk Score', profile.risk_score ?? 'N/A', profile.risk_score >= 76 ? REPORT_COLORS.danger : REPORT_COLORS.blue],
    ['Threat Level', profile.threat_level || 'LOW', statusStyle(profile.threat_level).text],
    ['Incidents', profile.crime_frequency ?? data.incidents.length, REPORT_COLORS.blue],
    ['Associates', profile.associate_count ?? data.associates.length, REPORT_COLORS.blue]
  ];
  const y = doc.y;
  cards.forEach(([label, value, color], index) => {
    const x = 50 + index * 126;
    doc.roundedRect(x, y, 117, 70, 8).fill('#F8FBFF').strokeColor(REPORT_COLORS.border).stroke();
    const valueSize = String(value).length >= 8 ? 13 : 20;
    doc.font('Helvetica-Bold').fontSize(valueSize).fillColor(color).text(String(value), x + 12, y + 18, { width: 93, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(REPORT_COLORS.muted).text(label.toUpperCase(), x + 9, y + 46, { width: 99, align: 'center' });
  });
  doc.y = y + 84;
}

function drawProfileSummary(doc, report, data) {
  const profile = data.profile || {};
  drawSectionHeading(doc, report, 'Profile');
  const y = doc.y;
  doc.roundedRect(50, y, 495, 77, 8).fill('#FFFFFF').strokeColor(REPORT_COLORS.border).stroke();
  doc.font('Helvetica-Bold').fontSize(15).fillColor(REPORT_COLORS.navy).text(profile.profile_type || 'Profile pending', 66, y + 14);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.text).text(`Primary Crime: ${profile.primary_crime_type || 'Not established'}`, 66, y + 43);
  doc.text(`Primary District: ${profile.primary_district_name || 'Not established'}`, 285, y + 43, { width: 230 });
  doc.y = y + 91;
}

function drawRiskFactors(doc, report, factors) {
  drawSectionHeading(doc, report, 'Risk Factors');
  if (!factors?.length) {
    doc.font('Helvetica').fontSize(9).fillColor(REPORT_COLORS.muted).text('No risk factors are available.');
    return;
  }
  factors.forEach((factor) => {
    const description = factor.factor_description || 'No further explanation available.';
    const height = Math.max(48, doc.heightOfString(description, { width: 400, font: 'Helvetica', size: 9 }) + 31);
    ensureCriminalSpace(doc, report, height + 8);
    const y = doc.y;
    doc.roundedRect(50, y, 495, height, 8).fill('#FFFFFF').strokeColor(REPORT_COLORS.border).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(REPORT_COLORS.navy).text(factor.factor_name || 'Risk Factor', 64, y + 11, { width: 350 });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(REPORT_COLORS.danger).text(String(factor.factor_score ?? 0), 462, y + 10, { width: 67, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(REPORT_COLORS.muted).text(description, 64, y + 29, { width: 410 });
    doc.y = y + height + 8;
  });
}

function drawLinkedTable(doc, report, title, rows, columns) {
  // Keep the section title, table header, and first row together so a page
  // never ends with an empty table header.
  ensureCriminalSpace(doc, report, 130);
  drawSectionHeading(doc, report, title);
  if (!rows?.length) {
    doc.font('Helvetica').fontSize(9).fillColor(REPORT_COLORS.muted).text('No records found.');
    return;
  }
  const drawHeader = () => {
    const y = doc.y;
    doc.roundedRect(50, y, 495, 25, 5).fill(REPORT_COLORS.paleBlue);
    columns.forEach((column) => doc.font('Helvetica-Bold').fontSize(8).fillColor(REPORT_COLORS.navy).text(column.label.toUpperCase(), column.x + 8, y + 9, { width: column.width - 12 }));
    doc.y = y + 30;
  };
  drawHeader();
  rows.forEach((row, index) => {
    if (doc.y > doc.page.height - 115) {
      addCriminalPage(doc, report);
      drawSectionHeading(doc, report, title);
      drawHeader();
    }
    const y = doc.y;
    doc.rect(50, y, 495, 30).fill(index % 2 === 0 ? '#FFFFFF' : '#F8FBFF').strokeColor(REPORT_COLORS.border).stroke();
    columns.forEach((column) => {
      const link = column.link ? column.link(row) : null;
      const options = { width: column.width - 12, ellipsis: true };
      doc.font(link ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(link ? REPORT_COLORS.blue : REPORT_COLORS.text)
        .text(column.value(row), column.x + 8, y + 10, link ? { ...options, link, underline: true } : options);
    });
    doc.y = y + 30;
  });
}

function renderCriminalReport(doc, report) {
  const { data } = report;
  drawCriminalHeader(doc, report);
  drawCriminalIdentity(doc, data);
  drawMetricCards(doc, report, data);
  drawProfileSummary(doc, report, data);
  drawRiskFactors(doc, report, data.riskFactors);
  const frontendOrigin = report.frontendOrigin ? report.frontendOrigin.replace(/\/$/, '') : null;
  drawLinkedTable(doc, report, 'Related Crimes', data.incidents, [
    { label: 'Crime Number', x: 50, width: 210, value: (crime) => String(crime.crime_number || crime.case_number || 'Crime'), link: (crime) => frontendOrigin && crime.ROWID ? `${frontendOrigin}/entities/crimes/${encodeURIComponent(crime.ROWID)}` : null },
    { label: 'Type', x: 260, width: 155, value: (crime) => String(crime.crime_category_name || 'Not classified') },
    { label: 'Status', x: 415, width: 130, value: (crime) => String(crime.status || 'Unknown') }
  ]);
  drawLinkedTable(doc, report, 'Known Associates', data.associates, [
    { label: 'Criminal Number', x: 50, width: 170, value: (criminal) => String(criminal.criminal_number || 'Criminal'), link: (criminal) => frontendOrigin && criminal.ROWID ? `${frontendOrigin}/entities/criminals/${encodeURIComponent(criminal.ROWID)}` : null },
    { label: 'Name', x: 220, width: 215, value: (criminal) => String(criminal.full_name || 'Unknown') },
    { label: 'Status', x: 435, width: 110, value: (criminal) => String(criminal.status || 'Unknown') }
  ]);
}

function drawCrimeIdentity(doc, data) {
  const incident = data.incident || {};
  const y = doc.y;
  doc.roundedRect(50, y, 495, 78, 8).fill('#F8FBFF').strokeColor(REPORT_COLORS.border).stroke();
  doc.font('Helvetica-Bold').fontSize(18).fillColor(REPORT_COLORS.navy)
    .text(incident.title || incident.crime_number || 'Crime Incident', 66, y + 17, { width: 290, ellipsis: true });
  drawStatusPill(doc, incident.status || 'UNDER INVESTIGATION', 405, y + 18);
  const identityParts = [
    incident.crime_number ? `Crime: ${incident.crime_number}` : null,
    data.category?.crime_category_name,
    data.district?.district_name
  ].filter(Boolean);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.muted)
    .text(identityParts.join('  |  ') || 'No case details recorded', 66, y + 50, { width: 450, ellipsis: true });
  doc.y = y + 92;
}

function drawCrimeMetricCards(doc, report, data) {
  drawSectionHeading(doc, report, 'Case Overview');
  const cards = [
    ['Assigned Officers', data.officers?.length || 0, REPORT_COLORS.blue],
    ['Linked Criminals', data.criminals?.length || 0, REPORT_COLORS.blue],
    ['Victims', data.victims?.length || 0, REPORT_COLORS.blue],
    ['Witnesses', data.witnesses?.length || 0, REPORT_COLORS.blue]
  ];
  const y = doc.y;
  cards.forEach(([label, value, color], index) => {
    const x = 50 + index * 126;
    doc.roundedRect(x, y, 117, 70, 8).fill('#F8FBFF').strokeColor(REPORT_COLORS.border).stroke();
    doc.font('Helvetica-Bold').fontSize(20).fillColor(color)
      .text(String(value), x + 12, y + 18, { width: 93, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(REPORT_COLORS.muted)
      .text(label.toUpperCase(), x + 9, y + 46, { width: 99, align: 'center' });
  });
  doc.y = y + 84;
}

function drawCrimeDetails(doc, report, data) {
  const incident = data.incident || {};
  const description = incident.description || 'No incident description recorded.';
  const descriptionHeight = Math.max(22, doc.heightOfString(description, { width: 463, font: 'Helvetica', size: 9 }));
  const height = 116 + descriptionHeight;
  drawSectionHeading(doc, report, 'Case Details');
  ensureCriminalSpace(doc, report, height + 8);
  const y = doc.y;
  doc.roundedRect(50, y, 495, height, 8).fill('#FFFFFF').strokeColor(REPORT_COLORS.border).stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(REPORT_COLORS.muted).text('CATEGORY', 66, y + 14);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.text)
    .text(data.category?.crime_category_name || 'Not classified', 66, y + 29, { width: 205, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(REPORT_COLORS.muted).text('INCIDENT DISTRICT', 310, y + 14);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.text)
    .text(data.district?.district_name || 'Not recorded', 310, y + 29, { width: 215, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(REPORT_COLORS.muted).text('POLICE STATION', 66, y + 52);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.text)
    .text(data.station?.station_name || 'Not recorded', 66, y + 67, { width: 205, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(REPORT_COLORS.muted).text('POLICE STATION DISTRICT', 310, y + 52);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.text)
    .text(data.stationDistrict?.district_name || 'Not recorded', 310, y + 67, { width: 215, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(REPORT_COLORS.muted).text('DESCRIPTION', 66, y + 90);
  doc.font('Helvetica').fontSize(9).fillColor(REPORT_COLORS.text)
    .text(description, 66, y + 105, { width: 463, ellipsis: true });
  doc.y = y + height + 8;
}

function renderCrimeReport(doc, report) {
  const { data } = report;
  const frontendOrigin = report.frontendOrigin ? report.frontendOrigin.replace(/\/$/, '') : null;
  drawCriminalHeader(doc, report);
  drawCrimeIdentity(doc, data);
  drawCrimeMetricCards(doc, report, data);
  drawCrimeDetails(doc, report, data);
  drawLinkedTable(doc, report, 'Assigned Officers', data.officers, [
    { label: 'Badge Number', x: 50, width: 170, value: (officer) => String(officer.badge_number || 'Not recorded') },
    { label: 'Name', x: 220, width: 215, value: (officer) => String(officer.full_name || 'Unknown Officer') },
    { label: 'Rank', x: 435, width: 110, value: (officer) => String(officer.rank_name || 'Not assigned') }
  ]);
  drawLinkedTable(doc, report, 'Linked Criminals', data.criminals, [
    {
      label: 'Criminal Number', x: 50, width: 170,
      value: (criminal) => String(criminal.criminal_number || 'Criminal'),
      link: (criminal) => frontendOrigin && criminal.ROWID
        ? `${frontendOrigin}/entities/criminals/${encodeURIComponent(criminal.ROWID)}`
        : null
    },
    { label: 'Name', x: 220, width: 215, value: (criminal) => String(criminal.full_name || 'Unknown') },
    { label: 'Status', x: 435, width: 110, value: (criminal) => String(criminal.status || 'Unknown') }
  ]);
  drawLinkedTable(doc, report, 'Victims', data.victims, [
    { label: 'Name', x: 50, width: 210, value: (victim) => String(victim.full_name || 'Unknown') },
    { label: 'Injury Type', x: 260, width: 155, value: (victim) => String(victim.injury_type || 'Not recorded') },
    { label: 'Status', x: 415, width: 130, value: (victim) => victim.alive === false || victim.alive === 'false' ? 'Deceased' : 'Alive' }
  ]);
  drawLinkedTable(doc, report, 'Witnesses', data.witnesses, [
    { label: 'Name', x: 50, width: 210, value: (witness) => String(witness.full_name || 'Unknown') },
    { label: 'Witness Type', x: 260, width: 155, value: (witness) => String(witness.witness_type || 'Not recorded') },
    { label: 'Occupation', x: 415, width: 130, value: (witness) => String(witness.occupation || 'Not recorded') }
  ]);
  drawLinkedTable(doc, report, 'Evidence', data.evidence, [
    { label: 'Evidence Number', x: 50, width: 170, value: (evidence) => String(evidence.evidence_number || 'Not recorded') },
    { label: 'Type', x: 220, width: 215, value: (evidence) => String(evidence.evidence_type || 'Not recorded') },
    {
      label: 'File', x: 435, width: 110,
      value: (evidence) => evidence.download_url ? 'Open file' : 'Not attached',
      link: (evidence) => evidence.download_url || null
    }
  ]);
}

function drawOfficerIdentity(doc, data) {
  const officer = data.officer || {};
  const y = doc.y;
  doc.roundedRect(50, y, 495, 78, 8).fill('#F8FBFF').strokeColor(REPORT_COLORS.border).stroke();
  doc.font('Helvetica-Bold').fontSize(18).fillColor(REPORT_COLORS.navy)
    .text(officer.full_name || 'Unknown Officer', 66, y + 17, { width: 290 });
  drawStatusPill(doc, officer.status || 'ACTIVE', 425, y + 18);
  const identityParts = [
    officer.badge_number ? `Badge: ${officer.badge_number}` : null,
    officer.rank_name,
    officer.station_name
  ].filter(Boolean);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.muted)
    .text(identityParts.join('  |  ') || 'No profile details recorded', 66, y + 50, { width: 450 });
  doc.y = y + 92;
}

function drawOfficerMetricCards(doc, report, data) {
  const officer = data.officer || {};
  drawSectionHeading(doc, report, 'Assignment Overview');
  const cards = [
    ['Badge Number', officer.badge_number || 'N/A', REPORT_COLORS.blue],
    ['Rank', officer.rank_name || 'Not assigned', REPORT_COLORS.navy],
    ['Assigned Crimes', data.incidents?.length || 0, REPORT_COLORS.blue],
    ['Assigned FIRs', data.firs?.length || 0, REPORT_COLORS.blue]
  ];
  const y = doc.y;
  cards.forEach(([label, value, color], index) => {
    const x = 50 + index * 126;
    doc.roundedRect(x, y, 117, 70, 8).fill('#F8FBFF').strokeColor(REPORT_COLORS.border).stroke();
    const valueSize = String(value).length >= 12 ? 11 : String(value).length >= 8 ? 13 : 20;
    doc.font('Helvetica-Bold').fontSize(valueSize).fillColor(color)
      .text(String(value), x + 12, y + 18, { width: 93, align: 'center', ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(REPORT_COLORS.muted)
      .text(label.toUpperCase(), x + 9, y + 46, { width: 99, align: 'center' });
  });
  doc.y = y + 84;
}

function drawOfficerDetails(doc, report, data) {
  const officer = data.officer || {};
  drawSectionHeading(doc, report, 'Officer Details');
  const y = doc.y;
  doc.roundedRect(50, y, 495, 66, 8).fill('#FFFFFF').strokeColor(REPORT_COLORS.border).stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(REPORT_COLORS.muted).text('EMAIL', 66, y + 14);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.text).text(officer.email || 'Not recorded', 66, y + 29, { width: 220, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(REPORT_COLORS.muted).text('POLICE STATION', 310, y + 14);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.text).text(officer.station_name || 'Not assigned', 310, y + 29, { width: 215, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(REPORT_COLORS.muted).text('DISTRICT', 66, y + 47);
  doc.font('Helvetica').fontSize(10).fillColor(REPORT_COLORS.text).text(officer.district_name || 'Not assigned', 126, y + 46, { width: 180, ellipsis: true });
  doc.y = y + 80;
}

function renderOfficerReport(doc, report) {
  const { data } = report;
  const frontendOrigin = report.frontendOrigin ? report.frontendOrigin.replace(/\/$/, '') : null;
  drawCriminalHeader(doc, report);
  drawOfficerIdentity(doc, data);
  drawOfficerMetricCards(doc, report, data);
  drawOfficerDetails(doc, report, data);
  drawLinkedTable(doc, report, 'Assigned Crime Incidents', data.incidents, [
    {
      label: 'Crime Number', x: 50, width: 210,
      value: (crime) => String(crime.crime_number || crime.case_number || 'Crime'),
      link: (crime) => frontendOrigin && crime.ROWID
        ? `${frontendOrigin}/entities/crimes/${encodeURIComponent(crime.ROWID)}`
        : null
    },
    { label: 'Type', x: 260, width: 155, value: (crime) => String(crime.crime_category_name || 'Not classified') },
    { label: 'Status', x: 415, width: 130, value: (crime) => String(crime.status || 'Unknown') }
  ]);
  drawLinkedTable(doc, report, 'Assigned FIRs', data.firs, [
    { label: 'FIR Number', x: 50, width: 170, value: (fir) => String(fir.fir_number || 'FIR') },
    { label: 'Complainant', x: 220, width: 215, value: (fir) => String(fir.complainant_name || 'Not recorded') },
    { label: 'Status', x: 435, width: 110, value: (fir) => String(fir.fir_status || 'Unknown') }
  ]);
}

function reportSections(entity, data) {
  if (entity === 'crime') {
    return [
      ['Case Details', data.incident],
      ['Classification & Location', { category: data.category?.crime_category_name, category_description: data.category?.description, police_station: data.station?.station_name, district: data.district?.district_name, station_address: data.station?.address, latitude: data.incident.crime_location_latitude, longitude: data.incident.crime_location_longitude }],
      ['FIR', data.fir],
      ['Assigned Officers', data.officers],
      ['Linked Criminals', data.criminals],
      ['Evidence', data.evidence],
      ['Victims', data.victims],
      ['Witnesses', data.witnesses]
    ];
  }

  if (entity === 'criminal') {
    const criminalDetails = {
      ...data.criminal,
      district_name: data.district?.district_name || undefined
    };
    delete criminalDetails.district_id_of_criminal;

    const profile = data.profile
      ? {
        ...data.profile,
        primary_district_name: data.profile.primary_district
          ? data.primaryDistrict?.district_name || 'Unknown District'
          : undefined
      }
      : null;
    if (profile) delete profile.primary_district;

    return [
      ['Criminal Details', criminalDetails],
      ['Criminal Profile & Risk Assessment', profile],
      ['Risk Factors', data.riskFactors],
      ['Biometrics', data.biometrics],
      ['Known Aliases', data.aliases],
      ['Phone Records', data.phones],
      ['Vehicle Records', data.vehicles],
      ['Behavioral Flags', data.behavioralFlags],
      ['Related Crimes', data.incidents],
      ['Known Associates', data.associates]
    ];
  }

  return [
    ['Officer Details', data.officer],
    ['Assigned Crime Incidents', data.incidents],
    ['Assigned FIRs', data.firs]
  ];
}

function filename(value) {
  return String(value || 'entity')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  async buildReport(query, req) {
    const entity = ENTITY_ALIASES[String(query.entity || '').trim().toLowerCase()];
    const id = String(query.id || '').trim();
    if (!entity) throw new AppError('entity must be one of: crime, criminal, officer', 400);
    if (!id) throw new AppError('id is required', 400);

    let data;
    if (entity === 'crime') data = await repository.getCrime(req, id);
    if (entity === 'criminal') data = await repository.getCriminal(req, id);
    if (entity === 'officer') data = await repository.getOfficerReport(req, id);
    if (!data) throw new AppError(`${humanize(entity)} not found`, 404);

    const subject = entity === 'crime'
      ? data.incident.crime_number || data.incident.case_number || id
      : entity === 'criminal'
        ? data.criminal.criminal_number || data.criminal.full_name || id
        : data.officer.badge_number || data.officer.full_name || id;

    return {
      entity,
      subject,
      data,
      generatedAt: new Date(),
      frontendOrigin: process.env.FRONTEND_URL || req.get?.('origin') || null
    };
  },

  streamPdf(report, res) {
    return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: { Title: `${humanize(report.entity)} Report` } });
    const reportFileName = `${filename(report.entity)}-${filename(report.subject)}-report.pdf`;
    const pdfChunks = [];

    doc.on('data', (chunk) => pdfChunks.push(chunk));
    doc.once('error', reject);
    doc.once('end', () => {
      const pdf = Buffer.concat(pdfChunks);
      res.status(200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${reportFileName}"`);
      res.setHeader('Content-Length', String(pdf.length));
      res.setHeader('Cache-Control', 'no-store');
      res.end(pdf, resolve);
    });

    try {
      if (report.entity === 'criminal' || report.entity === 'officer' || report.entity === 'crime') {
        if (report.entity === 'criminal') renderCriminalReport(doc, report);
        else if (report.entity === 'officer') renderOfficerReport(doc, report);
        else renderCrimeReport(doc, report);
        const pages = doc.bufferedPageRange();
        for (let pageIndex = 0; pageIndex < pages.count; pageIndex += 1) {
          doc.switchToPage(pageIndex);
          doc.page.margins.bottom = 20;
          doc.font('Helvetica').fontSize(8).fillColor(REPORT_COLORS.muted)
            .text(`CrimeLens - Confidential - Page ${pageIndex + 1} of ${pages.count}`, 50, 800, { width: 495, align: 'center', lineBreak: false });
        }
      } else {
        doc.font('Helvetica-Bold').fontSize(20).fillColor('#163a5f').text(`${humanize(report.entity)} Report`);
        doc.font('Helvetica').fontSize(10).fillColor('#444444').text(`Subject: ${report.subject}`);
        doc.text(`Generated: ${report.generatedAt.toISOString()}`);
        doc.moveTo(50, doc.y + 8).lineTo(545, doc.y + 8).strokeColor('#a9bfd3').stroke();
        doc.moveDown(1);

        for (const [title, content] of reportSections(report.entity, report.data)) {
          writeSectionTitle(doc, title);
          if (report.entity === 'crime' && title === 'Evidence') {
            writeEvidenceRecords(doc, content);
          } else if (Array.isArray(content)) writeRecords(doc, content);
          else writeRecord(doc, content);
        }
      }
      doc.end();
    } catch (error) {
      doc.destroy(error);
    }
    });
  }
};
