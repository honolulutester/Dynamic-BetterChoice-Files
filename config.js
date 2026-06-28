export const DELIVERY_FEE = 80;
export const FREE_DELIVERY_CREDITS = 200;
export const FREE_DELIVERY_ORDER_MIN = 1500;
export const MERCHANT_PIN = "8822";
export const CATALOG_CACHE_VERSION = "3";

export const COUPONS = {
    WELCOME10: { percent: 10, min: 500, label: "10% off orders over ৳500" },
    ECO15: { percent: 15, min: 1000, label: "15% off orders over ৳1000" },
    BETTER5: { percent: 5, min: 0, label: "5% off any order" }
};

export const MEAL_INGREDIENT_KEYS = [
    { key: "egg", matchers: ["egg"] },
    { key: "rice", matchers: ["kalijira", "brown rice", "rice"] },
    { key: "fish", matchers: ["hilsha", "hilsa", "pomfret", "rui", "fish"] },
    { key: "beef", matchers: ["beef"] },
    { key: "lentil", matchers: ["masur", "lentil", "dal"] },
    { key: "moringa", matchers: ["moringa", "neem", "botanical", "elixir"] }
];

export const WORKOUT_SHOP_MATCHERS = ["whey", "pea protein", "protein", "moringa", "botanical", "creatine"];

export const ORDER_STATUSES = ["Confirmed", "Packed", "Out for Delivery", "Delivered"];
export const TRACKING_LOOKUP_KEY = "eco_track_lookup";

