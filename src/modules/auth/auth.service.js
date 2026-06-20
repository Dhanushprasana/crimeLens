const logger = require("../../config/logger");

module.exports = {
  async getMe(dto, req) {
    const catalystApp = req.catalyst || catalyst.initialize(req);
    const catalystUser = await catalystApp.userManagement().getCurrentUser();
    return { user: catalystUser };
  },

  async logOut(dto, req) {
    const catalystApp = req.catalyst || catalyst.initialize(req);
    await catalystApp.userManagement().signOut();
    return { message: "Logged out" };
  },
};
