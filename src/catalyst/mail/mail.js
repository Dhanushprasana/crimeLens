"use strict";

const catalyst = require("zcatalyst-sdk-node");

module.exports = {
  async sendMail(req, to, subject, bodyLines = [], action = {}) {
    const catalystApp = catalyst.initialize(req);
    const mail = catalystApp.email();

    // Compose HTML content
    const name = action.name || "";
    const actionLink = action.url || "";
    const actionText = action.text || "Open Link";
    const contentLines = bodyLines.join("<br/>");
    const html = `
      <div>
        <div>${contentLines}</div>
        ${actionLink ? `<p><a href="${actionLink}">${actionText}</a></p>` : ""}
      </div>
    `;

    try {
      await mail.sendMail({
        from_email: process.env.INVITE_FROM_EMAIL || "noreply@yourdomain.com",
        to_email: [to],
        subject: subject,
        html_mode: true,
        content: html,
      });
      return { ok: true };
    } catch (err) {
      throw new Error("Catalyst mail send failed: " + err.message);
    }
  },
};
