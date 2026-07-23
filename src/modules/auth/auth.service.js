const logger = require("../../config/logger");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

function catalystDateTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

module.exports = {
  async login(dto, req) {
    if (!dto.email || !dto.password) throw new Error("Email and password are required");

    const zcql = req.catalyst.zcql();
    const normalizedEmail = dto.email.trim().toLowerCase();
    
    // 1. Fetch user info
    const userInfoRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user_info WHERE email = '${normalizedEmail}'`);
    if (!userInfoRes || userInfoRes.length === 0) {
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
    }
    const userInfo = userInfoRes[0].sys_user_info;
    const sysUserInfoId = userInfo.ROWID;

    // 2. Fetch sys_user
    const userRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user WHERE user_info_id = '${sysUserInfoId}'`);
    if (!userRes || userRes.length === 0) {
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
    }
    const sysUser = userRes[0].sys_user;
    if (sysUser.is_archived === true || sysUser.is_archived === "true") {
      throw Object.assign(new Error("User deactivated. Cannot login!"), { statusCode: 409 });
    }
    const sysUserId = sysUser.ROWID;

    // 3. Fetch password
    const pwdRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_password WHERE user_id = '${sysUserId}'`);
    if (!pwdRes || pwdRes.length === 0) {
      throw Object.assign(new Error("Invalid credentials or user not onboarded"), { statusCode: 401 });
    }
    const hashedPwd = pwdRes[0].sys_password.password;

    // 4. Verify password
    const isMatch = await bcrypt.compare(dto.password, hashedPwd);
    if (!isMatch) {
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
    }

    // 5. Get Roles
    let roles = [];
    const urRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user_role WHERE user_id = '${sysUserId}'`);
    if (urRes && urRes.length > 0) {
      const roleIds = urRes.map(item => `'${item.sys_user_role.role_id}'`).join(',');
      const roleRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_role WHERE ROWID IN (${roleIds})`);
      roles = roleRes.map(r => r.sys_role.role_name);
    }
    const roleName = roles[0] || "";

    // 6. Generate Tokens & Session
    const sessionId = require("crypto").randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const secret = process.env.JWT_SECRET || "default_secret";

    const refreshTokenValue = jwt.sign({ sub: sysUserId, sessionId }, secret, { expiresIn: '7d' });
    const accessToken = jwt.sign({ sub: sysUserId, email: normalizedEmail, role: roleName }, secret, { expiresIn: '15m' });

    // 7. Save to Datastore
    const datastore = req.catalyst.datastore();
    
    const rtTable = datastore.table("sys_refresh_token");
    const rtRow = await rtTable.insertRow({
      refresh_token: refreshTokenValue,
      issued_at: catalystDateTime(now),
      expires_at: catalystDateTime(expiresAt)
    });

    const sessionTable = datastore.table("sys_session");
    const sessionRow = await sessionTable.insertRow({
      session_id: sessionId,
      session_initiated_at: catalystDateTime(now),
      expires_at: catalystDateTime(expiresAt),
      refresh_token_id: rtRow.ROWID
    });

    const userSessionTable = datastore.table("sys_user_session");
    await userSessionTable.insertRow({
      user_id: sysUserId,
      session_id: sessionRow.ROWID,
      refresh_token_id: rtRow.ROWID
    });

    return { accessToken, refreshToken: refreshTokenValue, sessionId };
  },

  async refreshTokens(dto, req) {
    if (!dto.sessionId || !dto.refreshToken) {
      throw Object.assign(new Error("sessionId and refreshToken required"), { statusCode: 400 });
    }
    
    const zcql = req.catalyst.zcql();
    const tokenRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_refresh_token WHERE refresh_token = '${dto.refreshToken}'`);
    if (!tokenRes || tokenRes.length === 0) {
      throw Object.assign(new Error("Invalid refresh token"), { statusCode: 401 });
    }
    const rtRow = tokenRes[0].sys_refresh_token;

    // Check expiry
    if (new Date(rtRow.expires_at) < new Date()) {
      throw Object.assign(new Error("Refresh token expired"), { statusCode: 401 });
    }
    
    // Check session
    const sessionRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_session WHERE session_id = '${dto.sessionId}' AND refresh_token_id = '${rtRow.ROWID}'`);
    if (!sessionRes || sessionRes.length === 0) {
      throw Object.assign(new Error("Invalid session"), { statusCode: 401 });
    }
    const sessionRow = sessionRes[0].sys_session;
    
    if (sessionRow.session_logout_at) {
      throw Object.assign(new Error("Session has been logged out"), { statusCode: 401 });
    }

    // Lookup user to sign new token
    const usRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user_session WHERE session_id = '${sessionRow.ROWID}'`);
    if (!usRes || usRes.length === 0) throw Object.assign(new Error("Invalid user session"), { statusCode: 401 });
    const sysUserId = usRes[0].sys_user_session.user_id;

    // Get user details for token
    const userRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user WHERE ROWID = '${sysUserId}'`);
    if (userRes[0].sys_user.is_archived === true || userRes[0].sys_user.is_archived === "true") {
      throw Object.assign(new Error("User is deactivated"), { statusCode: 401 });
    }
    const userInfoId = userRes[0].sys_user.user_info_id;
    const uiRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user_info WHERE ROWID = '${userInfoId}'`);
    const email = uiRes[0].sys_user_info.email;

    // Get Roles
    let roleName = "";
    const urRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user_role WHERE user_id = '${sysUserId}'`);
    if (urRes && urRes.length > 0) {
      const roleId = urRes[0].sys_user_role.role_id;
      const roleRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_role WHERE ROWID = '${roleId}'`);
      if(roleRes && roleRes.length > 0) roleName = roleRes[0].sys_role.role_name;
    }

    const secret = process.env.JWT_SECRET || "default_secret";
    const newAccessToken = jwt.sign({ sub: sysUserId, email, role: roleName }, secret, { expiresIn: '15m' });

    return { accessToken: newAccessToken };
  },

  async logOut(dto, req) {
    if (!dto.sessionId) throw new Error("sessionId is required");
    const zcql = req.catalyst.zcql();
    
    const sessionRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_session WHERE session_id = '${dto.sessionId}'`);
    if (!sessionRes || sessionRes.length === 0) {
       throw Object.assign(new Error("Session not found"), { statusCode: 404 });
    }
    const session = sessionRes[0].sys_session;

    if (session.session_logout_at) {
      throw Object.assign(new Error("Session already expired"), { statusCode: 400 });
    }

    const datastore = req.catalyst.datastore();
    const sessionTable = datastore.table("sys_session");
    
    await sessionTable.updateRow({
      ROWID: session.ROWID,
      session_logout_at: catalystDateTime()
    });

    return { message: "Logged out successfully" };
  },

  async getMe(dto, req) {
    const userParam = dto.user;
    if (!userParam || !userParam.sub) throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    
    const zcql = req.catalyst.zcql();
    const sysUserId = userParam.sub;
    
    const userRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user WHERE ROWID = '${sysUserId}'`);
    if (!userRes || userRes.length === 0) throw Object.assign(new Error("User not found"), { statusCode: 404 });
    const sysUser = userRes[0].sys_user;
    const sysUserInfoId = sysUser.user_info_id;

    const userInfoRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user_info WHERE ROWID = '${sysUserInfoId}'`);
    const userInfo = userInfoRes[0].sys_user_info;
    
    if (userInfo.station_id) {
      try {
        const stationRes = await zcql.executeZCQLQuery(`SELECT district_id FROM biz_police_station WHERE ROWID = '${userInfo.station_id}'`);
        if (stationRes && stationRes.length > 0) {
          userInfo.district_id = stationRes[0].biz_police_station.district_id;
        }
      } catch(e) {
        // Handle gracefully if table missing or field differs
      }
    }
    
    let roles = [];
    const urRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_user_role WHERE user_id = '${sysUserId}'`);
    if (urRes && urRes.length > 0) {
      const roleIds = urRes.map(item => `'${item.sys_user_role.role_id}'`).join(',');
      const roleRes = await zcql.executeZCQLQuery(`SELECT * FROM sys_role WHERE ROWID IN (${roleIds})`);
      roles = roleRes.map(r => ({ id: r.sys_role.ROWID, name: r.sys_role.role_name }));
    }

    return {
      user: {
        email_id: userInfo.email,
        first_name: userInfo.user_first_name,
        last_name: userInfo.user_last_name,
      },
      user_info: userInfo,
      sys_user_id: sysUserId,
      user_info_id: sysUserInfoId,
      roles: roles
    };
  },
};