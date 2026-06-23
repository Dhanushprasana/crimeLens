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
        i.crime_category;

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
      last_activity_date: lastActivityDate
    };

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

    return repository.getProfileByCriminalId(
      criminalId,
      req
    );
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