"use strict";

const catalyst = require("zcatalyst-sdk-node");

module.exports = {
  async createUser(req, email, password, displayName) {
    const catalystApp = catalyst.initialize(req);
    const userManagement = catalystApp.userManagement();

    const payload = {
      first_name: displayName || undefined,
      email_id: email,
      password: password,
    };

    const response = await userManagement.registerUser(payload);
    // response may contain created user details — return it as-is
    return response;
  },
};
