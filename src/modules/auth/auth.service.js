const logger = require("../../config/logger");

module.exports = {
  async getMe(dto, req) {
    const catalystApp = req.catalyst;
    if (!catalystApp) throw new Error("Catalyst SDK not initialized");
    
    const catalystUser = await catalystApp.userManagement().getCurrentUser();
    
    if (!catalystUser) {
      throw new Error("No user is currently logged in.");
    }
    
    const catalystUserId = 
      catalystUser.user_details?.user_id || 
      catalystUser.user_details?.zuid || 
      catalystUser.user_id || 
      catalystUser.id || 
      catalystUser.zuid || 
      catalystUser.USER_ID || 
      catalystUser.user?.id || 
      catalystUser.user?.user_id || 
      null;

    let sysUserId = null;
    let sysUserInfoId = null;
    let roles = [];

    if (catalystUserId) {
      try {
        const zcql = catalystApp.zcql();
        const sql = `SELECT * FROM sys_user WHERE catalyst_user_id = '${catalystUserId}'`;
        const res = await zcql.executeZCQLQuery(sql);
        if (res && res.length > 0) {
          sysUserId = res[0].sys_user.ROWID;
          sysUserInfoId = res[0].sys_user.user_info_id;
          
          // Optionally get roles
          const urSql = `SELECT * FROM sys_user_role WHERE user_id = '${sysUserId}'`;
          const urRes = await zcql.executeZCQLQuery(urSql);
          if (urRes && urRes.length > 0) {
             const roleIds = urRes.map(item => `'${item.sys_user_role.role_id}'`).join(',');
             const roleSql = `SELECT * FROM sys_role WHERE ROWID IN (${roleIds})`;
             const roleRes = await zcql.executeZCQLQuery(roleSql);
             roles = roleRes.map(r => ({ id: r.sys_role.ROWID, name: r.sys_role.role_name }));
          }
        }
      } catch (err) {
        logger.warn(`Failed to fetch sys_user for catalyst user ${catalystUserId}: ${err.message}`);
      }
    }

    return { 
      user: catalystUser,
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
