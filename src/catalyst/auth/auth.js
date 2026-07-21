"use strict";

const catalyst = require("zcatalyst-sdk-node");
const env = require("../../config/env");

module.exports = {
  async createUser(req, email, password, displayName) {
    const catalystApp = catalyst.initialize(req);
    const userManagement = catalystApp.userManagement();
    const signupConfig = {
      // platform_type is required by the SDK — use 'embedded' to enable embedded widget flows
      platform_type: "web",
      // // optional redirect_url: frontend callback after embedded auth completes
      // ...(env.FRONTEND_REDIRECT_URL
      //   ? { redirect_url: env.FRONTEND_REDIRECT_URL }
      //   : {}),
    };

    // const signupConfig = {
    //   platform_type: "embedded",
    //   redirect_url: process.env.FRONTEND_REDIRECT_URL,
    // };

    // helpful debug: log signupConfig without sensitive data
    // eslint-disable-next-line no-console
    console.debug &&
      console.debug("signupConfig for registerUser:", {
        platform_type: signupConfig.platform_type,
      });

    const userDetails = {
      first_name: displayName || undefined,
      last_name: undefined,
      email_id: email,
    };

    // registerUser requires an org_id in userDetails — try to fetch available orgs from Catalyst
    try {
      const orgs = await userManagement.getAllOrgs();
      if (Array.isArray(orgs) && orgs.length > 0) {
        const first = orgs[0];
        let orgId = null;
        if (typeof first === "string") {
          orgId = first;
        } else if (first && typeof first === "object") {
          orgId = first.id || first.org_id || first.value || null;
        }
        if (orgId) {
          userDetails.org_id = orgId;
        }
      }
    } catch (e) {
      // non-fatal — if we cannot fetch orgs, let registerUser handle the error
      // but log for debugging
      // eslint-disable-next-line no-console
      console.warn(
        "Could not fetch orgs for Catalyst user creation",
        e && e.message ? e.message : e,
      );
    }

    const response = await userManagement.registerUser(
      signupConfig,
      userDetails,
    );
    // response may contain created user details — return it as-is
    return response;
  },
};
