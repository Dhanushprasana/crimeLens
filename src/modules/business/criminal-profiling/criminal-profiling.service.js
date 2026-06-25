'use strict';

const repository = require('./criminal-profiling.repository');
const logger = require('../../../config/logger');
const env = require('../../../config/env');

// Weight maps
const BEHAVIORAL_WEIGHTS = {
  'Violent': 20,
  'Armed': 15,
  'Flight Risk': 15,
  'Drug Dealer': 10,
  'Repeat Offender': 20,
  'Gang Member': 25,
  'Cyber Criminal': 15,
  'Financial Fraudster': 15
};

const SEVERITY_WEIGHTS = {
  'Theft': 10,
  'Fraud': 15,
  'Assault': 25,
  'Robbery': 40,
  'Murder': 60,
  'Terror Related': 100
};

module.exports = {
  async generateProfile(criminalId, req) {
    logger.info(`generateProfile ${criminalId}`);

    // Step 3: Load all intelligence data
    const criminal =
      await repository.getCriminal(
        criminalId,
        req
      );

    const incidents =
      await repository.getCriminalIncidents(
        criminalId,
        req
      );
    const incidentIds = incidents.map(
      i => i.incident_id
    );

    const incidentDetails =
      await repository.getIncidentDetails(
        incidentIds,
        req
      );

    const associates =
      await repository.getAssociatedCriminals(
        incidentIds,
        criminalId,
        req
      );

    const phones =
      await repository.getPhoneNumbers(
        criminalId,
        req
      );

    const vehicles =
      await repository.getVehicles(
        criminalId,
        req
      );

    const behavioralFlags =
      await repository.getBehavioralFlags(
        criminalId,
        req
      );

    // Fetch crime categories to resolve names
    const allCategories = await repository.getAllCrimeCategories(req);
    const categoryMap = {};
    (allCategories || []).forEach(cat => {
      if (cat && cat.ROWID && cat.crime_category_name) {
        categoryMap[cat.ROWID] = cat.crime_category_name;
      }
    });

    // Step 4: Intelligence Metrics
    const crimeFrequency =
      incidentDetails.length;

    const associateCount =
      associates.length;

    const phoneCount =
      phones.length;

    const vehicleCount =
      vehicles.length;

    logger.info(
      `Intelligence loaded for ${criminalId}`,
      {
        crimeFrequency,
        associateCount,
        phoneCount,
        vehicleCount,
        behavioralFlags: behavioralFlags.length
      }
    );

    // Step 5: Behavioral Score
    let behavioralScore = 0;
    behavioralFlags.forEach(flag => {
      const flagType = flag.flag_type;
      const weight =
        BEHAVIORAL_WEIGHTS[flagType] || 0;
      behavioralScore += weight;
    });

    // Step 6: Crime Severity Score
    const categoryFrequency = {};
    incidentDetails.forEach(i => {
      const category =
        i.crime_category_name ||
        i.crime_category ||
        categoryMap[i.crime_category_id];

      if (!category) return;

      categoryFrequency[category] =
        (categoryFrequency[category] || 0) + 1;
    });

    let severityScore = 0;
    const categoryEntries =
      Object.entries(categoryFrequency);

    if (categoryEntries.length > 0) {
      const totalWeight = categoryEntries.reduce(
        (sum, [cat, count]) => {
          const weight =
            SEVERITY_WEIGHTS[cat] || 0;
          return sum + (weight * count);
        },
        0
      );

      severityScore = Math.round(
        totalWeight / crimeFrequency
      );
    }

    // primaryCrimeType: most frequent category
    let primaryCrimeType = null;
    if (categoryEntries.length > 0) {
      categoryEntries.sort(
        (a, b) => b[1] - a[1]
      );
      primaryCrimeType = categoryEntries[0][0];
    }

    // Step 7: District Intelligence
    const districtFrequency = {};
    incidentDetails.forEach(i => {
      const districtId =
        i.crime_happended_at_district_id;

      if (!districtId) return;

      districtFrequency[districtId] =
        (districtFrequency[districtId] || 0) + 1;
    });

    let primaryDistrictId = null;
    let districtName = null;
    const districtSpread =
      Object.keys(districtFrequency).length;

    const districtEntries =
      Object.entries(districtFrequency);

    if (districtEntries.length > 0) {
      districtEntries.sort(
        (a, b) => b[1] - a[1]
      );

      primaryDistrictId = districtEntries[0][0];

      try {
        const district =
          await repository.getDistrictById(
            primaryDistrictId,
            req
          );

        districtName = district
          ? district.district_name
          : 'Unknown District';
      } catch (err) {
        logger.warn(
          `Failed to resolve district ${primaryDistrictId}`,
          { error: err.message }
        );
        districtName = 'Unknown District';
      }
    }

    // Step 8: Temporal Intelligence
    let lastActivityDate = null;
    const incidentYears = [];

    incidentDetails.forEach(i => {
      const dateVal = i.crime_occured_date_time;
      if (!dateVal) return;

      const d = new Date(dateVal);
      incidentYears.push(d.getFullYear());

      if (
        !lastActivityDate ||
        d > new Date(lastActivityDate)
      ) {
        lastActivityDate = dateVal;
      }
    });

    let activeYears = 0;
    if (incidentYears.length > 0) {
      const oldest = Math.min(...incidentYears);
      const currentYear =
        new Date().getFullYear();
      activeYears = currentYear - oldest;
      if (activeYears < 1) activeYears = 1;
    }

    // Escalation Trend
    let escalationTrend = 0;
    if (incidentYears.length > 0) {
      const currentYear =
        new Date().getFullYear();
      const prevYear = currentYear - 1;

      const currentYearCount =
        incidentYears.filter(
          y => y === currentYear
        ).length;

      const prevYearCount =
        incidentYears.filter(
          y => y === prevYear
        ).length;

      if (prevYearCount > 0) {
        escalationTrend = Math.round(
          ((currentYearCount - prevYearCount) /
            prevYearCount) * 100
        ) / 100;
      } else if (currentYearCount > 0) {
        escalationTrend = 1;
      }
    }

    // Step 9: Network Intelligence
    const rawNetwork =
      (associateCount * 3) +
      (vehicleCount * 2) +
      phoneCount;

    const networkStrength =
      Math.min(rawNetwork, 100);

    // Step 10: Risk Score Engine
    let repeatOffenderScore = 0;
    if (crimeFrequency > 20) {
      repeatOffenderScore = 40;
    } else if (crimeFrequency >= 11) {
      repeatOffenderScore = 30;
    } else if (crimeFrequency >= 6) {
      repeatOffenderScore = 20;
    } else if (crimeFrequency >= 3) {
      repeatOffenderScore = 10;
    }

    const associateScore =
      Math.min(associateCount * 2, 30);

    const vehicleScore =
      Math.min(vehicleCount * 2, 20);

    const phoneScore =
      Math.min(phoneCount, 10);

    const rawRisk =
      repeatOffenderScore +
      severityScore +
      behavioralScore +
      associateScore +
      vehicleScore +
      phoneScore;

    const riskScore = Math.min(rawRisk, 100);

    // Step 11: Threat Level
    let threatLevel = 'LOW';
    if (riskScore >= 76) {
      threatLevel = 'CRITICAL';
    } else if (riskScore >= 51) {
      threatLevel = 'HIGH';
    } else if (riskScore >= 26) {
      threatLevel = 'MEDIUM';
    }

    // Step 12: Profile Type
    let profileType = 'Low-Level Offender';
    if (crimeFrequency >= 20) {
      profileType = 'Career Criminal';
    } else if (associateCount >= 10) {
      profileType = 'Gang Associate';
    } else if (crimeFrequency >= 5) {
      profileType = 'Repeat Offender';
    }

    // Step 14: Profile Summary
    const districtPhrase = districtName
      ? ` primarily active in ${districtName} district`
      : '';

    const crimePhrase = primaryCrimeType
      ? ` with ${primaryCrimeType} as primary offense`
      : '';

    const profileSummary =
      `${profileType}${districtPhrase}${crimePhrase}. ` +
      `Associated with ${associateCount} ` +
      `known offender${associateCount !== 1 ? 's' : ''} ` +
      `and linked to ${crimeFrequency} ` +
      `incident${crimeFrequency !== 1 ? 's' : ''}. ` +
      `Threat level: ${threatLevel}.`;

    logger.info(
      `Profile calculated for ${criminalId}`,
      {
        profileType,
        riskScore,
        threatLevel,
        crimeFrequency,
        associateCount,
        activeYears,
        behavioralScore,
        severityScore,
        networkStrength,
        escalationTrend
      }
    );

    // Task 1: Implement profileConfidence
    const profileConfidence = Math.min(
      (
        crimeFrequency * 2 +
        associateCount +
        phoneCount +
        vehicleCount +
        behavioralFlags.length * 5
      ),
      100
    );
    logger.info({
      networkStrength,
      districtSpread,
      escalationTrend,
      profileConfidence,
      phoneCount,
      vehicleCount,
      associateCount,
      crimeFrequency
    });
    // Build profile data
    const profileData = {
      criminal_id: criminalId,
      risk_score: riskScore,
      threat_level: threatLevel,
      crime_frequency: crimeFrequency,
      active_years: activeYears,
      primary_crime_type: primaryCrimeType,
      profile_summary: profileSummary,
      profile_type: profileType,
      associate_count: associateCount,
      primary_district: primaryDistrictId,
      last_activity_date: lastActivityDate,
      // Task 2: Include additional metrics in profileData
      network_strength: networkStrength,
      district_spread: districtSpread,
      escalation_trend: escalationTrend,
      profile_confidence: profileConfidence
    };

    // Task 4: Add temporary logs before persistence
    logger.info('TEMPORARY LOGS BEFORE PERSISTENCE:', {
      districtSpread,
      networkStrength,
      escalationTrend,
      profileConfidence
    });

    // Persist profile
    const existingProfile =
      await repository.getProfileByCriminalId(
        criminalId,
        req
      );

    let profileId;

    if (existingProfile) {
      profileId = existingProfile.ROWID;

      await repository.updateProfile(
        profileId,
        profileData,
        req
      );
    } else {
      const created =
        await repository.createProfile(
          profileData,
          req
        );
      profileId = created.id;
    }

    // Step 13: Risk Explainability
    const riskFactors = [];

    if (crimeFrequency >= 5) {
      riskFactors.push({
        factor_name: 'Repeat Offender',
        factor_score: repeatOffenderScore,
        factor_description:
          `Linked to ${crimeFrequency} criminal incidents indicating repeat criminal behavior.`
      });
    }

    if (behavioralFlags.some(
      f => f.flag_type === 'Violent' ||
           f.flag_type === 'Armed'
    )) {
      riskFactors.push({
        factor_name: 'Violent History',
        factor_score: behavioralScore,
        factor_description:
          `Flagged with violent or armed behavioral indicators.`
      });
    }

    if (associateCount >= 5) {
      riskFactors.push({
        factor_name: 'Gang Association',
        factor_score: associateScore,
        factor_description:
          `Associated with ${associateCount} known criminals across shared incidents.`
      });
    }

    if (networkStrength >= 20) {
      riskFactors.push({
        factor_name: 'Large Criminal Network',
        factor_score: networkStrength,
        factor_description:
          `Operates a network spanning ${associateCount} associates, ${vehicleCount} vehicles, and ${phoneCount} phone numbers.`
      });
    }

    if (severityScore >= 25) {
      riskFactors.push({
        factor_name: 'High Severity Crimes',
        factor_score: severityScore,
        factor_description:
          `Involved in high-severity crimes with average severity score of ${severityScore}.`
      });
    }

    // Delete existing and save new risk factors
    try {
      await repository.deleteRiskFactors(
        profileId,
        req
      );
    } catch (err) {
      logger.warn(
        `Failed to delete old risk factors`,
        { error: err.message }
      );
    }

    if (riskFactors.length > 0) {
      await repository.saveRiskFactors(
        profileId,
        riskFactors,
        req
      );
    }

    logger.info(
      `Risk factors saved for ${criminalId}`,
      { count: riskFactors.length }
    );

    return {
      message: existingProfile
        ? 'Profile regenerated'
        : 'Profile generated',
      criminal,
      profile: profileData,
      riskFactors
    };
  },

  async getProfile(criminalId, req) {
    logger.info(`getProfile ${criminalId}`);

    const profile = await repository.getProfileByCriminalId(
      criminalId,
      req
    );

    if (!profile) {
      return null;
    }

    // 1. Get criminal details (name, gender, nationality, criminal_number, age)
    let criminalName = null;
    let gender = null;
    let nationality = null;
    let criminalNumber = null;
    let age = null;
    try {
      const criminal = await repository.getCriminal(criminalId, req);
      if (criminal) {
        criminalName = criminal.full_name || criminal.name || null;
        gender = criminal.gender || null;
        nationality = criminal.nationality || null;
        criminalNumber = criminal.criminal_number || null;
        
        if (criminal.date_of_birth) {
          const dob = new Date(criminal.date_of_birth);
          if (!isNaN(dob.getTime())) {
            const diffMs = Date.now() - dob.getTime();
            age = Math.abs(new Date(diffMs).getUTCFullYear() - 1970);
          }
        }
      }
    } catch (err) {
      logger.warn(`Failed to fetch criminal ${criminalId} for getProfile`, { error: err.message });
    }

    // 1b. Get criminal aliases from TABLE_CRIMINAL_ALIAS
    let aliases = [];
    try {
      const aliasRows = await repository.getCriminalAliases(criminalId, req);
      aliases = (aliasRows || []).map(row => row.alias_name || row.alias || row.name || row).filter(Boolean);
    } catch (err) {
      logger.warn(`Failed to fetch aliases for criminal ${criminalId}`, { error: err.message });
    }

    // 2. Get primary district name
    let districtName = null;
    if (profile.primary_district) {
      try {
        const district = await repository.getDistrictById(profile.primary_district, req);
        districtName = district ? district.district_name : null;
      } catch (err) {
        logger.warn(`Failed to fetch district ${profile.primary_district} for getProfile`, { error: err.message });
      }
    }

    // 3. Get associated incidents & details
    let incidentDetails = [];
    try {
      const incidents = await repository.getCriminalIncidents(criminalId, req);
      const incidentIds = incidents.map(i => i.incident_id);
      const rawIncidents = await repository.getIncidentDetails(incidentIds, req);
      
      const allCategories = await repository.getAllCrimeCategories(req);
      const categoryMap = {};
      (allCategories || []).forEach(cat => {
        if (cat && cat.ROWID && cat.crime_category_name) {
          categoryMap[cat.ROWID] = cat.crime_category_name;
        }
      });

      incidentDetails = rawIncidents.map(inc => ({
        ...inc,
        crime_category_name: inc.crime_category_name || inc.crime_category || categoryMap[inc.crime_category_id] || null
      }));
    } catch (err) {
      logger.warn(`Failed to fetch incident details for criminal ${criminalId}`, { error: err.message });
    }

    // 4. Resolve unique district names the criminal is associated with
    const associatedDistrictIds = [...new Set(
      incidentDetails
        .map(i => i.crime_happended_at_district_id)
        .filter(Boolean)
    )];

    const associatedDistrictNames = [];
    for (const dId of associatedDistrictIds) {
      try {
        const dist = await repository.getDistrictById(dId, req);
        if (dist && dist.district_name) {
          associatedDistrictNames.push(dist.district_name);
        }
      } catch (err) {
        logger.warn(`Failed to resolve district name for ${dId}`, { error: err.message });
      }
    }

    // 4b. Get intelligence metrics to reconstruct the risk factors considered
    let phones = [];
    let vehicles = [];
    let behavioralFlags = [];
    let associates = [];
    try {
      phones = await repository.getPhoneNumbers(criminalId, req);
      vehicles = await repository.getVehicles(criminalId, req);
      behavioralFlags = await repository.getBehavioralFlags(criminalId, req);
      
      const incidents = await repository.getCriminalIncidents(criminalId, req);
      const incidentIds = incidents.map(i => i.incident_id);
      associates = await repository.getAssociatedCriminals(incidentIds, criminalId, req);
    } catch (err) {
      logger.warn(`Failed to fetch intelligence metrics for risk score considerations`, { error: err.message });
    }

    const crimeFrequency = incidentDetails.length;
    const associateCount = associates.length;
    const phoneCount = phones.length;
    const vehicleCount = vehicles.length;

    // Calculate sub-scores considered
    let repeatOffenderScore = 0;
    if (crimeFrequency > 20) {
      repeatOffenderScore = 40;
    } else if (crimeFrequency >= 11) {
      repeatOffenderScore = 30;
    } else if (crimeFrequency >= 6) {
      repeatOffenderScore = 20;
    } else if (crimeFrequency >= 3) {
      repeatOffenderScore = 10;
    }

    const associateScore = Math.min(associateCount * 2, 30);
    const vehicleScore = Math.min(vehicleCount * 2, 20);
    const phoneScore = Math.min(phoneCount, 10);

    let behavioralScore = 0;
    (behavioralFlags || []).forEach(flag => {
      const flagType = flag.flag_type;
      const weight = BEHAVIORAL_WEIGHTS[flagType] || 0;
      behavioralScore += weight;
    });

    // Severity Score
    const categoryFrequency = {};
    incidentDetails.forEach(i => {
      const category = i.crime_category_name || i.crime_category;
      if (!category) return;
      categoryFrequency[category] = (categoryFrequency[category] || 0) + 1;
    });

    let severityScore = 0;
    const categoryEntries = Object.entries(categoryFrequency);
    if (categoryEntries.length > 0) {
      const totalWeight = categoryEntries.reduce(
        (sum, [cat, count]) => {
          const weight = SEVERITY_WEIGHTS[cat] || 0;
          return sum + (weight * count);
        },
        0
      );
      severityScore = Math.round(totalWeight / crimeFrequency);
    }

    // 5. Get risk factors explaining the risk score
    let riskFactors = [];
    try {
      riskFactors = await repository.getRiskFactors(profile.ROWID, req);
    } catch (err) {
      logger.warn(`Failed to fetch risk factors for profile ${profile.ROWID}`, { error: err.message });
    }

    // Return extended profile payload
    return {
      ...profile,
      criminal_name: criminalName,
      gender: gender,
      nationality: nationality,
      criminal_number: criminalNumber,
      age: age,
      aliases: aliases,
      district_name: districtName,
      districts: associatedDistrictNames,
      crime_incidents: incidentDetails,
      risk_factors: riskFactors,
      // Risk score breakdown showing what is considered
      risk_score_breakdown: {
        repeat_offender_score: repeatOffenderScore,
        severity_score: severityScore,
        behavioral_score: behavioralScore,
        associate_score: associateScore,
        vehicle_score: vehicleScore,
        phone_score: phoneScore
      }
    };
  },

  async getRiskFactors(criminalId, req) {
    logger.info(
      `getRiskFactors ${criminalId}`
    );

    const profile =
      await repository.getProfileByCriminalId(
        criminalId,
        req
      );

    if (!profile) {
      return { profile: null, riskFactors: [] };
    }

    const riskFactors =
      await repository.getRiskFactors(
        profile.ROWID,
        req
      );

    return { profile, riskFactors };
  }
};