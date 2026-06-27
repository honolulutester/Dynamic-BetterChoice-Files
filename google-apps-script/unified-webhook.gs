/**
 * BetterChoice — Unified Webhook to append both Customers and Orders to a single Google Sheet.
 *
 * Setup:
 * 1. Create a single Google Sheet.
 * 2. Extensions → Apps Script.
 * 3. Delete any default code and paste this entire script.
 * 4. Choose a custom secret below (e.g., "my-secure-webhook-secret").
 * 5. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Click Deploy, authorize permissions, and copy the Web app URL.
 * 7. Paste the Web app URL and your secret into `sheets-config.js`.
 */

const SHEET_CUSTOMERS = "Customers";
const SHEET_ORDERS = "Orders";
const WEBHOOK_SECRET = "choose-a-long-random-secret"; // Set the same value in sheets-config.js

const CUSTOMER_HEADERS = [
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

const ORDER_HEADERS = [
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

    // Verify secret if configured
    if (WEBHOOK_SECRET && WEBHOOK_SECRET !== "choose-a-long-random-secret" && data.secret !== WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    // Determine payload type: Orders have orderId, Customers have userId/event
    if (data.orderId) {
      const sheet = getOrCreateSheet_(SHEET_ORDERS, ORDER_HEADERS);
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
      return jsonResponse({ ok: true, type: "order" });
    } else {
      const sheet = getOrCreateSheet_(SHEET_CUSTOMERS, CUSTOMER_HEADERS);
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
      return jsonResponse({ ok: true, type: "customer" });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: "BetterChoice unified webhook" });
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Remove other default sheets if they are empty
    const sheets = ss.getSheets();
    if (sheets.length === 2 && sheets[0].getName() === "Sheet1" && sheets[0].getLastRow() === 0) {
      ss.deleteSheet(sheets[0]);
    }
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
