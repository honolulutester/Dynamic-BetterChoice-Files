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
        apply: "Apply",
        announcement: "Return amber bottles & tiffins on delivery — ৳25 Eco-Credits per unit added to your wallet after inspection",
        logoTagline: "Make the better, healthier choice",
        ecoCreditsLabel: "Eco-Credits",
        switchLang: "Switch language",
        itemAddedToCart: "Item added to cart!",
        trackTitle: "Track Your Order",
        trackSubtitle: "Enter your order ID to see real-time delivery status",
        trackPlaceholder: "e.g. OD-123456",
        trackButton: "Track Order",
        trackNotFound: "No order found with ID {id}. Check your confirmation email or account dashboard.",
        trackingId: "Tracking ID",
        statusConfirmed: "Confirmed",
        statusPacked: "Packed",
        statusOutForDelivery: "Out for Delivery",
        statusDelivered: "Delivered",
        footerBrandDesc: "Redefining urban health and sustainability in Bangladesh. Make the better, healthier choice by eliminating synthetic plastic entirely from the retail supply chain.",
        footerNewsletterTitle: "Exclusive Offers Newsletter",
        footerNewsletterDesc: "Get early access to small-batch drops and member-only discounts.",
        footerSubscribe: "Subscribe",
        footerMaterialStandards: "Material Standards",
        footerOrganic: "100% Certified Organic",
        footerBpaFree: "BPA-Free Raw Glass",
        footerBananaFiber: "Banana Fiber Wrappings",
        footerZeroPlastic: "Zero Plastics Guaranteed",
        footerServiceHub: "Service Hub",
        footerWorkoutSplitting: "Workout Splitting",
        footerMacroMenus: "Macro-Calorie Menus",
        footerDieticians: "Certified Dieticians",
        footerMyAccount: "My Account",
        footerTrackOrder: "Track My Order",
        footerCompany: "Company",
        footerAbout: "About Us",
        footerPolicies: "Customer Policies",
        footerDirectSupport: "Direct Support",
        footerGulshan: "Gulshan Priority Desk",
        footerBanani: "Banani Logistics",
        footerDhanmondi: "Dhanmondi Express",
        footerLiveChat: "Live Chat Support",
        footerCopyright: "© 2026 BetterChoice. All rights reserved. Made in alignment with Bengal Conservation guidelines.",
        footerBsti: "BSTI Accredited Partners",
        chatSupportTitle: "BetterChoice Support",
        chatSupportSubtitle: "Typically replies in minutes",
        chatPlaceholder: "Type your message...",
        chatSend: "Send"
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
        apply: "প্রয়োগ",
        announcement: "ডেলিভারিতে অ্যাম্বার বোতল ও টিফিন ফেরত দিন — পরিদর্শনের পর প্রতি ইউনিটে ৳২৫ ইকো-ক্রেডিট ওয়ালেটে যোগ হবে",
        logoTagline: "সেরা, স্বাস্থ্যকর পছন্দ করুন",
        ecoCreditsLabel: "ইকো-ক্রেডিট",
        switchLang: "ভাষা পরিবর্তন",
        itemAddedToCart: "কার্টে যোগ হয়েছে!",
        trackTitle: "অর্ডার ট্র্যাক করুন",
        trackSubtitle: "রিয়েল-টাইম ডেলিভারি স্ট্যাটাস দেখতে অর্ডার আইডি লিখুন",
        trackPlaceholder: "যেমন OD-123456",
        trackButton: "অর্ডার ট্র্যাক",
        trackNotFound: "আইডি {id} দিয়ে কোনো অর্ডার পাওয়া যায়নি। কনফার্মেশন ইমেইল বা অ্যাকাউন্ট ড্যাশবোর্ডে দেখুন।",
        trackingId: "ট্র্যাকিং আইডি",
        statusConfirmed: "নিশ্চিত",
        statusPacked: "প্যাক করা",
        statusOutForDelivery: "ডেলিভারির পথে",
        statusDelivered: "ডেলিভারি সম্পন্ন",
        footerBrandDesc: "বাংলাদেশে শহুরে স্বাস্থ্য ও টেকসই জীবনযাপনের নতুন মানদণ্ড। খুচরা সরবরাহ শৃঙ্খল থেকে সিন্থেটিক প্লাস্টিক সম্পূর্ণভাবে দূর করে সেরা, স্বাস্থ্যকর পছন্দ করুন।",
        footerNewsletterTitle: "বিশেষ অফার নিউজলেটার",
        footerNewsletterDesc: "সীমিত ব্যাচ ও সদস্য-শুধু ছাড়ের আগাম অ্যাক্সেস পান।",
        footerSubscribe: "সাবস্ক্রাইব",
        footerMaterialStandards: "উপাদান মান",
        footerOrganic: "১০০% সার্টিফাইড অর্গানিক",
        footerBpaFree: "বিপিএ-মুক্ত কাঁচ",
        footerBananaFiber: "কলার আঁশের মোড়ক",
        footerZeroPlastic: "শূন্য প্লাস্টিক নিশ্চিত",
        footerServiceHub: "সেবা কেন্দ্র",
        footerWorkoutSplitting: "ওয়ার্কআউট স্প্লিট",
        footerMacroMenus: "ম্যাক্রো-ক্যালোরি মেনু",
        footerDieticians: "সার্টিফাইড ডায়েটিশিয়ান",
        footerMyAccount: "আমার অ্যাকাউন্ট",
        footerTrackOrder: "আমার অর্ডার ট্র্যাক",
        footerCompany: "কোম্পানি",
        footerAbout: "আমাদের সম্পর্কে",
        footerPolicies: "গ্রাহক নীতিমালা",
        footerDirectSupport: "সরাসরি সহায়তা",
        footerGulshan: "গুলশান প্রায়োরিটি ডেস্ক",
        footerBanani: "বনানী লজিস্টিক্স",
        footerDhanmondi: "ধানমন্ডি এক্সপ্রেস",
        footerLiveChat: "লাইভ চ্যাট সহায়তা",
        footerCopyright: "© ২০২৬ BetterChoice। সর্বস্বত্ব সংরক্ষিত। বাংলা সংরক্ষণ নির্দেশিকা অনুসারে তৈরি।",
        footerBsti: "বিএসটিআই অনুমোদিত অংশীদার",
        chatSupportTitle: "BetterChoice সহায়তা",
        chatSupportSubtitle: "সাধারণত কয়েক মিনিটের মধ্যে উত্তর",
        chatPlaceholder: "আপনার বার্তা লিখুন...",
        chatSend: "পাঠান"
    }
};

const ORDER_STATUS_KEYS = {
    Confirmed: "statusConfirmed",
    Packed: "statusPacked",
    "Out for Delivery": "statusOutForDelivery",
    Delivered: "statusDelivered"
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

export function t(key, vars = {}) {
    let str = STRINGS[currentLang]?.[key] || STRINGS.en[key] || key;
    Object.entries(vars).forEach(([k, v]) => {
        str = str.replaceAll(`{${k}}`, v);
    });
    return str;
}

export function orderStatusLabel(status) {
    const key = ORDER_STATUS_KEYS[status];
    return key ? t(key) : status;
}

export function applyShellI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.dataset.i18n;
        if (STRINGS.en[key]) el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.dataset.i18nPlaceholder;
        if (STRINGS.en[key]) el.placeholder = t(key);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        const key = el.dataset.i18nTitle;
        if (STRINGS.en[key]) el.title = t(key);
    });

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
    const tagline = document.querySelector(".logo span");
    if (tagline) tagline.textContent = t("logoTagline");
}

let stateRef = null;
export function bindI18nState(state) {
    stateRef = state;
}
