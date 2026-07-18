"use strict";

/**
 * Verification helper to check what methods are available on Catalyst SDK instance
 * Add this to any route to debug: require('./sdk-verification').verify(req.catalyst)
 */

function verify(catalystInstance) {
  if (!catalystInstance) {
    console.log("[SDK-VERIFY] catalystInstance is null/undefined");
    return;
  }

  console.log("[SDK-VERIFY] ========== CATALYST SDK CAPABILITIES ==========");
  console.log(
    "[SDK-VERIFY] req.catalyst keys:",
    Object.keys(catalystInstance || {}),
  );
  console.log(
    "[SDK-VERIFY] typeof req.catalyst.connection:",
    typeof catalystInstance.connection,
  );
  console.log(
    "[SDK-VERIFY] typeof req.catalyst.credential:",
    typeof catalystInstance.credential,
  );
  console.log(
    "[SDK-VERIFY] typeof req.catalyst.quickml:",
    typeof catalystInstance.quickml,
  );
  console.log(
    "[SDK-VERIFY] typeof req.catalyst.quickML:",
    typeof catalystInstance.quickML,
  );

  // Deep check connection
  if (typeof catalystInstance.connection === "function") {
    try {
      const conn = catalystInstance.connection();
      console.log("[SDK-VERIFY] connection() returns:", typeof conn);
      console.log("[SDK-VERIFY] connection() keys:", Object.keys(conn || {}));

      if (typeof conn.getConnector === "function") {
        try {
          const quickmlConnector = conn.getConnector("quickml");
          console.log(
            '[SDK-VERIFY] getConnector("quickml") returns:',
            typeof quickmlConnector,
          );
          console.log(
            '[SDK-VERIFY] getConnector("quickml") keys:',
            Object.keys(quickmlConnector || {}),
          );
          console.log(
            '[SDK-VERIFY] typeof getConnector("quickml").getAccessToken:',
            typeof quickmlConnector.getAccessToken,
          );
        } catch (e) {
          console.log('[SDK-VERIFY] getConnector("quickml") error:', e.message);
        }
      }
    } catch (e) {
      console.log("[SDK-VERIFY] connection() error:", e.message);
    }
  }

  // Deep check credential
  if (typeof catalystInstance.credential === "function") {
    try {
      const cred = catalystInstance.credential();
      console.log("[SDK-VERIFY] credential() returns:", typeof cred);
      console.log("[SDK-VERIFY] credential() keys:", Object.keys(cred || {}));
      console.log(
        "[SDK-VERIFY] typeof credential().getAccessToken:",
        typeof cred.getAccessToken,
      );
    } catch (e) {
      console.log("[SDK-VERIFY] credential() error:", e.message);
    }
  }

  console.log("[SDK-VERIFY] ===============================================");
}

module.exports = {
  verify,
};
