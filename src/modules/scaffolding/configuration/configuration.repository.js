'use strict';

const env = require('../../../config/env');
const crypto = require('../../../common/helpers/crypto');
const logger = require('../../../config/logger');

// Helper to query Catalyst ZCQL
async function executeQuery(req, query) {
  if (!req.catalyst) {
    throw new Error('Catalyst SDK is not initialized in request');
  }
  const zcql = req.catalyst.zcql();
  return await zcql.executeZCQLQuery(query);
}

// Helper to get Catalyst Table
function getTable(req, tableName) {
  if (!req.catalyst) {
    throw new Error('Catalyst SDK is not initialized in request');
  }
  return req.catalyst.datastore().table(tableName);
}

module.exports = {
  async upsertConfig(dto, email, req) {
    const encryptedConfig = {};

    // Encrypt config properties using the ENCRYPTION_KEY/IV-based crypto service
    for (const [key, value] of Object.entries(dto.config)) {
      if (dto.name === 'email' && key === 'smtpPort') {
        const smtpPort = typeof value === 'number' ? value : parseInt(value, 10);
        const secure = smtpPort === 465 ? 'true' : 'false';

        encryptedConfig.smtpPort = crypto.encrypt(smtpPort.toString());
        encryptedConfig.secure = crypto.encrypt(secure);
      } else {
        encryptedConfig[key] = crypto.encrypt(String(value));
      }
    }

    if (dto.name === 'branding') {
      if (!email) {
        throw new Error('email is required for user branding configurations');
      }

      // Resolve userId from email via sys_user_info and sys_user tables
      const userIdQuery = `SELECT ROWID FROM ${env.TABLE_USER} WHERE user_info_id = (SELECT ROWID FROM ${env.TABLE_USER_INFO} WHERE email = '${email}')`;
      const userIdResult = await executeQuery(req, userIdQuery);
      if (!userIdResult || userIdResult.length === 0) {
        throw new Error(`User not found for email: ${email}`);
      }
      const userId = userIdResult[0][env.TABLE_USER].ROWID;
      // Now fetch the user's sys_user record using the resolved userId
      const userQuery = `SELECT * FROM ${env.TABLE_USER} WHERE ROWID = '${userId}'`;
      const userResult = await executeQuery(req, userQuery);
      const userRow = userResult[0][env.TABLE_USER];
      const userConfigId = userRow.user_configuration_id;

      const userTable = getTable(req, env.TABLE_USER);
      const userConfigTable = getTable(req, env.TABLE_USER_CONFIGURATION);

      if (!userConfigId) {
        // Create new sys_user_configuration record
        const savedConfig = await userConfigTable.insertRow({
          branding: JSON.stringify(encryptedConfig)
        });

        // Link sys_user to this configuration
        await userTable.updateRow({
          ROWID: userId,
          user_configuration_id: savedConfig.ROWID
        });

        return { message: 'User branding created successfully' };
      } else {
        // Update branding on the existing sys_user_configuration record
        await userConfigTable.updateRow({
          ROWID: userConfigId,
          branding: JSON.stringify(encryptedConfig)
        });

        return { message: 'User branding updated successfully' };
      }
    } else {
      // Configuration table updates using sys_configuration table:
      // Column mappings: config_name -> dto.name, config -> JSON string
      const checkConfigQuery = `SELECT * FROM ${env.TABLE_CONFIGURATION} WHERE config_name = '${dto.name}'`;
      const checkResult = await executeQuery(req, checkConfigQuery);

      const configTable = getTable(req, env.TABLE_CONFIGURATION);

      if (checkResult && checkResult.length > 0) {
        const existing = checkResult[0][env.TABLE_CONFIGURATION];
        await configTable.updateRow({
        ROWID: existing.ROWID,
          config: JSON.stringify(encryptedConfig)
        });
        return { message: `Configuration '${dto.name}' updated successfully` };
      } else {
        await configTable.insertRow({
          config_name: dto.name,
          config: JSON.stringify(encryptedConfig)
        });
        return { message: `Configuration '${dto.name}' created successfully` };
      }
    }
  },

  async getConfig(name, email, req) {
    let rawConfig = null;

    if (name === 'branding' && email) {
      // Resolve userId from email
      const userIdQuery = `SELECT ROWID FROM ${env.TABLE_USER} WHERE user_info_id = (SELECT ROWID FROM ${env.TABLE_USER_INFO} WHERE email = '${email}')`;
      const userIdResult = await executeQuery(req, userIdQuery);
      if (!userIdResult || userIdResult.length === 0) {
        throw new Error(`User not found for email: ${email}`);
      }
      const userId = userIdResult[0][env.TABLE_USER].ROWID;
      // Fetch user configuration via user_configuration_id mapping
      const userQuery = `SELECT * FROM ${env.TABLE_USER} WHERE ROWID = '${userId}'`;
      const userResult = await executeQuery(req, userQuery);
      if (userResult && userResult.length > 0) {
        const userRow = userResult[0][env.TABLE_USER];
        const userConfigId = userRow.user_configuration_id;
        if (userConfigId) {
          const configQuery = `SELECT * FROM ${env.TABLE_USER_CONFIGURATION} WHERE ROWID = '${userConfigId}'`;
          const configResult = await executeQuery(req, configQuery);
          if (configResult && configResult.length > 0) {
            const brandingStr = configResult[0][env.TABLE_USER_CONFIGURATION].branding;
            if (brandingStr) {
              rawConfig = JSON.parse(brandingStr);
            }
          }
        }
      }
    } else {
      const checkConfigQuery = `SELECT * FROM ${env.TABLE_CONFIGURATION} WHERE config_name = '${name}'`;
      const checkResult = await executeQuery(req, checkConfigQuery);
      if (!checkResult || checkResult.length === 0) {
        throw new Error(`Configuration '${name}' not found`);
      }
      const configStr = checkResult[0][env.TABLE_CONFIGURATION].config;
      if (configStr) {
        rawConfig = JSON.parse(configStr);
      }
    }

    if (!rawConfig) {
      return {};
    }

    // Decrypt configurations
    const decrypted = {};
    for (const [key, value] of Object.entries(rawConfig)) {
      decrypted[key] = crypto.decrypt(value);
    }

    if (name === 'email') {
      if (decrypted.smtpPort) decrypted.smtpPort = parseInt(decrypted.smtpPort, 10);
      if (decrypted.secure) decrypted.secure = decrypted.secure === 'true';
    }

    return decrypted;
  },

  async getAllConfigs(email, req) {
    const configQuery = `SELECT * FROM ${env.TABLE_CONFIGURATION}`;
    const configsResult = await executeQuery(req, configQuery);
    const result = [];

    for (const row of configsResult) {
      const configItem = row[env.TABLE_CONFIGURATION];
      const rawConfig = configItem.config ? JSON.parse(configItem.config) : {};
      const decrypted = {};

      for (const [key, value] of Object.entries(rawConfig)) {
        decrypted[key] = crypto.decrypt(value);
      }

      result.push({
        name: configItem.config_name,
        config: decrypted
      });
    }

    // Merge in user specific branding if it exists
    if (email) {
      // Resolve userId from email if provided
      const userIdQuery = `SELECT ROWID FROM ${env.TABLE_USER} WHERE user_info_id = (SELECT ROWID FROM ${env.TABLE_USER_INFO} WHERE email = '${email}')`;
      const userIdResult = await executeQuery(req, userIdQuery);
      const userId = (userIdResult && userIdResult.length > 0) ? userIdResult[0][env.TABLE_USER].ROWID : null;
      if (userId) {
      const userQuery = `SELECT * FROM ${env.TABLE_USER} WHERE ROWID = '${userId}'`;
      const userResult = await executeQuery(req, userQuery);
      if (userResult && userResult.length > 0) {
        const userRow = userResult[0][env.TABLE_USER];
        const userConfigId = userRow.user_configuration_id;
        if (userConfigId) {
          const configQuery = `SELECT * FROM ${env.TABLE_USER_CONFIGURATION} WHERE ROWID = '${userConfigId}'`;
          const configResult = await executeQuery(req, configQuery);
          if (configResult && configResult.length > 0) {
            const brandingStr = configResult[0][env.TABLE_USER_CONFIGURATION].branding;
            if (brandingStr) {
              const rawBranding = JSON.parse(brandingStr);
              const branding = {};
              for (const [key, value] of Object.entries(rawBranding)) {
                branding[key] = crypto.decrypt(value);
              }
              result.push({
                name: 'branding',
                config: branding
              });
            }
          }
        }
      }
    }

    return result;
  }
}
}
