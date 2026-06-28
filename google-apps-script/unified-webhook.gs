/**
 * BetterChoice — Unified Webhook to append Customers, Orders, and Editorial columns to a single Google Sheet.
 *
 * Setup:
 * 1. Open your Google Sheet.
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
const SHEET_EDITORIAL = "Editorial";
const WEBHOOK_SECRET = "choose-a-long-random-secret"; // Set the same value in sheets-config.js

const EDITORIAL_HEADERS = [
  "id",
  "title",
  "tag",
  "excerpt",
  "author",
  "date",
  "readTime",
  "image",
  "likes",
  "content"
];

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

    // Determine payload type
    if (data.type === "submission") {
      const sheet = getOrCreateSheet_(SHEET_EDITORIAL, EDITORIAL_HEADERS);
      sheet.appendRow([
        data.columnId || `art-${Date.now()}`,
        data.title || "",
        data.tag || "",
        data.excerpt || "",
        data.author || "",
        data.date || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        data.readTime || "5 min read",
        data.image || "",
        data.likes || 0,
        data.content || ""
      ]);
      return jsonResponse({ ok: true, type: "submission" });
    } else if (data.orderId) {
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

function doGet(e) {
  try {
    // Automatically create all missing tabs
    getOrCreateSheet_(SHEET_ORDERS, ORDER_HEADERS);
    getOrCreateSheet_(SHEET_CUSTOMERS, CUSTOMER_HEADERS);
    
    const editorialSheet = getOrCreateSheet_(SHEET_EDITORIAL, EDITORIAL_HEADERS);
    
    // If Editorial is newly created or empty (only header row), pre-populate it with the 3 default articles
    if (editorialSheet.getLastRow() === 1) {
      editorialSheet.appendRow([
        "a1",
        "Combating Plastic Pollution in the Bengal Delta",
        "Conservation",
        "An in-depth look at how packaging choices affect the delicate ecosystem of the Sundarbans and the Bay of Bengal, and the shift towards biodegradable fibers.",
        "Dr. Farhana Yasmin, Environmentalist",
        "June 15, 2026",
        "5 min read",
        "./sundarbans_delta_conservation.png",
        "42",
        "The Bengal Delta, the largest delta in the world, is choked by a silent crisis: non-biodegradable plastics. Every single-use packaging bag, water bottle, and synthetic wrapping material discarded in urban centers like Dhaka eventually makes its way into our river systems, terminating in the delicate mangroves of the Sundarbans and the marine habitats of the Bay of Bengal.\n\nOur ancestors relied on natural banana leaves, earthen clay pots, and golden jute canvas to transport and store food. These organic substrates degraded seamlessly back into the delta's soil, feeding rather than poisoning the environment. \n\nBy replacing synthetic polymers with local biodegradable materials like unbleached seed-infused paper, jackwood containers, and woven jute bags, we can eliminate plastic from the supply chain. This shift not only protects the delta's biodiversity but also supports local rural artisans and farmers, closing the loop in a circular economy."
      ]);
      editorialSheet.appendRow([
        "a2",
        "Traditional Bengali Cooking in Pre-Seasoned Cast Iron",
        "Culinary Art",
        "Reclaiming the health benefits and deep flavors of cooking traditional deshi dishes in cast iron pans rather than Teflon-coated cookware.",
        "Chef Tariqul Islam",
        "June 10, 2026",
        "4 min read",
        "./bengali_cast_iron_cooking.png",
        "29",
        "For decades, modern kitchens in Bangladesh have adopted Teflon and chemical-coated non-stick cookware, unaware of the endocrine-disrupting chemicals (like BPA, PFOA) that leach into food under high heat. \n\nReclaiming the traditional cast-iron 'karahi' or skillet is a return to clean, healthy eating. Cast iron distributes heat evenly, sealing in natural juices and caramelizing organic proteins like grass-fed deshi beef or wild river Hilsha to perfection.\n\nFurthermore, cooking acidic gravies (like tomatoes or lemon-infused fish curries) in cast iron naturally fortifies the food with bioavailable dietary iron, combating anemia. By seasoning iron with organic ghani mustard oil, you build a natural, non-toxic, glassy non-stick layer that makes chemical coatings obsolete."
      ]);
      editorialSheet.appendRow([
        "a3",
        "Progressive Overload Tactics for the Monsoon Season",
        "Fitness & Wellness",
        "How to maintain your hypertrophic splits and progressive strength gains at home when heavy rainfall disrupts outdoor activity and commute.",
        "Sabir Rahman, Certified Pro-Trainer",
        "June 05, 2026",
        "6 min read",
        "./monsoon_home_workout.png",
        "56",
        "The heavy monsoon downpours in cities like Dhaka and Chittagong often disrupt gym routines. Gridlocked traffic and flooded streets make commuting to fitness centers a chore. \n\nHowever, progress doesn't need to stall. You can maintain hypertrophy and strength splits by adjusting your training variables. Leverage high-intensity callisthenics splits, tempo control, and progressive mechanical disadvantages. \n\nBy slowing down the eccentric phase of a squat, performing handstand pushup splits, or using heavy Jackwood block lifting routines, you can stimulate muscular growth and trigger metabolic adaptations. Combine this with single-click balanced shopping carts containing high-density proteins and bio-active micro-nutrients to keep your recovery optimal."
      ]);
    }
    return jsonResponse({ ok: true, message: "BetterChoice unified webhook initialized! All tabs created and pre-populated." });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
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
