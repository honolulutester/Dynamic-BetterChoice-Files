/**
 * BetterChoice — append new orders to a Google Sheet.
 *
 * Setup:
 * 1. Create a Google Sheet (or use your existing catalog sheet).
 * 2. Extensions → Apps Script → paste this file.
 * 3. Set WEBHOOK_SECRET below (same value as sheets-config.js on the site).
 * 4. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web app URL into sheets-config.js → ORDERS_SHEET_WEBHOOK_URL
 */

const SHEET_NAME = "Orders";
const WEBHOOK_SECRET = "choose-a-long-random-secret";

const HEADERS = [
  "Timestamp",
  "Order ID",
  "Tracking ID",
  "Order Date",
  "Customer Name",
  "Email",
  "Phone",
  "Division",
  "District",
  "Area",
  "Address Line",
  "Landmark",
  "Full Address",
  "Delivery Slot",
  "Payment Method",
  "Items Count",
  "Line Items",
  "Line Items (JSON)",
  "Delivery Fee",
  "Coupon Discount",
  "Wallet Applied",
  "Total (৳)",
  "Status",
  "Guest Order",
  "Birthdate",
  "Age Group"
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (WEBHOOK_SECRET && data.secret !== WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const sheet = getOrCreateOrdersSheet_();
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.orderId || "",
      data.trackingCode || "",
      data.date || "",
      data.name || "",
      data.email || "",
      data.phone || "",
      data.division || "",
      data.district || "",
      data.area || "",
      data.addressLine || "",
      data.landmark || "",
      data.address || "",
      data.slot || "",
      data.paymentMethod || "",
      data.itemsCount || 0,
      data.lineItems || "",
      data.lineItemsJson || "[]",
      data.deliveryFee || 0,
      data.couponDiscount || 0,
      data.walletApplied || 0,
      data.total || 0,
      data.status || "Confirmed",
      data.guest ? "Yes" : "No",
      data.birthdate || "",
      data.ageGroup || ""
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: "BetterChoice orders webhook" });
}

function getOrCreateOrdersSheet_() {
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
