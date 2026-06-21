const STRINGS = {
    en: {
        shop: "Shop",
        workout: "Workout Planner",
        meals: "Meal Architect",
        experts: "Wellness Experts",
        editorial: "Editorial Hub",
        track: "Track Order",
        signIn: "Sign In",
        cart: "Shopping Tote",
        proceedOrder: "Proceed to Order",
        subtotal: "Subtotal",
        items: "items",
        emptyCart: "Your cart is empty.",
        confirmOrder: "Confirm Your Order",
        placeOrder: "Place Order",
        guestCheckout: "Continue as Guest",
        wishlist: "Wishlist",
        reorder: "Reorder",
        deliveryFee: "Delivery Fee",
        freeDelivery: "Free Delivery",
        coupon: "Promo Code",
        apply: "Apply"
    },
    bn: {
        shop: "শপ",
        workout: "ওয়ার্কআউট প্ল্যানার",
        meals: "মিল আর্কিটেক্ট",
        experts: "স্বাস্থ্য বিশেষজ্ঞ",
        editorial: "এডিটোরিয়াল",
        track: "অর্ডার ট্র্যাক",
        signIn: "সাইন ইন",
        cart: "শপিং টোট",
        proceedOrder: "অর্ডার করুন",
        subtotal: "মোট",
        items: "আইটেম",
        emptyCart: "আপনার কার্ট খালি।",
        confirmOrder: "অর্ডার নিশ্চিত করুন",
        placeOrder: "অর্ডার সম্পন্ন",
        guestCheckout: "গেস্ট হিসেবে চালিয়ে যান",
        wishlist: "ইচ্ছেতালিকা",
        reorder: "আবার অর্ডার",
        deliveryFee: "ডেলিভারি ফি",
        freeDelivery: "বিনামূল্যে ডেলিভারি",
        coupon: "প্রোমো কোড",
        apply: "প্রয়োগ"
    }
};

let currentLang = localStorage.getItem("eco_lang") || "en";

export function getLang() {
    return currentLang;
}

export function setLang(lang) {
    currentLang = lang === "bn" ? "bn" : "en";
    localStorage.setItem("eco_lang", currentLang);
    document.documentElement.lang = currentLang;
}

export function t(key) {
    return STRINGS[currentLang]?.[key] || STRINGS.en[key] || key;
}

export function applyShellI18n() {
    const map = {
        shop: '[data-page="shop"]',
        workout: '[data-page="workout"]',
        meals: '[data-page="meals"]',
        experts: '[data-page="experts"]',
        editorial: '[data-page="editorial"]',
        track: '[data-page="track"]'
    };
    Object.entries(map).forEach(([key, sel]) => {
        const el = document.querySelector(sel);
        if (el) el.textContent = t(key);
    });
    const cartTitle = document.querySelector(".cart-header h3");
    if (cartTitle) cartTitle.textContent = t("cart");
    const proceedBtn = document.getElementById("drawer-proceed-btn");
    if (proceedBtn) proceedBtn.textContent = t("proceedOrder");
    const label = document.getElementById("header-account-label");
    if (label && !stateRef?.currentUser) label.textContent = t("signIn");
}

let stateRef = null;
export function bindI18nState(state) {
    stateRef = state;
}
