/**
 * BetterChoice — append new customer profiles to a Google Sheet.
 * Deploy like orders-webhook.gs and set USERS_SHEET_WEBHOOK_URL in sheets-config.js
 */

const SHEET_NAME = "Customers";
const WEBHOOK_SECRET = "choose-a-long-random-secret";

const HEADERS = [
  "Timestamp",
  "Event",
  "User ID",
  "Name",
  "Email",
  "Phone",
  "Birthdate",
  "Age Group",
  "Division",
  "District",
  "Area",
  "Address Line",
  "Landmark",
  "Full Address",
  "Wallet (৳)",
  "Lifetime Credits",
  "Newsletter Subscribed"
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (WEBHOOK_SECRET && data.secret !== WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const sheet = getOrCreateCustomersSheet_();
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.event || "register",
      data.userId || "",
      data.name || "",
      data.email || "",
      data.phone || "",
      data.birthdate || "",
      data.ageGroup || "",
      data.division || "",
      data.district || "",
      data.area || "",
      data.addressLine || "",
      data.landmark || "",
      data.fullAddress || "",
      data.wallet || 0,
      data.lifetimeCredits || 0,
      data.subscribed ? "Yes" : "No"
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: "BetterChoice customers webhook" });
}

function getOrCreateCustomersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
