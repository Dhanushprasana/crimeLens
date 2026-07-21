const logger = require("../../config/logger");

module.exports = {
  async getMe(dto, req) {
    if (!dto.email) throw new Error("Email is required");

    const catalystApp = req.catalyst;
    if (!catalystApp) throw new Error("Catalyst SDK not initialized");
    const zcql = catalystApp.zcql();

    let sysUserId = null;
    let sysUserInfoId = null;
    let roles = [];
    let userInfo = null;
    let catalystUserId = null;

    try {
      // Find user info by email
      const userInfoSql = `SELECT * FROM sys_user_info WHERE email = '${dto.email}'`;
      const userInfoRes = await zcql.executeZCQLQuery(userInfoSql);

      if (userInfoRes && userInfoRes.length > 0) {
        userInfo = userInfoRes[0].sys_user_info;
        sysUserInfoId = userInfo.ROWID;

        // Find sys_user by user_info_id
        const userSql = `SELECT * FROM sys_user WHERE user_info_id = '${sysUserInfoId}'`;
        const userRes = await zcql.executeZCQLQuery(userSql);

        if (userRes && userRes.length > 0) {
          sysUserId = userRes[0].sys_user.ROWID;
          catalystUserId = userRes[0].sys_user.catalyst_user_id;

          // Get roles
          const urSql = `SELECT * FROM sys_user_role WHERE user_id = '${sysUserId}'`;
          const urRes = await zcql.executeZCQLQuery(urSql);
          if (urRes && urRes.length > 0) {
            const roleIds = urRes.map(item => `'${item.sys_user_role.role_id}'`).join(',');
            const roleSql = `SELECT * FROM sys_role WHERE ROWID IN (${roleIds})`;
            const roleRes = await zcql.executeZCQLQuery(roleSql);
            roles = roleRes.map(r => ({ id: r.sys_role.ROWID, name: r.sys_role.role_name }));
          }
        }
      } else {
        throw new Error("User not found");
      }
    } catch (err) {
      logger.warn(`Failed to fetch user by email ${dto.email}: ${err.message}`);
      throw err;
    }

    return {
      user: {
        email_id: userInfo.email,
        first_name: userInfo.user_first_name,
        last_name: userInfo.user_last_name,
        user_id: catalystUserId
      },
      sys_user_id: sysUserId,
      user_info_id: sysUserInfoId,
      roles: roles
    };
  },

  async logOut(dto, req) {
    const catalystApp = req.catalyst || catalyst.initialize(req);
    await catalystApp.userManagement().signOut();
    return { message: "Logged out" };
  },
};