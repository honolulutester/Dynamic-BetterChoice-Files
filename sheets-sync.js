import {
    ORDERS_SHEET_WEBHOOK_URL,
    USERS_SHEET_WEBHOOK_URL,
    ORDERS_SHEET_SECRET,
    USERS_SHEET_SECRET
} from "./sheets-config.js";
import { getAgeGroup } from "./location-fields.js";
import { formatFullAddress } from "./location-fields.js";

export function isOrdersSheetEnabled() {
    return Boolean(ORDERS_SHEET_WEBHOOK_URL?.trim());
}

export function isUsersSheetEnabled() {
    return Boolean(USERS_SHEET_WEBHOOK_URL?.trim());
}

async function postToWebhook(url, secret, payload) {
    if (!url?.trim()) return { ok: false, skipped: true };

    try {
        const response = await fetch(url.trim(), {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ secret: secret || "", ...payload })
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            return { ok: false, message: text || `HTTP ${response.status}` };
        }

        const result = await response.json().catch(() => ({ ok: true }));
        if (result.ok === false) {
            return { ok: false, message: result.error || "Rejected by sheet webhook" };
        }
        return { ok: true };
    } catch (err) {
        return { ok: false, message: err.message };
    }
}

function formatLineItems(lineItems = []) {
    return lineItems.map((li) => `${li.name} × ${li.qty} (৳${li.lineTotal})`).join("; ");
}

export async function appendOrderToGoogleSheet(order, extras = {}) {
    if (!isOrdersSheetEnabled()) return { ok: false, skipped: true };

    const loc = {
        division: order.division,
        district: order.district,
        area: order.area,
        addressLine: order.addressLine,
        landmark: order.landmark
    };

    return postToWebhook(ORDERS_SHEET_WEBHOOK_URL, ORDERS_SHEET_SECRET, {
        timestamp: new Date().toISOString(),
        orderId: order.id,
        trackingCode: order.trackingCode,
        date: order.date,
        name: order.name,
        email: order.email || extras.email || "",
        phone: order.phone,
        division: loc.division || "",
        district: loc.district || "",
        area: loc.area || "",
        addressLine: loc.addressLine || "",
        landmark: loc.landmark || "",
        address: order.address || formatFullAddress(loc),
        slot: order.slot,
        paymentMethod: order.paymentMethod,
        itemsCount: order.itemsCount,
        lineItems: formatLineItems(order.lineItems),
        lineItemsJson: JSON.stringify(order.lineItems || []),
        deliveryFee: order.deliveryFee || 0,
        couponDiscount: order.couponDiscount || 0,
        walletApplied: order.walletApplied || 0,
        total: order.price,
        status: order.status || "Confirmed",
        guest: Boolean(order.guest),
        birthdate: order.birthdate || extras.birthdate || "",
        ageGroup: getAgeGroup(order.birthdate || extras.birthdate || "")
    });
}

export async function appendUserToGoogleSheet(user, event = "register") {
    if (!isUsersSheetEnabled()) return { ok: false, skipped: true };

    const loc = locationFromUser(user);
    return postToWebhook(USERS_SHEET_WEBHOOK_URL, USERS_SHEET_SECRET, {
        event,
        timestamp: new Date().toISOString(),
        userId: user.id || "",
        email: user.email || "",
        name: user.name || "",
        phone: user.phone || "",
        birthdate: user.birthdate || "",
        ageGroup: getAgeGroup(user.birthdate),
        division: loc.division,
        district: loc.district,
        area: loc.area,
        addressLine: loc.addressLine,
        landmark: loc.landmark,
        fullAddress: formatFullAddress(loc),
        wallet: user.wallet ?? 0,
        lifetimeCredits: user.lifetimeCredits ?? 0,
        subscribed: Boolean(user.subscribed)
    });
}

function locationFromUser(user) {
    return {
        division: user.division || "",
        district: user.district || "",
        area: user.area || "",
        addressLine: user.addressLine || user.address || "",
        landmark: user.landmark || ""
    };
}
