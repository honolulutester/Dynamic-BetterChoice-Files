import { DEFAULT_PRODUCTS, ARTICLES, EXPERTS, fetchGoogleSheetCatalog, DEFAULT_SHEET_URL, COMPANY_PROFILE, CUSTOMER_POLICIES, getOrderUnit } from './data.js';
import { MERCHANT_PIN, CATALOG_CACHE_VERSION, MEAL_INGREDIENT_KEYS, WORKOUT_SHOP_MATCHERS, COUPONS } from './config.js';
import { appendOrderToGoogleSheet, appendUserToGoogleSheet, isOrdersSheetEnabled, isUsersSheetEnabled } from './orders-sheet.js';
import {
    renderLocationFieldsHtml, bindLocationFields, readLocationFields,
    formatFullAddress, locationFromLegacy
} from './location-fields.js';
import { t, setLang, getLang, applyShellI18n, bindI18nState, orderStatusLabel, subcategoryLabel, SHOP_CATEGORY_CHIPS } from './i18n.js';
import {
    getCheckoutTotals, buildOrderLineItems, getProductTraceUrl, parseProductIdFromUrl,
    drawQRToCanvas, findMealProducts, getActivePrice, applyCoupon
} from './helpers.js';
import {
    isSupabaseEnabled, isAuthCallbackHash, initSupabaseAuth, loadUserFromSupabase,
    supabaseRegister, supabaseLogin, supabaseLogout, supabaseResetPassword, resendConfirmationEmail,
    persistProfileToSupabase, saveOrderToSupabase, syncWishlistToSupabase,
    saveReturnRequestToSupabase, fetchProductReviews, submitProductReview,
    subscribeNewsletterEmail, trackOrderById, merchantIssueCredits,
    merchantAdvanceOrder, refreshCurrentUserProfile
} from './supabase.js';

const ORDER_STATUSES = ["Confirmed", "Packed", "Out for Delivery", "Delivered"];
const TRACKING_LOOKUP_KEY = "eco_track_lookup";
const WHATSAPP_PHONE = "8801778522749";

function getWhatsAppUrl(message = "") {
    const base = `https://wa.me/${WHATSAPP_PHONE}`;
    const text = message.trim() || t("whatsappDefaultMessage");
    return `${base}?text=${encodeURIComponent(text)}`;
}

function updateWhatsAppLinks(message = "") {
    const url = getWhatsAppUrl(message);
    document.getElementById("whatsapp-fab")?.setAttribute("href", url);
    document.getElementById("live-chat-whatsapp")?.setAttribute("href", url);
    document.getElementById("footer-whatsapp-link")?.setAttribute("href", url);
}
const APP_PAGES = new Set([
    "shop", "traceability", "workout", "meals", "experts", "editorial",
    "dashboard", "login", "register", "track", "about", "policies", "checkout"
]);

function getAppPageFromHash(hash = window.location.hash) {
    const raw = (hash || "").replace(/^#/, "");
    if (!raw || isAuthCallbackHash(`#${raw}`)) return null;
    const page = raw.split("&")[0];
    return APP_PAGES.has(page) ? page : null;
}

// --- APPLICATION STATE ---
let state = {
    products: [...DEFAULT_PRODUCTS],
    cart: [],
    wallet: 0,
    lifetimeCredits: 0,
    orders: [],
    bookings: [],
    savedWorkouts: null,
    savedMeals: null,
    sheetUrl: DEFAULT_SHEET_URL,
    activePage: "shop",
    activeProductTrace: null,
    tempBooking: null,
    currentUser: null,
    users: [],
    newsletter: [],
    chatMessages: [],
    pendingCheckout: null,
    wishlist: [],
    returnRequests: [],
    productReviews: {},
    redirectAfterAuth: null,
    activeCoupon: "",
    guestCheckout: false
};

// --- INITIALIZE APPLICATION ---
window.addEventListener("DOMContentLoaded", async () => {
    bindI18nState(state);
    if (localStorage.getItem("eco_cache_version") !== CATALOG_CACHE_VERSION) {
        localStorage.removeItem("eco_products_cache");
        localStorage.setItem("eco_cache_version", CATALOG_CACHE_VERSION);
    }
    loadState();
    setLang(getLang());

    if (isSupabaseEnabled()) {
        try {
            const { session, authCallback, error: authError } = await initSupabaseAuth(async (session) => {
                if (!session) {
                    clearUserSessionState();
                    updateHeaderAccount();
                    return;
                }
                const user = await loadUserFromSupabase(session.user.id);
                if (user) {
                    state.currentUser = user;
                    syncUserToState(user);
                    updateHeaderAccount();
                }
            });
            if (session?.user) {
                const user = await loadUserFromSupabase(session.user.id);
                if (user) {
                    state.currentUser = user;
                    syncUserToState(user);
                }
            }
            if (authCallback) {
                if (session?.user) {
                    showNotification("Email confirmed — welcome to BetterChoice!");
                } else if (authError) {
                    alert(`Sign-in link failed: ${authError}`);
                }
            }
        } catch (e) {
            console.warn("Supabase session restore failed:", e);
        }
    }

    setupRouting();
    setupGlobalListeners();
    syncCartUI();
    updateHeaderAccount();
    applyShellI18n();

    if (!isSupabaseEnabled() && !sessionStorage.getItem("bc_supabase_hint")) {
        sessionStorage.setItem("bc_supabase_hint", "1");
        console.info("BetterChoice: Supabase not configured. Copy supabase-config.example.js → supabase-config.js and run supabase/schema.sql in your project.");
    }

    if (!isOrdersSheetEnabled() && !sessionStorage.getItem("bc_sheets_hint")) {
        sessionStorage.setItem("bc_sheets_hint", "1");
        console.info("BetterChoice: Order logging to Google Sheets is off. Deploy google-apps-script/orders-webhook.gs and set sheets-config.js.");
    }

    if (!isUsersSheetEnabled() && !sessionStorage.getItem("bc_users_sheets_hint")) {
        sessionStorage.setItem("bc_users_sheets_hint", "1");
        console.info("BetterChoice: Customer sync to Google Sheets is off. Deploy google-apps-script/users-webhook.gs and set USERS_SHEET_WEBHOOK_URL.");
    }

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
    }

    const pid = parseProductIdFromUrl();
    if (pid) {
        const product = state.products.find(p => String(p.id) === String(pid));
        if (product) state.activeProductTrace = product;
    }
    
    // Auto-sync Google Sheet on load if configured
    if (state.sheetUrl) {
        showNotification("Auto-syncing catalog with Google Sheets...");
        try {
            const sheetProducts = await fetchGoogleSheetCatalog(state.sheetUrl);
            if (sheetProducts.length > 0) {
                state.products = sheetProducts;
                saveState();
                showNotification("Catalog successfully updated from Google Sheets!");
            }
        } catch (e) {
            console.warn("Failed auto-syncing Google Sheet on startup. Using cached data.", e);
        }
    }

    const hashPage = getAppPageFromHash() || "shop";
    if (pid && state.activeProductTrace) {
        state.activePage = "traceability";
        renderPage("traceability");
    } else {
        const page = hashPage === "traceability" && !state.activeProductTrace ? "shop" : (hashPage || state.activePage);
        state.activePage = page;
        renderPage(page);
    }
});

function syncUserToState(user) {
    if (!user) return;
    state.wallet = user.wallet || 0;
    state.lifetimeCredits = user.lifetimeCredits || 0;
    state.orders = user.orders || [];
    state.bookings = user.bookings || [];
    state.cart = user.cart || [];
    state.savedWorkouts = user.savedWorkouts || null;
    state.savedMeals = user.savedMeals || null;
    state.wishlist = user.wishlist || [];
    state.returnRequests = user.returnRequests || [];
}

function syncStateToUser() {
    if (!state.currentUser) return;
    const idx = state.users.findIndex(u => u.id === state.currentUser.id);
    if (idx === -1) return;
    state.users[idx] = {
        ...state.users[idx],
        wallet: state.wallet,
        lifetimeCredits: state.lifetimeCredits,
        orders: state.orders,
        bookings: state.bookings,
        cart: state.cart,
        savedWorkouts: state.savedWorkouts,
        savedMeals: state.savedMeals,
        wishlist: state.wishlist,
        returnRequests: state.returnRequests,
        name: state.currentUser.name,
        email: state.currentUser.email,
        phone: state.currentUser.phone || "",
        division: state.currentUser.division || "Dhaka",
        district: state.currentUser.district || "Dhaka",
        area: state.currentUser.area || "Gulshan",
        addressLine: state.currentUser.addressLine || state.currentUser.address || "",
        landmark: state.currentUser.landmark || "",
        address: state.currentUser.address || "",
        birthdate: state.currentUser.birthdate || "",
        subscribed: state.currentUser.subscribed || false
    };
    state.currentUser = state.users[idx];
}

// Load state from localStorage
function loadState() {
    try {
        const savedUsers = localStorage.getItem("eco_users");
        if (savedUsers) state.users = JSON.parse(savedUsers);

        const sessionId = localStorage.getItem("eco_session");
        if (sessionId) {
            const user = state.users.find(u => u.id === sessionId);
            if (user) {
                state.currentUser = user;
                syncUserToState(user);
            }
        }

        if (!state.currentUser) {
            const savedCart = localStorage.getItem("eco_cart");
            if (savedCart) state.cart = JSON.parse(savedCart);
            const savedWallet = localStorage.getItem("eco_wallet");
            if (savedWallet) state.wallet = parseFloat(savedWallet) || 0;
            const savedLifetime = localStorage.getItem("eco_lifetime");
            if (savedLifetime) state.lifetimeCredits = parseFloat(savedLifetime) || 0;
            const savedOrders = localStorage.getItem("eco_orders");
            if (savedOrders) state.orders = JSON.parse(savedOrders);
            const savedBookings = localStorage.getItem("eco_bookings");
            if (savedBookings) state.bookings = JSON.parse(savedBookings);
            const savedWorkouts = localStorage.getItem("eco_workouts");
            if (savedWorkouts) state.savedWorkouts = JSON.parse(savedWorkouts);
            const savedMeals = localStorage.getItem("eco_meals");
            if (savedMeals) state.savedMeals = JSON.parse(savedMeals);
            const savedWishlist = localStorage.getItem("eco_wishlist");
            if (savedWishlist) state.wishlist = JSON.parse(savedWishlist);
            const savedReturns = localStorage.getItem("eco_returns");
            if (savedReturns) state.returnRequests = JSON.parse(savedReturns);
        }

        const savedReviews = localStorage.getItem("eco_reviews");
        if (savedReviews) state.productReviews = JSON.parse(savedReviews);

        const savedNewsletter = localStorage.getItem("eco_newsletter");
        if (savedNewsletter) state.newsletter = JSON.parse(savedNewsletter);

        const savedChat = localStorage.getItem("eco_chat");
        if (savedChat) state.chatMessages = JSON.parse(savedChat);

        const savedSheetUrl = localStorage.getItem("eco_sheet_url");
        state.sheetUrl = savedSheetUrl || DEFAULT_SHEET_URL;

        const cachedProducts = localStorage.getItem("eco_products_cache");
        if (cachedProducts) state.products = JSON.parse(cachedProducts);
    } catch (e) {
        console.error("Error reading localStorage state:", e);
    }
}

function clearUserSessionState() {
    state.currentUser = null;
    state.cart = [];
    state.wallet = 0;
    state.lifetimeCredits = 0;
    state.orders = [];
    state.bookings = [];
    state.savedWorkouts = null;
    state.savedMeals = null;
    state.wishlist = [];
    state.returnRequests = [];
    localStorage.removeItem("eco_session");
}

function isCloudUser() {
    return state.currentUser?.id && !String(state.currentUser.id).startsWith("usr-");
}

// Save state to localStorage (+ Supabase profile when signed in)
function saveState() {
    try {
        if (state.currentUser && !isCloudUser()) {
            syncStateToUser();
            localStorage.setItem("eco_users", JSON.stringify(state.users));
            localStorage.setItem("eco_session", state.currentUser.id);
        } else if (!state.currentUser) {
            localStorage.removeItem("eco_session");
            localStorage.setItem("eco_cart", JSON.stringify(state.cart));
            localStorage.setItem("eco_wallet", state.wallet.toString());
            localStorage.setItem("eco_lifetime", state.lifetimeCredits.toString());
            localStorage.setItem("eco_orders", JSON.stringify(state.orders));
            localStorage.setItem("eco_bookings", JSON.stringify(state.bookings));
            localStorage.setItem("eco_workouts", JSON.stringify(state.savedWorkouts));
            localStorage.setItem("eco_meals", JSON.stringify(state.savedMeals));
            localStorage.setItem("eco_wishlist", JSON.stringify(state.wishlist));
            localStorage.setItem("eco_returns", JSON.stringify(state.returnRequests));
        }

        if (isSupabaseEnabled() && isCloudUser()) {
            persistProfileToSupabase(state.currentUser.id, {
                name: state.currentUser.name,
                phone: state.currentUser.phone,
                division: state.currentUser.division,
                district: state.currentUser.district,
                area: state.currentUser.area,
                addressLine: state.currentUser.addressLine,
                landmark: state.currentUser.landmark,
                address: state.currentUser.address,
                birthdate: state.currentUser.birthdate,
                wallet: state.wallet,
                lifetimeCredits: state.lifetimeCredits,
                cart: state.cart,
                bookings: state.bookings,
                savedWorkouts: state.savedWorkouts,
                savedMeals: state.savedMeals,
                subscribed: state.currentUser.subscribed || false
            }).catch(err => console.error("Profile sync failed:", err));
            syncWishlistToSupabase(state.currentUser.id, state.wishlist).catch(err => console.error("Wishlist sync failed:", err));
        }

        if (!isCloudUser()) {
            localStorage.setItem("eco_reviews", JSON.stringify(state.productReviews));
        }
        localStorage.setItem("eco_newsletter", JSON.stringify(state.newsletter));
        localStorage.setItem("eco_chat", JSON.stringify(state.chatMessages));
        localStorage.setItem("eco_sheet_url", state.sheetUrl);
        localStorage.setItem("eco_products_cache", JSON.stringify(state.products));
    } catch (e) {
        console.error("Error writing state:", e);
    }
}

async function registerUser({ name, email, phone, password, division, district, area, addressLine, landmark, birthdate }) {
    const fullAddress = formatFullAddress({ division, district, area, addressLine, landmark });
    if (isSupabaseEnabled()) {
        const result = await supabaseRegister({
            name, email, phone, password, division, district, area, addressLine, landmark,
            address: fullAddress, birthdate
        });
        if (!result.ok) return { ok: false, message: result.message };
        if (result.needsEmailConfirm) {
            await appendUserToGoogleSheet({
                id: "pending-confirm",
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
                division, district, area, addressLine, landmark, birthdate,
                wallet: 0, lifetimeCredits: 0, subscribed: false
            }, "register_pending");
            return { ok: true, needsEmailConfirm: true, message: result.message };
        }
        state.currentUser = result.user;
        syncUserToState(result.user);
        saveState();
        await appendUserToGoogleSheet(result.user, "register");
        return { ok: true };
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (state.users.some(u => u.email === normalizedEmail)) {
        return { ok: false, message: "An account with this email already exists." };
    }
    const user = {
        id: `usr-${Date.now()}`,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        password: btoa(password),
        division: division || "Dhaka",
        district: district || "Dhaka",
        area: area || "Gulshan",
        addressLine: addressLine?.trim() || "",
        landmark: landmark?.trim() || "",
        address: fullAddress,
        birthdate: birthdate || "",
        wallet: 0,
        lifetimeCredits: 0,
        orders: [],
        bookings: [],
        cart: [],
        savedWorkouts: null,
        savedMeals: null,
        wishlist: [],
        returnRequests: [],
        subscribed: false,
        createdAt: new Date().toISOString()
    };
    state.users.push(user);
    state.currentUser = user;
    syncUserToState(user);
    saveState();
    await appendUserToGoogleSheet(user, "register");
    return { ok: true };
}

async function loginUser(email, password) {
    if (isSupabaseEnabled()) {
        const result = await supabaseLogin(email, password);
        if (!result.ok) return result;
        state.currentUser = result.user;
        syncUserToState(result.user);
        saveState();
        return { ok: true };
    }

    const user = state.users.find(u => u.email === email.trim().toLowerCase());
    if (!user || user.password !== btoa(password)) {
        return { ok: false, message: "Invalid email or password." };
    }
    state.currentUser = user;
    syncUserToState(user);
    saveState();
    return { ok: true };
}

async function logoutUser() {
    if (isSupabaseEnabled()) await supabaseLogout();
    clearUserSessionState();
    saveState();
}

function isMerchantUnlocked() {
    return sessionStorage.getItem("eco_merchant_unlocked") === "1";
}

function toggleWishlist(productId) {
    const idx = state.wishlist.indexOf(productId);
    if (idx >= 0) state.wishlist.splice(idx, 1);
    else state.wishlist.push(productId);
    saveState();
    return state.wishlist.includes(productId);
}

function reorderItems(lineItems) {
    if (!lineItems?.length) return 0;
    let added = 0;
    lineItems.forEach(li => {
        const p = state.products.find(prod => prod.id === li.id);
        if (!p || p.inventory <= 0) return;
        const existing = state.cart.find(c => c.id === li.id);
        const qty = Math.min(li.qty, p.inventory);
        if (existing) existing.qty = Math.min(existing.qty + qty, p.inventory);
        else state.cart.push({ id: li.id, qty });
        added++;
    });
    saveState();
    syncCartUI();
    return added;
}

function navigateAfterAuth() {
    const dest = state.redirectAfterAuth || "dashboard";
    state.redirectAfterAuth = null;
    navigateTo(dest);
}

function getCartTotals() {
    const totals = getCheckoutTotals(state, state.activeCoupon);
    return {
        subtotal: totals.subtotal,
        storeDeduction: totals.storeDeduction,
        finalTotal: totals.finalTotal,
        deliveryFee: totals.deliveryFee,
        couponDiscount: totals.couponDiscount,
        itemCount: totals.itemCount
    };
}

async function issueEcoCredits(email, amount) {
    if (isSupabaseEnabled()) {
        const ok = await merchantIssueCredits(email, amount);
        if (!ok) return false;
        if (state.currentUser?.email === email.trim().toLowerCase()) {
            const fresh = await refreshCurrentUserProfile(state.currentUser.id);
            if (fresh) {
                state.wallet = fresh.wallet;
                state.lifetimeCredits = fresh.lifetimeCredits;
                state.currentUser.wallet = fresh.wallet;
                state.currentUser.lifetimeCredits = fresh.lifetimeCredits;
                syncCartUI();
            }
        }
        return true;
    }

    const user = state.users.find(u => u.email === email.trim().toLowerCase());
    if (!user) return false;
    user.wallet = (user.wallet || 0) + amount;
    user.lifetimeCredits = (user.lifetimeCredits || 0) + amount;
    if (state.currentUser?.id === user.id) {
        state.wallet = user.wallet;
        state.lifetimeCredits = user.lifetimeCredits;
        state.currentUser = user;
    }
    saveState();
    return true;
}

function getDeliveryDetailsFromCart() {
    const u = state.currentUser;
    const isLogged = Boolean(u);
    const hasDefault = u && u.division && u.district && u.area && u.addressLine;
    const useDifferentAddress = document.getElementById("use-different-address")?.checked;
    
    if (isLogged && hasDefault && !useDifferentAddress) {
        const profileLoc = locationFromLegacy(u);
        return {
            name: u.name,
            phone: u.phone,
            division: profileLoc.division,
            district: profileLoc.district,
            area: profileLoc.area,
            addressLine: profileLoc.addressLine,
            landmark: profileLoc.landmark,
            address: u.address || formatFullAddress(profileLoc),
            slot: document.getElementById("delivery-slot")?.value || "",
            email: u.email,
            birthdate: u.birthdate
        };
    }
    
    const loc = readLocationFields("delivery");
    return {
        name: document.getElementById("delivery-name")?.value.trim() || "",
        phone: document.getElementById("delivery-phone")?.value.trim() || "",
        division: loc.division,
        district: loc.district,
        area: loc.area,
        addressLine: loc.addressLine,
        landmark: loc.landmark,
        address: formatFullAddress(loc),
        slot: document.getElementById("delivery-slot")?.value || "",
        email: document.getElementById("delivery-email")?.value.trim() || "",
        birthdate: document.getElementById("delivery-birthdate")?.value || ""
    };
}

function prefillDeliveryForm() {
    const u = state.currentUser;
    if (!u) return;
    const loc = locationFromLegacy(u);
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set("delivery-name", u.name);
    set("delivery-phone", u.phone);
    set("delivery-address-line", loc.addressLine);
    set("delivery-landmark", loc.landmark);
}

function validateDeliveryDetails(details) {
    if (!details.name) return "Please enter the recipient name.";
    if (!/^01\d{9}$/.test(details.phone)) return "Please enter a valid 11-digit mobile number.";
    if (!details.division || !details.district || !details.area) return "Please select division, district, and area.";
    if (!details.addressLine || details.addressLine.length < 5) return "Please enter house, road, or block details.";
    
    if (!state.currentUser) {
        if (!details.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) {
            return "Please enter a valid email address.";
        }
        if (!details.birthdate) {
            return "Please enter your date of birth for marketing analysis.";
        }
    }
    
    return null;
}

function renderOrderTracker(status, trackingCode) {
    const idx = ORDER_STATUSES.indexOf(status);
    return `
        <div class="tracking-timeline">
            ${ORDER_STATUSES.map((step, i) => `
                <div class="tracking-step ${i <= idx ? "done" : ""} ${i === idx ? "active" : ""}">
                    <div class="tracking-dot"></div>
                    <div class="tracking-label">${orderStatusLabel(step)}</div>
                </div>
            `).join("")}
        </div>
        <p class="tracking-code">${t("trackingId")}: <strong>${trackingCode}</strong></p>
    `;
}

// Get user loyalty tier based on lifetime Eco-Credits
function getLoyaltyTier(credits) {
    if (credits < 200) return { name: "Eco-Novice", next: "Eco-Guardian", target: 200, progress: (credits / 200) * 100 };
    if (credits < 500) return { name: "Eco-Guardian", next: "Sustainability Sovereign", target: 500, progress: ((credits - 200) / 300) * 100 };
    return { name: "Sustainability Sovereign", next: "Max Tier Achieved", target: 500, progress: 100 };
}

// --- CLIENT-SIDE ROUTER ---
function setupRouting() {
    // Intercept header link clicks
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const page = e.target.getAttribute("data-page");
            navigateTo(page);
        });
    });

    // Handle back/forward buttons
    window.addEventListener("popstate", (e) => {
        if (e.state && e.state.page) {
            renderPage(e.state.page);
        }
    });

    window.addEventListener("hashchange", () => {
        const page = getAppPageFromHash();
        if (!page || page === state.activePage) return;
        state.activePage = page;
        renderPage(page);
    });

    const hash = getAppPageFromHash();
    if (hash) {
        state.activePage = hash;
        renderPage(hash);
    }
}

function navigateTo(page) {
    state.activePage = page;
    window.location.hash = page;
    history.pushState({ page }, "", `#${page}`);
    renderPage(page);
}

// --- GLOBAL EVENT LISTENERS ---
function setupGlobalListeners() {
    const cartToggle = document.getElementById("cart-toggle");
    const cartSlider = document.getElementById("cart-slider");
    const closeCart = document.getElementById("close-cart");

    cartToggle.addEventListener("click", () => {
        cartSlider.classList.add("open");
        renderCartItems();
    });

    document.getElementById("drawer-proceed-btn").addEventListener("click", () => {
        if (state.cart.length === 0) return;
        cartSlider.classList.remove("open");
        navigateTo("checkout");
    });

    document.getElementById("lang-toggle")?.addEventListener("click", () => {
        setLang(getLang() === "en" ? "bn" : "en");
        document.getElementById("lang-toggle").textContent = getLang() === "en" ? "EN" : "বাং";
        updateWhatsAppLinks(document.getElementById("live-chat-input")?.value || "");
        applyShellI18n();
        renderPage(state.activePage);
    });
    const langBtn = document.getElementById("lang-toggle");
    if (langBtn) langBtn.textContent = getLang() === "en" ? "EN" : "বাং";

    closeCart.addEventListener("click", () => cartSlider.classList.remove("open"));
    document.getElementById("bkash-close-btn").addEventListener("click", closeBkashModal);

    document.getElementById("mobile-menu-btn").addEventListener("click", () => {
        document.getElementById("nav-menu").classList.toggle("open");
    });

    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            document.getElementById("nav-menu").classList.remove("open");
        });
    });

    document.getElementById("header-account-btn").addEventListener("click", (e) => {
        e.preventDefault();
        navigateTo(state.currentUser ? "dashboard" : "login");
    });

    document.getElementById("newsletter-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("newsletter-email").value.trim().toLowerCase();
        if (!email) return;
        if (!state.newsletter.includes(email)) state.newsletter.push(email);
        if (state.currentUser) state.currentUser.subscribed = true;
        if (isSupabaseEnabled()) await subscribeNewsletterEmail(email);
        saveState();
        e.target.reset();
        showNotification("Subscribed! Watch your inbox for exclusive member offers.");
    });

    document.getElementById("footer-chat-link")?.addEventListener("click", (e) => {
        e.preventDefault();
        openLiveChat();
    });

    setupLiveChat();
    setupWhatsApp();
    updateHeaderAccount();
}

function updateHeaderAccount() {
    const label = document.getElementById("header-account-label");
    if (label) {
        label.textContent = state.currentUser ? state.currentUser.name.split(" ")[0] : t("signIn");
    }
}

function setupLiveChat() {
    const fab = document.getElementById("live-chat-fab");
    const panel = document.getElementById("live-chat-panel");
    const closeBtn = document.getElementById("live-chat-close");
    const form = document.getElementById("live-chat-form");
    const input = document.getElementById("live-chat-input");

    if (state.chatMessages.length === 0) {
        state.chatMessages.push({
            from: "agent",
            text: "Hello! Welcome to BetterChoice. Ask about delivery, Eco-Credits, or product sourcing.",
            time: new Date().toLocaleTimeString()
        });
        saveState();
    }

    const renderChat = () => {
        const box = document.getElementById("live-chat-messages");
        box.innerHTML = state.chatMessages.map(m => `
            <div class="chat-bubble ${m.from === "user" ? "chat-user" : "chat-agent"}">
                <span>${m.text}</span>
                <small>${m.time}</small>
            </div>
        `).join("");
        box.scrollTop = box.scrollHeight;
    };

    window.openLiveChat = () => {
        panel.classList.add("open");
        renderChat();
    };

    fab.addEventListener("click", openLiveChat);
    closeBtn.addEventListener("click", () => panel.classList.remove("open"));

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        state.chatMessages.push({ from: "user", text, time: new Date().toLocaleTimeString() });
        input.value = "";
        const reply = getChatAutoReply(text);
        setTimeout(() => {
            state.chatMessages.push({ from: "agent", text: reply, time: new Date().toLocaleTimeString() });
            saveState();
            renderChat();
        }, 600);
        saveState();
        renderChat();
    });

    renderChat();
}

function setupWhatsApp() {
    updateWhatsAppLinks();

    document.getElementById("live-chat-whatsapp")?.addEventListener("click", (e) => {
        const draft = document.getElementById("live-chat-input")?.value.trim();
        if (draft) {
            e.preventDefault();
            window.open(getWhatsAppUrl(draft), "_blank", "noopener,noreferrer");
        }
    });

    document.getElementById("footer-whatsapp-link")?.addEventListener("click", (e) => {
        e.preventDefault();
        window.open(getWhatsAppUrl(), "_blank", "noopener,noreferrer");
    });
}

function getChatAutoReply(text) {
    const msg = text.toLowerCase();
    if (msg.includes("deliver") || msg.includes("address")) {
        return "We deliver to Gulshan, Banani, and Dhanmondi with 4 daily time slots. Delivery is ৳80 unless you're Eco-Guardian (200+ credits) or order over ৳1,500.";
    }
    if (msg.includes("eco") || msg.includes("credit") || msg.includes("return")) {
        return "Return amber glass jars or metal tiffins to our courier. Credits (৳25/unit) are issued to your wallet after inspection. Submit a return request in My Account.";
    }
    if (msg.includes("cod") || msg.includes("cash")) {
        return "Cash on Delivery is available on the checkout page. Select it before placing your order.";
    }
    if (msg.includes("track")) {
        return "Use Track Order with your order ID (e.g. OD-123456) or check Orders in My Account.";
    }
    if (msg.includes("coupon") || msg.includes("promo") || msg.includes("discount")) {
        return "Try promo codes WELCOME10 (10% off ৳500+), ECO15 (15% off ৳1000+), or BETTER5 (5% off any order) at checkout.";
    }
    if (msg.includes("wishlist") || msg.includes("save")) {
        return "Tap the ♥ on any product card to save it. View your wishlist in My Account.";
    }
    if (msg.includes("guest")) {
        return "You can checkout as a guest — choose 'Continue as Guest' on the checkout page.";
    }
    if (msg.includes("hour") || msg.includes("open") || msg.includes("time")) {
        return "Delivery slots: Morning 8–12, Afternoon 12–4, Evening 4–8, Night 8–12. Gulshan desk replies 9 AM–9 PM.";
    }
    return "Thanks for reaching out! A wellness concierge will follow up shortly. For urgent orders, call our Gulshan desk.";
}

function renderProductImage(product, className = "product-img") {
    if (product.image) {
        return `<img src="${product.image}" alt="${product.name}" class="${className}" loading="lazy">`;
    }
    return `<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12zm-7-8c-2.76 0-5 2.24-5 5h2c0-1.66 1.34-3 3-3s3 1.34 3 3h2c0-2.76-2.24-5-5-5z"/></svg>`;
}

// Show standard slide-in notification
function showNotification(message) {
    const banner = document.getElementById("notification-banner");
    banner.querySelector(".notification-msg").textContent = message;
    banner.classList.add("show");
    setTimeout(() => {
        banner.classList.remove("show");
    }, 4000);
}

// --- UI SYNC & RENDER MANAGERS ---
function syncCartUI() {
    const badge = document.getElementById("cart-badge-count");
    const totalQty = state.cart.reduce((sum, item) => sum + item.qty, 0);
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? "flex" : "none";

    const { subtotal, itemCount } = getCartTotals();
    const countEl = document.getElementById("cart-item-count");
    const subEl = document.getElementById("cart-drawer-subtotal");
    if (countEl) countEl.textContent = `${itemCount} ${t("items")}`;
    if (subEl) subEl.textContent = `৳${subtotal}`;

    const walletBadge = document.getElementById("header-eco-wallet");
    walletBadge.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 3.99L19.53 19H4.47L12 5.99zM13 16h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
        ${state.wallet} ${t("ecoCreditsLabel")}
    `;
}

function renderPage(page) {
    // Set active link in navbar
    document.querySelectorAll(".nav-link").forEach(link => {
        if (link.getAttribute("data-page") === page) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });

    const content = document.getElementById("main-content");
    content.innerHTML = ""; // Clear active viewport

    switch (page) {
        case "shop":
            renderShopView(content);
            break;
        case "traceability":
            renderTraceabilityView(content);
            break;
        case "workout":
            renderWorkoutView(content);
            break;
        case "meals":
            renderMealView(content);
            break;
        case "experts":
            renderExpertsView(content);
            break;
        case "editorial":
            renderEditorialView(content);
            break;
        case "dashboard":
            renderDashboardView(content);
            break;
        case "login":
            renderLoginView(content);
            break;
        case "register":
            renderRegisterView(content);
            break;
        case "track":
            renderTrackView(content);
            break;
        case "about":
            renderAboutView(content);
            break;
        case "policies":
            renderPoliciesView(content);
            break;
        case "checkout":
            renderCheckoutView(content);
            break;
        default:
            renderShopView(content);
    }
    syncCartUI();
    updateHeaderAccount();
    applyShellI18n();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- AUTH VIEWS ---
function renderLoginView(container) {
    container.innerHTML = `
        <div class="auth-card">
            <h2>Welcome Back</h2>
            <p>Sign in to track orders, manage your profile, and redeem Eco-Credits.</p>
            <form id="login-form">
                <div class="form-group"><label>Email</label><input type="email" id="login-email" class="form-control" required></div>
                <div class="form-group"><label>Password</label><input type="password" id="login-password" class="form-control" required></div>
                <button type="submit" class="submit-btn">Sign In</button>
            </form>
            <p class="auth-switch">No account? <a href="#register" id="go-register">Create one</a></p>
            ${isSupabaseEnabled() ? `<p class="auth-switch"><a href="#" id="resend-confirm-link">Resend confirmation email</a></p>` : ""}
        </div>
    `;
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const result = await loginUser(
            document.getElementById("login-email").value,
            document.getElementById("login-password").value
        );
        if (!result.ok) {
            alert(result.message);
            if (result.needsEmailConfirm) document.getElementById("resend-confirm-link")?.scrollIntoView({ behavior: "smooth" });
            return;
        }
        updateHeaderAccount();
        showNotification(`Welcome back, ${state.currentUser.name}!`);
        navigateAfterAuth();
    });
    document.getElementById("go-register").addEventListener("click", (e) => {
        e.preventDefault();
        navigateTo("register");
    });
    const forgot = document.createElement("p");
    forgot.className = "auth-switch";
    forgot.innerHTML = isSupabaseEnabled()
        ? `<a href="#" id="forgot-hint">Forgot password?</a> — we'll email you a reset link.`
        : `<a href="#" id="forgot-hint">Forgot password?</a> — contact Gulshan desk with your registered email.`;
    document.querySelector("#login-form")?.after(forgot);
    document.getElementById("forgot-hint")?.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        if (!email) { alert("Enter your email above first."); return; }
        if (isSupabaseEnabled()) {
            const result = await supabaseResetPassword(email);
            alert(result.ok ? result.message : result.message);
        } else {
            alert("Contact Gulshan desk to reset your password.");
        }
    });
    document.getElementById("resend-confirm-link")?.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        if (!email) { alert("Enter your email above first."); return; }
        const result = await resendConfirmationEmail(email);
        alert(result.ok ? result.message : result.message);
    });
}

function renderRegisterView(container) {
    container.innerHTML = `
        <div class="auth-card auth-card-wide">
            <h2>Create Account</h2>
            <p>Join BetterChoice for order tracking, wallet credits, and exclusive offers.</p>
            <form id="register-form">
                <div class="form-group"><label>Full Name</label><input type="text" id="reg-name" class="form-control" required></div>
                <div class="form-group"><label>Email</label><input type="email" id="reg-email" class="form-control" required></div>
                <div class="form-group"><label>Mobile</label><input type="tel" id="reg-phone" class="form-control" placeholder="01XXXXXXXXX" maxlength="11" required></div>
                <div class="form-group"><label>Date of Birth</label><input type="date" id="reg-birthdate" class="form-control" required max="${new Date().toISOString().slice(0, 10)}"></div>
                <h4 class="form-section-title">Default delivery location</h4>
                ${renderLocationFieldsHtml("reg")}
                <div class="form-group"><label>Password</label><input type="password" id="reg-password" class="form-control" minlength="6" required></div>
                <button type="submit" class="submit-btn">Create Account</button>
            </form>
            <p class="auth-switch">Already have an account? <a href="#login" id="go-login">Sign in</a></p>
        </div>
    `;
    bindLocationFields("reg");
    document.getElementById("register-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const phone = document.getElementById("reg-phone").value.trim();
        if (!/^01\d{9}$/.test(phone)) { alert("Enter a valid 11-digit mobile number."); return; }
        const loc = readLocationFields("reg");
        const result = await registerUser({
            name: document.getElementById("reg-name").value,
            email: document.getElementById("reg-email").value,
            phone,
            password: document.getElementById("reg-password").value,
            birthdate: document.getElementById("reg-birthdate").value,
            ...loc
        });
        if (!result.ok) { alert(result.message); return; }
        if (result.needsEmailConfirm) {
            alert(result.message + "\n\nTip: Open the confirmation link on the same computer where you run BetterChoice (localhost). For phone customers, deploy the site first or disable email confirmation in Supabase.");
            navigateTo("login");
            return;
        }
        updateHeaderAccount();
        showNotification("Account created! You can now place and track orders.");
        navigateAfterAuth();
    });
    document.getElementById("go-login").addEventListener("click", (e) => {
        e.preventDefault();
        navigateTo("login");
    });
}

function renderTrackView(container) {
    const lookup = localStorage.getItem(TRACKING_LOOKUP_KEY) || "";
    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>${t("trackTitle")}</h2>
                <p>${t("trackSubtitle")}</p>
            </div>
        </div>
        <div class="track-lookup-card">
            <form id="track-form" class="track-form">
                <input type="text" id="track-order-id" class="form-control" placeholder="${t("trackPlaceholder")}" value="${lookup}" required>
                <button type="submit" class="submit-btn">${t("trackButton")}</button>
            </form>
            <div id="track-result"></div>
        </div>
    `;

    const showResult = async (orderId) => {
        const result = document.getElementById("track-result");
        let order = null;

        if (isSupabaseEnabled()) {
            order = await trackOrderById(orderId);
        }
        if (!order) {
            const allOrders = state.currentUser
                ? state.orders
                : [...state.orders, ...state.users.flatMap(u => u.orders || [])];
            order = allOrders.find(o => o.id.toUpperCase() === orderId.toUpperCase());
        }

        if (!order) {
            result.innerHTML = `<p class="track-error">${t("trackNotFound", { id: orderId })}</p>`;
            return;
        }
        result.innerHTML = `
            <div class="track-result-card">
                <h3>Order ${order.id}</h3>
                <p><strong>Placed:</strong> ${order.date} &nbsp;|&nbsp; <strong>Payment:</strong> ${order.paymentMethod || "bKash"}</p>
                <p><strong>Deliver to:</strong> ${order.address || formatFullAddress(order)}</p>
                <p><strong>Location:</strong> ${[order.division, order.district, order.area].filter(Boolean).join(" · ")}</p>
                ${renderOrderTracker(order.status || "Confirmed", order.trackingCode || order.id)}
            </div>
        `;
    };

    document.getElementById("track-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("track-order-id").value.trim();
        localStorage.setItem(TRACKING_LOOKUP_KEY, id);
        showResult(id);
    });

    if (lookup) showResult(lookup);
}

function formatPolicyText(text) {
    return text
        .split("\n\n")
        .map(p => `<p>${p.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`)
        .join("");
}

function renderAboutView(container) {
    const c = COMPANY_PROFILE;
    container.innerHTML = `
        <div class="about-hero">
            <span class="about-hero-tag">Our Story</span>
            <h1>Redefining Wellness &amp; Sustainability in Bangladesh</h1>
            <p class="about-hero-lead">${c.mission}</p>
        </div>

        <div class="about-stats-row">
            ${c.stats.map(s => `
                <div class="about-stat">
                    <div class="about-stat-value">${s.value}</div>
                    <div class="about-stat-label">${s.label}</div>
                </div>
            `).join("")}
        </div>

        <div class="static-content-grid">
            <div class="static-content-card">
                <h2>Who We Are</h2>
                <p class="about-vision"><em>${c.vision}</em></p>
                <div class="about-story">${c.story.split("\n\n").map(p => `<p>${p}</p>`).join("")}</div>
            </div>
            <div class="static-content-card about-values-card">
                <h2>What We Stand For</h2>
                <div class="values-grid">
                    ${c.values.map(v => `
                        <div class="value-item">
                            <h3>${v.title}</h3>
                            <p>${v.desc}</p>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>

        <div class="page-header" style="margin-top:50px;">
            <div class="page-title">
                <h2>Leadership</h2>
                <p>The team behind Bengal's zero-plastic wellness revolution</p>
            </div>
        </div>
        <div class="leadership-grid">
            ${c.leadership.map(l => `
                <div class="leadership-card">
                    <div class="leadership-avatar">${l.name.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
                    <h3>${l.name}</h3>
                    <span class="leadership-role">${l.role}</span>
                    <p>${l.bio}</p>
                </div>
            `).join("")}
        </div>

        <div class="about-contact-banner">
            <div>
                <h3>Partner With BetterChoice</h3>
                <p>Organic farms, fisheries, artisans, and corporate wellness programs — we welcome aligned partners.</p>
            </div>
            <div class="about-contact-details">
                <span>${c.contact.hq}</span>
                <span>${c.contact.email}</span>
                <span>${c.contact.phone}</span>
            </div>
            <button class="hero-cta" id="about-chat-btn">Talk to Our Team</button>
        </div>
    `;
    document.getElementById("about-chat-btn").addEventListener("click", () => openLiveChat());
}

function renderPoliciesView(container) {
    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Customer Policies</h2>
                <p>Shipping, returns, Eco-Credits, payments, privacy, and terms of service</p>
            </div>
        </div>

        <div class="policies-layout">
            <nav class="policies-nav" id="policies-nav">
                ${CUSTOMER_POLICIES.map(p => `
                    <a href="#policies" class="policies-nav-link" data-policy="${p.id}">${p.title}</a>
                `).join("")}
            </nav>
            <div class="policies-content">
                ${CUSTOMER_POLICIES.map(p => `
                    <details class="policy-section" id="policy-${p.id}">
                        <summary>${p.title}</summary>
                        <div class="policy-body">${formatPolicyText(p.content)}</div>
                    </details>
                `).join("")}
            </div>
        </div>

        <div class="policies-footer-note">
            <p>Questions about our policies? <a href="#" id="policies-chat-link">Open Live Chat</a> or email <a href="mailto:hello@betterchoice.bd">hello@betterchoice.bd</a></p>
            <p style="font-size:12px; color:#888; margin-top:8px;">Last updated: June 2026 · BSTI Accredited Partners</p>
        </div>
    `;

    container.querySelectorAll(".policies-nav-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const id = link.getAttribute("data-policy");
            const section = document.getElementById(`policy-${id}`);
            if (section) {
                section.open = true;
                section.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });

    document.getElementById("policies-chat-link").addEventListener("click", (e) => {
        e.preventDefault();
        openLiveChat();
    });
}

// --- SHOP VIEW ---
function renderShopView(container) {
    const categoryChips = SHOP_CATEGORY_CHIPS.map((c, i) =>
        `<button class="filter-chip ${i === 0 ? "active" : ""}" data-category="${c.value}">${t(c.labelKey)}</button>`
    ).join("");

    container.innerHTML = `
        <div class="hero-banner">
            <div class="hero-content">
                <span class="hero-tag">${t("heroTag")}</span>
                <h1>${t("heroTitle")}</h1>
                <p>${t("heroDesc")}</p>
                <a href="#shop" class="hero-cta" id="hero-browse-btn">${t("heroBrowse")}</a>
            </div>
        </div>

        <div class="page-header">
            <div class="page-title">
                <h2>${t("catalogTitle")}</h2>
                <p>${t("catalogSubtitle")}</p>
            </div>
            <div class="shop-toolbar">
                <input type="text" id="catalog-search" class="form-control" placeholder="${t("searchProducts")}">
                <select id="catalog-sort" class="form-control">
                    <option value="default">${t("sortDefault")}</option>
                    <option value="price-asc">${t("sortPriceAsc")}</option>
                    <option value="price-desc">${t("sortPriceDesc")}</option>
                    <option value="name">${t("sortName")}</option>
                </select>
            </div>
        </div>

        <div class="filter-container">
            <div class="filter-row" id="category-filters">
                ${categoryChips}
            </div>
            <div class="filter-row" id="subcategory-filters"></div>
        </div>

        <div class="product-grid" id="shop-product-grid"></div>
    `;

    document.getElementById("hero-browse-btn").addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector(".page-header").scrollIntoView({ behavior: "smooth" });
    });

    const productGrid = document.getElementById("shop-product-grid");
    const searchInput = document.getElementById("catalog-search");
    const sortSelect = document.getElementById("catalog-sort");
    const subcatRow = document.getElementById("subcategory-filters");
    let activeCat = "All";
    let activeSubcat = "All";

    const renderSubcategoryFilters = () => {
        const subs = [...new Set(
            state.products
                .filter(p => activeCat === "All" || p.category === activeCat)
                .map(p => p.subcategory)
                .filter(Boolean)
        )].sort();
        subcatRow.innerHTML = `<button class="filter-chip ${activeSubcat === "All" ? "active" : ""}" data-subcat="All">${t("allTypes")}</button>` +
            subs.map(s => `<button class="filter-chip ${activeSubcat === s ? "active" : ""}" data-subcat="${s}">${subcategoryLabel(s)}</button>`).join("");
        subcatRow.querySelectorAll(".filter-chip").forEach(chip => {
            chip.addEventListener("click", (e) => {
                activeSubcat = e.target.getAttribute("data-subcat");
                subcatRow.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
                e.target.classList.add("active");
                filterAndRender();
            });
        });
    };

    const filterAndRender = () => {
        const query = searchInput.value.toLowerCase().trim();
        const sort = sortSelect.value;
        let filtered = state.products.filter(p => {
            const matchesCat = activeCat === "All" || p.category === activeCat;
            const matchesSub = activeSubcat === "All" || p.subcategory === activeSubcat;
            const matchesSearch = p.name.toLowerCase().includes(query) || 
                                  p.description.toLowerCase().includes(query) || 
                                  p.subcategory.toLowerCase().includes(query);
            return matchesCat && matchesSub && matchesSearch;
        });

        if (sort === "price-asc") filtered.sort((a, b) => getActivePrice(a) - getActivePrice(b));
        else if (sort === "price-desc") filtered.sort((a, b) => getActivePrice(b) - getActivePrice(a));
        else if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));

        if (filtered.length === 0) {
            productGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#666;">${t("noProductsFound")}</div>`;
            return;
        }

        productGrid.innerHTML = filtered.map(p => {
            const isDiscounted = p.salePrice > 0 && p.salePrice < p.price;
            const displayPrice = isDiscounted ? p.salePrice : p.price;
            
            let stockBadge = "";
            let disableBtn = "";
            let btnText = t("add");
            
            if (p.inventory === 0) {
                stockBadge = `<span class="badge" style="background-color:#E2136E; color:#fff;">${t("outOfStock")}</span>`;
                disableBtn = "disabled style='background-color:#bbb; cursor:not-allowed;'";
                btnText = t("soldOut");
            } else if (p.inventory <= 5) {
                stockBadge = `<span class="badge" style="background-color:var(--gold); color:#121212;">${t("onlyLeft", { n: p.inventory })}</span>`;
            } else {
                stockBadge = `<span class="badge" style="background-color:#fff; color:#555; border:1px solid #ddd;">${t("stockLabel", { n: p.inventory })}</span>`;
            }

            const isWishlisted = state.wishlist.includes(p.id);

            return `
                <div class="product-card" data-id="${p.id}" role="button" tabindex="0" aria-label="View ${p.name}">
                    <div class="product-image-container">
                        ${renderProductImage(p)}
                        <div class="product-badges">
                            ${p.organic ? `<span class="badge badge-organic">${t("badgeOrganic")}</span>` : ""}
                            ${p.bpafree ? `<span class="badge badge-plastic-free">${t("badgeZeroPlastic")}</span>` : ""}
                            ${isDiscounted ? `<span class="badge" style="background-color:#E2136E; color:#fff;">${t("sale")}</span>` : ""}
                            ${stockBadge}
                        </div>
                        <button type="button" class="wishlist-btn ${isWishlisted ? "active" : ""}" data-id="${p.id}" aria-label="Add to wishlist" title="Save to wishlist">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </button>
                    </div>
                    <div class="product-info">
                        <span class="product-category">${subcategoryLabel(p.subcategory)}</span>
                        <h3 class="product-name">${p.name}</h3>
                        <div class="product-order-unit">${t("perOrder")} <strong>${getOrderUnit(p)}</strong></div>
                        <div class="product-packaging">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                            <span>${p.packaging}</span>
                        </div>
                        
                        ${p.protein > 0 || p.calories > 0 ? `
                            <div class="product-card-macros">
                                <span class="macro-tag">${p.calories} kcal</span>
                                <span class="macro-tag">P: ${p.protein}g</span>
                                <span class="macro-tag">C: ${p.carbs}g</span>
                            </div>
                        ` : ""}

                        <div class="product-price-action">
                            <div style="display:flex; flex-direction:column;">
                                ${isDiscounted ? `<span style="font-size:12px; text-decoration:line-through; color:#999; margin-bottom:-4px;">৳${p.price}</span>` : ""}
                                <span class="product-price">৳${displayPrice}<span class="product-unit"> / ${getOrderUnit(p)}</span></span>
                            </div>
                            <button class="add-to-cart-btn" data-id="${p.id}" ${disableBtn}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                                ${btnText}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        // Bind clicks inside product cards
        productGrid.querySelectorAll(".product-card").forEach(card => {
            const openDetail = () => {
                const id = card.getAttribute("data-id");
                state.activeProductTrace = state.products.find(p => p.id === id);
                navigateTo("traceability");
            };
            card.addEventListener("click", openDetail);
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail();
                }
            });
        });

        productGrid.querySelectorAll(".add-to-cart-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = e.currentTarget.getAttribute("data-id");
                addToCart(id);
            });
        });
        productGrid.querySelectorAll(".wishlist-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = e.currentTarget.getAttribute("data-id");
                const on = toggleWishlist(id);
                e.currentTarget.classList.toggle("active", on);
                showNotification(on ? "Added to wishlist." : "Removed from wishlist.");
            });
        });

    };
    // Category filters bind
    document.querySelectorAll("#category-filters .filter-chip").forEach(chip => {
        chip.addEventListener("click", (e) => {
            document.querySelectorAll("#category-filters .filter-chip").forEach(c => c.classList.remove("active"));
            e.target.classList.add("active");
            activeCat = e.target.getAttribute("data-category");
            activeSubcat = "All";
            renderSubcategoryFilters();
            filterAndRender();
        });
    });

    searchInput.addEventListener("input", filterAndRender);
    sortSelect.addEventListener("change", filterAndRender);
    renderSubcategoryFilters();
    filterAndRender();
}

// --- PRODUCT TRACEABILITY VIEW (QR Target) ---
async function renderTraceabilityView(container) {
    if (!state.activeProductTrace) {
        container.innerHTML = `
            <div style="text-align:center; padding:100px;">
                <p>Please select a product from the Catalog to inspect its sourcing profile.</p>
                <a href="#shop" class="hero-cta" style="margin-top:20px; display:inline-block;">Go to Shop</a>
            </div>
        `;
        return;
    }

    const p = state.activeProductTrace;
    container.innerHTML = `<div style="text-align:center;padding:48px;color:#666;">Loading product details…</div>`;

    let reviews = state.productReviews[p.id] || [];
    if (isSupabaseEnabled()) {
        try {
            reviews = await fetchProductReviews(p.id);
            state.productReviews[p.id] = reviews;
        } catch (e) {
            console.warn("Failed to load reviews:", e);
        }
    }

    const isDiscounted = p.salePrice > 0 && p.salePrice < p.price;
    const displayPrice = isDiscounted ? p.salePrice : p.price;
    const isOutOfStock = p.inventory === 0;
    const images = p.images?.length ? p.images : (p.image ? [p.image] : []);
    const traceUrl = getProductTraceUrl(p.id);
    const related = state.products
        .filter(r => r.id !== p.id && (r.subcategory === p.subcategory || r.category === p.category))
        .slice(0, 4);
    const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Traceable Sourcing & Macro Transparency</h2>
                <p>Verifying farm origins, lab certifications, and biochemical stats</p>
            </div>
            <button class="filter-chip" id="trace-back-btn">← Back to Shop</button>
        </div>

        <div class="traceability-page">
            <div class="traceability-visuals">
                <div class="traceability-image">
                    ${images.length
                        ? `<img src="${images[0]}" alt="${p.name}" class="traceability-product-img" id="trace-main-img" loading="lazy">`
                        : `<svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor" style="color:var(--forest-green); opacity:0.4;"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12zm-7-8c-2.76 0-5 2.24-5 5h2c0-1.66 1.34-3 3-3s3 1.34 3 3h2c0-2.76-2.24-5-5-5z"/></svg>`}
                    ${images.length > 1 ? `<div class="trace-gallery-thumbs">${images.map((img, i) => `<button type="button" class="trace-thumb ${i === 0 ? "active" : ""}" data-img="${img}"><img src="${img}" alt=""></button>`).join("")}</div>` : ""}
                </div>
                <div class="traceability-qr-box">
                    <h4>Verified Product QR Code</h4>
                    <canvas id="trace-qr-canvas" width="120" height="120"></canvas>
                    <p style="font-size:10px; margin-top:8px; color:#666; word-break:break-all;">${traceUrl}</p>
                    <button type="button" class="filter-chip" id="trace-copy-link" style="margin-top:8px;">Copy Trace Link</button>
                </div>
            </div>

            <div class="traceability-content">
                <span class="product-category" style="font-size:12px;">${p.category} // ${p.subcategory}</span>
                <h3>${p.name}</h3>
                <p class="product-order-unit" style="margin-bottom:16px;">Sold per: <strong>${getOrderUnit(p)}</strong></p>
                <p style="margin-bottom: 25px; font-size:15px; color:#4a4a4a;">${p.description}</p>
                
                <div class="trace-origin-card">
                    <h4>Exact Farm of Origin</h4>
                    <p><strong>${p.origin}</strong></p>
                    <p style="font-size:12px; color:#555; margin-top:4px;">Raised/cultivated in strict alignment with Bangladeshi delta ecological guidelines, without chemical runs or plastic-lined groundwater contamination.</p>
                </div>

                <div class="certifications-section">
                    <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:0.08em;">Lab Safety Clearances & Operational Stats</h4>
                    <div class="cert-badge-row" style="flex-wrap:wrap; gap:10px;">
                        <div class="cert-badge">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/></svg>
                            <span>Certificate: ${p.labCert}</span>
                        </div>
                        <div class="cert-badge">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            <span>100% BPA Free</span>
                        </div>
                        <div class="cert-badge" style="background-color: ${isOutOfStock ? 'rgba(226,19,110,0.05)' : 'rgba(30,58,47,0.05)'};">
                            <span>Inventory: ${isOutOfStock ? "Out of Stock" : `${p.inventory} × ${getOrderUnit(p)} available`}</span>
                        </div>
                    </div>
                </div>

                <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">Macronutrient & Energy Breakdown (per ${p.servingSize || p.servingsize || "serving"})</h4>
                <div class="nutrition-grid">
                    <div class="nutrition-item">
                        <div class="nutrition-val">${p.calories}</div>
                        <div class="nutrition-lbl">Calories</div>
                    </div>
                    <div class="nutrition-item">
                        <div class="nutrition-val">${p.protein}g</div>
                        <div class="nutrition-lbl">Protein</div>
                    </div>
                    <div class="nutrition-item">
                        <div class="nutrition-val">${p.carbs}g</div>
                        <div class="nutrition-lbl">Carbs</div>
                    </div>
                    <div class="nutrition-item">
                        <div class="nutrition-val">${p.fat}g</div>
                        <div class="nutrition-lbl">Fat</div>
                    </div>
                </div>
                
                <div style="margin-top:35px; border-top:1px solid var(--border-color); padding-top:25px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <span style="font-size:12px; color:#666;">Unit Price</span>
                            <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;">
                                <div style="font-size:24px; font-weight:600;">৳${displayPrice}<span class="product-unit"> / ${getOrderUnit(p)}</span></div>
                                ${isDiscounted ? `<div style="font-size:14px; text-decoration:line-through; color:#999;">৳${p.price}</div>` : ""}
                            </div>
                        </div>
                        <button class="add-to-cart-btn" id="trace-add-cart-btn" style="padding:14px 28px;" ${isOutOfStock ? "disabled style='background-color:#bbb; cursor:not-allowed;'" : ""}>
                            ${isOutOfStock ? "Sold Out" : "Add to Cart"}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        ${related.length ? `
        <div class="related-products-section">
            <h3 style="font-family:var(--font-heading); margin:30px 0 16px;">Related Products</h3>
            <div class="related-products-row">
                ${related.map(r => `
                    <div class="related-product-card" data-id="${r.id}">
                        ${r.image ? `<img src="${r.image}" alt="${r.name}">` : ""}
                        <span>${r.name}</span>
                        <strong>৳${getActivePrice(r)}</strong>
                    </div>
                `).join("")}
            </div>
        </div>` : ""}

        <div class="product-reviews-section">
            <h3 style="font-family:var(--font-heading); margin:30px 0 12px;">Customer Reviews ${avgRating ? `(${avgRating}★)` : ""}</h3>
            ${reviews.length ? reviews.map(r => `
                <div class="review-card">
                    <strong>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</strong>
                    <p>${r.text}</p>
                    <small>${r.user} · ${r.date}</small>
                </div>
            `).join("") : `<p style="color:#666; font-size:14px;">No reviews yet.</p>`}
            ${state.currentUser ? `
            <form id="review-form" class="review-form">
                <label>Your rating</label>
                <select id="review-rating" class="form-control"><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select>
                <textarea id="review-text" class="form-control" rows="2" placeholder="Share your experience..." required></textarea>
                <button type="submit" class="submit-btn">Submit Review</button>
            </form>` : `<p style="font-size:13px; color:#888; margin-top:12px;"><a href="#login">Sign in</a> to leave a review.</p>`}
        </div>
    `;

    document.getElementById("trace-back-btn").addEventListener("click", () => {
        navigateTo("shop");
    });

    const qrCanvas = document.getElementById("trace-qr-canvas");
    if (qrCanvas) drawQRToCanvas(qrCanvas, traceUrl);

    document.getElementById("trace-copy-link")?.addEventListener("click", () => {
        navigator.clipboard?.writeText(traceUrl);
        showNotification("Trace link copied!");
    });

    container.querySelectorAll(".trace-thumb").forEach(btn => {
        btn.addEventListener("click", () => {
            document.getElementById("trace-main-img").src = btn.getAttribute("data-img");
            container.querySelectorAll(".trace-thumb").forEach(t => t.classList.remove("active"));
            btn.classList.add("active");
        });
    });

    container.querySelectorAll(".related-product-card").forEach(card => {
        card.addEventListener("click", () => {
            state.activeProductTrace = state.products.find(pr => pr.id === card.getAttribute("data-id"));
            renderPage("traceability");
        });
    });

    document.getElementById("review-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const rating = parseInt(document.getElementById("review-rating").value, 10);
        const text = document.getElementById("review-text").value.trim();
        if (isSupabaseEnabled() && isCloudUser()) {
            const result = await submitProductReview({
                productId: p.id,
                userId: state.currentUser.id,
                userName: state.currentUser.name,
                rating,
                text
            });
            if (!result.ok) { alert(result.message || "Could not submit review."); return; }
        } else {
            if (!state.productReviews[p.id]) state.productReviews[p.id] = [];
            state.productReviews[p.id].push({
                user: state.currentUser.name,
                rating,
                text,
                date: new Date().toLocaleDateString()
            });
            saveState();
        }
        showNotification("Review submitted!");
        renderPage("traceability");
    });

    if (!isOutOfStock) {
        document.getElementById("trace-add-cart-btn").addEventListener("click", () => {
            addToCart(p.id);
        });
    }
}

// --- DYNAMIC WORKOUT PLANNER ---
function renderWorkoutView(container) {
    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Dynamic Wellness & Workout Planner</h2>
                <p>Construct customized fitness splits designed around urban Bangladeshi life</p>
            </div>
        </div>

        <div class="workout-builder-layout">
            <div class="builder-panel">
                <h3 style="font-family:var(--font-heading); font-size:22px; margin-bottom:20px; color:var(--forest-green)">Biometrics & Schedule</h3>
                <form id="workout-form">
                    <div class="form-group">
                        <label for="workout-goal">Primary Fitness Goal</label>
                        <select id="workout-goal" class="form-control">
                            <option value="hypertrophy">Hypertrophy (Muscle Gain)</option>
                            <option value="fatloss">Fat Loss & Conditioning</option>
                            <option value="mobility">Sustainable Mobility</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="workout-split">Weekly Split Structure</label>
                        <select id="workout-split" class="form-control">
                            <option value="3">3 Days (Full Body)</option>
                            <option value="4">4 Days (Upper / Lower)</option>
                            <option value="5">5 Days (Push/Pull/Legs + arms)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="workout-commute">Commute Time & Commute Stress</label>
                        <select id="workout-commute" class="form-control">
                            <option value="low">Low (< 30 min daily commute)</option>
                            <option value="med">Medium (30 - 90 min daily traffic)</option>
                            <option value="high">High (90+ min daily commute - Heavy fatigue)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="workout-monsoon">Monsoon Adaptability</label>
                        <select id="workout-monsoon" class="form-control">
                            <option value="yes">Monsoon Lockdown (Home workout alternates)</option>
                            <option value="no">Gym Bound (Access to a physical facility)</option>
                        </select>
                    </div>
                    <button type="submit" class="submit-btn">Generate Plan</button>
                </form>
            </div>

            <div class="workout-result-panel" id="workout-result-container">
                <div class="workout-placeholder">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6.5 6.5h11v11h-11zM2 9h4.5M17.5 9H22M2 15h4.5M17.5 15H22"/></svg>
                    <h3>Calibrate Your Regime</h3>
                    <p style="font-size:14px; max-width:320px; margin:10px auto 0;">Provide your goals and daily constraints to outline progressive load splits.</p>
                </div>
            </div>
        </div>
    `;

    // Fill inputs with previously saved workout if it exists
    if (state.savedWorkouts) {
        document.getElementById("workout-goal").value = state.savedWorkouts.inputs.goal;
        document.getElementById("workout-split").value = state.savedWorkouts.inputs.split;
        document.getElementById("workout-commute").value = state.savedWorkouts.inputs.commute;
        document.getElementById("workout-monsoon").value = state.savedWorkouts.inputs.monsoon;
        renderGeneratedWorkout(state.savedWorkouts.plan);
    }

    document.getElementById("workout-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const goal = document.getElementById("workout-goal").value;
        const split = parseInt(document.getElementById("workout-split").value);
        const commute = document.getElementById("workout-commute").value;
        const monsoon = document.getElementById("workout-monsoon").value;

        const generatedPlan = calculateWorkoutPlan(goal, split, commute, monsoon);
        state.savedWorkouts = {
            inputs: { goal, split, commute, monsoon },
            plan: generatedPlan
        };
        saveState();
        renderGeneratedWorkout(generatedPlan);
        showNotification("Workout plan generated and synchronized with profile!");
    });
}

function calculateWorkoutPlan(goal, splitDays, commute, monsoon) {
    const workouts = [];
    const intensity = commute === "high" ? "Moderate Intensity (FATIGUE REGULATION)" : "High Intensity (PROGRESSIVE OVERLOAD)";
    
    // Choose exercise variations based on Monsoon
    const homeOrGym = monsoon === "yes";

    const exercisesDb = {
        chest: homeOrGym ? ["Decline Push-ups (Tempo 3-0-1)", "Floor Dips", "Standard Pushups"] : ["Incline Dumbbell Press", "Barbell Bench Press", "Cable Chest Fly"],
        back: homeOrGym ? ["Towel Isometric Rows", "Door-Frame Pull-ups", "Prone Back Extensions"] : ["Lat Pull-downs", "Barbell Row", "Single-Arm Dumbbell Row"],
        legs: homeOrGym ? ["Pistol Squats", "Bulgarian Split Squats (Slow tempo)", "Glute Bridges"] : ["Barbell Back Squats", "Romanian Deadlifts", "Leg Press"],
        shoulders: homeOrGym ? ["Handstand Hold/Push-ups", "Pike Push-ups", "Water Jar Lateral Raises"] : ["Overhead Barbell Press", "Dumbbell Lateral Raises", "Face Pulls"],
        core: ["Plank Hold (1 min)", "Hanging Leg Raises", "Bicycle Crunches"]
    };

    for (let i = 1; i <= splitDays; i++) {
        let title = `Day ${i}: `;
        let exercises = [];

        if (splitDays === 3) {
            title += "Full Body Calisthenics & Strength";
            exercises = [
                { name: exercisesDb.legs[0], sets: "3 Sets x 8-12 Reps" },
                { name: exercisesDb.chest[0], sets: "3 Sets x 10-15 Reps" },
                { name: exercisesDb.back[0], sets: "3 Sets x 10-12 Reps" },
                { name: exercisesDb.shoulders[1], sets: "2 Sets x 12-15 Reps" },
                { name: exercisesDb.core[0], sets: "3 Sets to Failure" }
            ];
        } else if (splitDays === 4) {
            if (i % 2 === 1) {
                title += "Upper Body Blast";
                exercises = [
                    { name: exercisesDb.chest[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.back[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.shoulders[0], sets: "3 Sets x 10-12 Reps" },
                    { name: exercisesDb.chest[1], sets: "3 Sets x 12 Reps" }
                ];
            } else {
                title += "Lower Body & Core";
                exercises = [
                    { name: exercisesDb.legs[0], sets: "4 Sets x 8-12 Reps" },
                    { name: exercisesDb.legs[1], sets: "3 Sets x 12-15 Reps" },
                    { name: exercisesDb.legs[2], sets: "3 Sets x 15 Reps" },
                    { name: exercisesDb.core[1], sets: "3 Sets x 15 Reps" }
                ];
            }
        } else {
            const pushPullLegs = ["Push Day", "Pull Day", "Leg Day", "Shoulder focus", "Arm Hypertrophy"];
            title += pushPullLegs[i - 1];
            if (i === 1) {
                exercises = [
                    { name: exercisesDb.chest[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.chest[1], sets: "3 Sets x 12 Reps" },
                    { name: exercisesDb.shoulders[1], sets: "3 Sets x 15 Reps" }
                ];
            } else if (i === 2) {
                exercises = [
                    { name: exercisesDb.back[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.back[1], sets: "3 Sets x 12 Reps" },
                    { name: exercisesDb.core[0], sets: "3 Sets" }
                ];
            } else if (i === 3) {
                exercises = [
                    { name: exercisesDb.legs[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.legs[1], sets: "3 Sets x 12 Reps" },
                    { name: exercisesDb.legs[2], sets: "3 Sets x 15 Reps" }
                ];
            } else if (i === 4) {
                exercises = [
                    { name: exercisesDb.shoulders[0], sets: "4 Sets x 8-12 Reps" },
                    { name: exercisesDb.shoulders[1], sets: "3 Sets x 15 Reps" },
                    { name: exercisesDb.core[1], sets: "3 Sets" }
                ];
            } else {
                exercises = [
                    { name: "Chin-Ups / Bicep Curls", sets: "4 Sets x 10 Reps" },
                    { name: "Diamond Push-ups / Tricep Pushdowns", sets: "4 Sets x 12 Reps" },
                    { name: "Wrist Roller / Forearm Curls", sets: "3 Sets x 15 Reps" }
                ];
            }
        }

        workouts.push({ title, exercises, intensity });
    }

    return workouts;
}

function renderGeneratedWorkout(plan) {
    const container = document.getElementById("workout-result-container");
    container.innerHTML = `
        <h3 style="font-family:var(--font-heading); font-size:26px; margin-bottom:8px; color:var(--forest-green)">Your Calibrated Regime</h3>
        <p style="font-size:13px; color:#666; margin-bottom:25px;">Adjusted for fatigue thresholds, traffic stressors, and local weather patterns.</p>
        
        <div class="workout-split-grid">
            ${plan.map(day => `
                <div class="workout-day-card">
                    <div class="workout-day-title">
                        <span>${day.title}</span>
                        <span style="font-size:11px; text-transform:uppercase; background-color:rgba(30,58,47,0.06); padding:4px 10px; border-radius:30px;">${day.intensity}</span>
                    </div>
                    <div class="workout-exercises">
                        ${day.exercises.map(ex => `
                            <div class="exercise-row">
                                <span class="exercise-name">${ex.name}</span>
                                <span class="exercise-sets">${ex.sets}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `).join("")}
        </div>
        <div class="workout-action-row">
            <button class="filter-chip" id="workout-print-btn">Print / Save PDF</button>
            <button class="add-ingredients-btn" id="workout-shop-btn">Shop Recovery Bundle</button>
        </div>
        <p style="font-size:12px; color:#555; margin-top:20px; font-style:italic; text-align:center;">
            * Video guidelines and progressive overload tracking modules can be unlocked by purchasing human specialist consultations.
        </p>
    `;

    document.getElementById("workout-print-btn")?.addEventListener("click", () => window.print());
    document.getElementById("workout-shop-btn")?.addEventListener("click", () => {
        let added = 0;
        WORKOUT_SHOP_MATCHERS.forEach(matcher => {
            const product = state.products.find(p => p.name.toLowerCase().includes(matcher) && p.inventory > 0);
            if (!product) return;
            const existing = state.cart.find(c => c.id === product.id);
            if (existing) existing.qty = Math.min(existing.qty + 1, product.inventory);
            else state.cart.push({ id: product.id, qty: 1 });
            added++;
        });
        saveState();
        syncCartUI();
        showNotification(added ? "Recovery bundle added to cart!" : "No matching supplements in stock.");
    });
}

// --- INTELLIGENT MEAL ARCHITECT ---
function renderMealView(container) {
    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Intelligent Macro-Nutrient Meal Architect</h2>
                <p>Algorithmic meal builder using sustainably sourced Bangladeshi proteins</p>
            </div>
        </div>

        <div class="meal-architect-layout">
            <div class="builder-panel">
                <h3 style="font-family:var(--font-heading); font-size:22px; margin-bottom:20px; color:var(--forest-green)">Caloric Calibrations</h3>
                <form id="meal-form">
                    <div class="form-group">
                        <label for="meal-weight">Weight (kg)</label>
                        <input type="number" id="meal-weight" class="form-control" value="70" required>
                    </div>
                    <div class="form-group">
                        <label for="meal-goal">Target Direction</label>
                        <select id="meal-goal" class="form-control">
                            <option value="gain">Hypertrophic Surplus (+500 kcal)</option>
                            <option value="cut">Fat Shredding Deficit (-500 kcal)</option>
                            <option value="maintain">Sustainable Maintenance</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="meal-protein">Protein Priority</label>
                        <select id="meal-protein" class="form-control">
                            <option value="high">High Protein (2.0g per kg)</option>
                            <option value="normal">Moderate Protein (1.5g per kg)</option>
                        </select>
                    </div>
                    <button type="submit" class="submit-btn">Architect Meals</button>
                </form>
                
                <div style="margin-top: 30px; border-top:1px solid var(--border-color); padding-top:20px;">
                    <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px;">Consultation Service</h4>
                    <p style="font-size:13px; color:#555; margin-bottom:15px;">Need elite custom diet advice or managing medical conditions?</p>
                    <button class="book-slot-btn" onclick="window.location.hash='#experts'; window.dispatchEvent(new HashChangeEvent('hashchange'));">Book Certified Dietician</button>
                </div>
            </div>

            <div class="meal-result-panel" id="meal-result-container">
                <div class="workout-placeholder">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <h3>Architect Your Nutrition</h3>
                    <p style="font-size:14px; max-width:320px; margin:10px auto 0;">Configure your target biometrics to render an ingredient list and caloric split.</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById("meal-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const weight = parseFloat(document.getElementById("meal-weight").value);
        const goal = document.getElementById("meal-goal").value;
        const proteinPref = document.getElementById("meal-protein").value;

        // Simple BMR estimation
        let bmr = weight * 22 * 1.375; // BMR * light activity
        if (goal === "gain") bmr += 500;
        if (goal === "cut") bmr -= 500;

        const targetCals = Math.round(bmr);
        const targetProtein = Math.round(weight * (proteinPref === "high" ? 2.0 : 1.5));
        const targetFat = Math.round((targetCals * 0.25) / 9);
        const targetCarbs = Math.round((targetCals - (targetProtein * 4) - (targetFat * 9)) / 4);

        renderGeneratedMeals(targetCals, targetProtein, targetCarbs, targetFat);
        state.savedMeals = { weight, goal, proteinPref, cals: targetCals, p: targetProtein, c: targetCarbs, f: targetFat };
        saveState();
    });

    if (state.savedMeals) {
        document.getElementById("meal-weight").value = state.savedMeals.weight;
        document.getElementById("meal-goal").value = state.savedMeals.goal;
        document.getElementById("meal-protein").value = state.savedMeals.proteinPref;
        renderGeneratedMeals(state.savedMeals.cals, state.savedMeals.p, state.savedMeals.c, state.savedMeals.f);
    }
}

function renderGeneratedMeals(cals, p, c, f) {
    const container = document.getElementById("meal-result-container");
    container.innerHTML = `
        <h3 style="font-family:var(--font-heading); font-size:26px; margin-bottom:8px; color:var(--forest-green)">Custom Meal Plan</h3>
        <p style="font-size:13px; color:#666; margin-bottom:20px;">Precision formulated around local grass-fed beef, wild-caught river fish, and heritage grains.</p>

        <div style="background-color:var(--ivory); padding:20px; border-radius:var(--radius-md); display:flex; justify-content:space-around; margin-bottom:30px; border:1px solid var(--border-color)">
            <div style="text-align:center;"><div style="font-size:20px; font-weight:600;">${cals}</div><div style="font-size:10px; text-transform:uppercase; color:#555;">Calories</div></div>
            <div style="text-align:center;"><div style="font-size:20px; font-weight:600; color:var(--forest-green);">${p}g</div><div style="font-size:10px; text-transform:uppercase; color:#555;">Protein</div></div>
            <div style="text-align:center;"><div style="font-size:20px; font-weight:600;">${c}g</div><div style="font-size:10px; text-transform:uppercase; color:#555;">Carbs</div></div>
            <div style="text-align:center;"><div style="font-size:20px; font-weight:600;">${f}g</div><div style="font-size:10px; text-transform:uppercase; color:#555;">Fats</div></div>
        </div>

        <div class="meal-split-grid">
            <div class="meal-day-card">
                <div class="meal-day-title">Breakfast</div>
                <div class="meal-item"><strong>Organic Pasture Eggs (3 eggs)</strong> Scrambled with virgin coconut oil</div>
                <div class="meal-item"><strong>Heritage Kalijira Brown Rice (45g)</strong> Starch-drained grain</div>
            </div>
            <div class="meal-day-card">
                <div class="meal-day-title">Lunch (Power Block)</div>
                <div class="meal-item"><strong>Wild-Caught Delta Hilsha (200g)</strong> Grilled or pan-seared in wooden mustard oil</div>
                <div class="meal-item"><strong>Deshi Masur Dal (Red Lentils)</strong> Organic garlic tempered delta pulses</div>
            </div>
            <div class="meal-day-card">
                <div class="meal-day-title">Dinner (Recovery Block)</div>
                <div class="meal-item"><strong>Grass-Fed Indigenous Beef (150g)</strong> Slow-cooked or pan seared</div>
                <div class="meal-item"><strong>Moringa Botanical Elixir</strong> Amber glass dose for anti-inflammatory flush</div>
            </div>
        </div>

        <div class="meal-action-row">
            <div>
                <h4 style="font-family:var(--font-heading); font-size:18px;">Sync with E-Commerce</h4>
                <p style="font-size:12px; color:#555;">Instantly load the exact raw organic ingredients required for this meal plan into your cart.</p>
            </div>
            <button class="add-ingredients-btn" id="meal-cart-inject-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
                Single-Click Add Ingredients
            </button>
        </div>
    `;

    document.getElementById("meal-cart-inject-btn").addEventListener("click", () => {
        const products = findMealProducts(state.products, MEAL_INGREDIENT_KEYS);
        let added = 0;
        products.forEach(product => {
            const existing = state.cart.find(item => item.id === product.id);
            if (existing) {
                if (existing.qty < product.inventory) { existing.qty += 1; added++; }
            } else {
                state.cart.push({ id: product.id, qty: 1 });
                added++;
            }
        });

        saveState();
        syncCartUI();
        showNotification(added > 0
            ? `${added} catalog ingredients loaded into cart!`
            : "Could not find matching in-stock ingredients in the catalog.");
    });
}

// --- EXPERT CONSULTATION VIEWS ---
function renderExpertsView(container) {
    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Hybrid Expert Wellness Consultations</h2>
                <p>Schedule paid video audits with verified physical trainers and clinical dieticians</p>
            </div>
        </div>

        <div class="expert-grid">
            ${EXPERTS.map(ex => `
                <div class="expert-card">
                    <div class="expert-photo">
                        <span style="font-size:28px; font-weight:600; font-family:var(--font-heading);">${ex.photo}</span>
                    </div>
                    <div class="expert-info">
                        <span class="expert-tag">${ex.tag}</span>
                        <h3 class="expert-title">${ex.name}</h3>
                        <p class="expert-bio">${ex.bio}</p>
                        <div class="expert-price">Consultation Fee: ৳${ex.price}</div>
                        
                        <div style="margin-top:15px;">
                            <label style="font-size:11px; text-transform:uppercase; font-weight:600; display:block; margin-bottom:6px;">Select Availability Slot</label>
                            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:15px;">
                                ${ex.slots.map(slot => `
                                    <button class="filter-chip expert-slot-btn" data-expert-id="${ex.id}" data-slot="${slot}">${slot}</button>
                                `).join("")}
                            </div>
                            <button class="book-slot-btn book-now-trigger" data-expert-id="${ex.id}" style="width:100%;">Book Consultation</button>
                        </div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;

    // Handle slot select visual toggle
    container.querySelectorAll(".expert-slot-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const parent = e.target.parentElement;
            parent.querySelectorAll(".expert-slot-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
        });
    });

    container.querySelectorAll(".book-now-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const expertId = e.target.getAttribute("data-expert-id");
            const expert = EXPERTS.find(ex => ex.id === expertId);
            
            // Find selected slot
            const parentCard = e.target.closest(".expert-card");
            const selectedSlotBtn = parentCard.querySelector(".expert-slot-btn.active");
            
            if (!selectedSlotBtn) {
                alert("Please select an availability slot first!");
                return;
            }

            const slot = selectedSlotBtn.getAttribute("data-slot");
            
            // Open bKash flow specifically for booking
            state.tempBooking = {
                id: `bk-${Date.now()}`,
                expertName: expert.name,
                expertTag: expert.tag,
                slot: slot,
                price: expert.price
            };
            
            triggerBkashPayment(expert.price, `Booking: ${expert.name}`);
        });
    });
}

// --- EDITORIAL VIEW ---
function renderEditorialView(container) {
    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>The Lifestyle & Eco-Editorial Hub</h2>
                <p>High-caliber journalism detailing sustainable living practices in the Bengal Delta</p>
            </div>
        </div>

        <div class="editorial-hero">
            <div>
                <span class="editorial-hero-tag">Featured Article</span>
                <h2>${ARTICLES[0].title}</h2>
                <p style="color:#555; margin-bottom:20px; font-size:15px;">${ARTICLES[0].excerpt}</p>
                <button class="hero-cta read-article-btn" data-id="${ARTICLES[0].id}">Read Essay</button>
            </div>
            <div style="background-color:var(--forest-green); border-radius:var(--radius-md); aspect-ratio:1.6; display:flex; align-items:center; justify-content:center; color:var(--sand);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 22h20L12 2zm0 3.99L19.53 19H4.47L12 5.99zM13 16h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
            </div>
        </div>

        <div class="blog-grid">
            ${ARTICLES.slice(1).map(art => `
                <div class="blog-card">
                    <div class="blog-card-image">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 22h20L12 2zm0 3.99L19.53 19H4.47L12 5.99zM13 16h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
                    </div>
                    <div class="blog-card-content">
                        <span class="blog-tag">${art.tag}</span>
                        <h3 class="blog-title">${art.title}</h3>
                        <p class="blog-excerpt">${art.excerpt}</p>
                        <button class="read-more read-article-btn" data-id="${art.id}">Read Essay →</button>
                    </div>
                </div>
            `).join("")}
        </div>

        <!-- Essay Detail Modal -->
        <div class="modal-overlay" id="essay-modal-overlay">
            <div class="modal-content" style="max-width: 700px; padding: 40px; background-color: var(--white); overflow-y:auto; max-height:85vh;">
                <span id="essay-close-btn" style="position:absolute; top:20px; right:20px; font-size:22px; cursor:pointer;">&times;</span>
                <div id="essay-modal-body"></div>
            </div>
        </div>
    `;

    const essayOverlay = document.getElementById("essay-modal-overlay");
    const essayBody = document.getElementById("essay-modal-body");
    const essayClose = document.getElementById("essay-close-btn");

    const bindReadButtons = () => {
        container.querySelectorAll(".read-article-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = e.target.getAttribute("data-id");
                const art = ARTICLES.find(a => a.id === id);
                
                essayBody.innerHTML = `
                    <span class="blog-tag">${art.tag}</span>
                    <h2 style="font-family:var(--font-heading); font-size:32px; color:var(--forest-green); margin:10px 0 6px;">${art.title}</h2>
                    <p style="font-size:12px; color:#666; margin-bottom:25px;">Written by ${art.author} | Published on ${art.date}</p>
                    <div style="font-size:15px; line-height:1.7; color:#333; white-space:pre-line;">${art.content}</div>
                `;
                essayOverlay.classList.add("open");
            });
        });
    };

    bindReadButtons();
    essayClose.addEventListener("click", () => essayOverlay.classList.remove("open"));
    essayOverlay.addEventListener("click", (e) => {
        if (e.target === essayOverlay) essayOverlay.classList.remove("open");
    });
}

// --- CUSTOMER DASHBOARD & MERCHANT PANEL ---
function renderDashboardView(container) {
    if (!state.currentUser) {
        renderLoginView(container);
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>My Account</h2>
                <p>Welcome, ${state.currentUser.name} — manage orders, profile & wallet</p>
            </div>
            <button class="filter-chip" id="logout-btn">Sign Out</button>
        </div>

        <div class="dashboard-grid">
            <div class="dashboard-sidebar">
                <div class="dashboard-menu">
                    <button class="dashboard-menu-item active" data-tab="profile">My Profile</button>
                    <button class="dashboard-menu-item" data-tab="orders">Orders & Tracking</button>
                    <button class="dashboard-menu-item" data-tab="wishlist">${t("wishlist")}</button>
                    <button class="dashboard-menu-item" data-tab="bookings">Specialist Bookings</button>
                    <button class="dashboard-menu-item" data-tab="returns">Packaging Returns</button>
                    ${isMerchantUnlocked() ? `<button class="dashboard-menu-item" data-tab="merchant">Merchant Panel</button>` : `<button class="dashboard-menu-item" data-tab="merchant-lock">Merchant Panel</button>`}
                </div>
            </div>
            <div class="dashboard-content-panel" id="dashboard-content-area"></div>
        </div>
    `;

    document.getElementById("logout-btn").addEventListener("click", () => {
        logoutUser();
        updateHeaderAccount();
        showNotification("Signed out successfully.");
        navigateTo("shop");
    });

    const contentArea = document.getElementById("dashboard-content-area");

    const renderTab = (tabName) => {
        contentArea.innerHTML = "";
        container.querySelectorAll(".dashboard-menu-item").forEach(item => {
            item.classList.toggle("active", item.getAttribute("data-tab") === tabName);
        });

        if (tabName === "profile") {
            const tier = getLoyaltyTier(state.lifetimeCredits);
            const u = state.currentUser;
            contentArea.innerHTML = `
                <h3 style="font-family:var(--font-heading); font-size:24px; margin-bottom:15px; color:var(--forest-green)">Profile Settings</h3>
                <form id="profile-form">
                    <div class="form-group"><label>Full Name</label><input type="text" id="prof-name" class="form-control" value="${u.name}" required></div>
                    <div class="form-group"><label>Email</label><input type="email" class="form-control" value="${u.email}" disabled></div>
                    <div class="form-group"><label>Mobile</label><input type="tel" id="prof-phone" class="form-control" value="${u.phone}" maxlength="11" required></div>
                    <div class="form-group"><label>Date of Birth</label><input type="date" id="prof-birthdate" class="form-control" value="${u.birthdate || ""}" max="${new Date().toISOString().slice(0, 10)}"></div>
                    <h4 class="form-section-title">Delivery location</h4>
                    ${renderLocationFieldsHtml("prof", u)}
                    <button type="submit" class="submit-btn">Save Profile</button>
                </form>

                <div class="loyalty-progress-container" style="margin-top:30px;">
                    <div class="loyalty-header">
                        <span class="loyalty-tier-title">${tier.name}</span>
                        <span style="font-weight:600;">${state.lifetimeCredits} / ${tier.target} Credits</span>
                    </div>
                    <div class="loyalty-progress-bar-bg"><div class="loyalty-progress-bar-fill" style="width:${tier.progress}%"></div></div>
                </div>

                <h4 style="margin-top:25px; font-family:var(--font-heading);">Eco-Wallet Balance</h4>
                <div style="background:rgba(30,58,47,0.04); border:1px solid rgba(30,58,47,0.08); padding:20px; border-radius:var(--radius-md); margin-top:10px;">
                    <div style="font-size:24px; font-weight:600; color:var(--forest-green);">৳${state.wallet}</div>
                    <p style="font-size:13px; color:#555; margin-top:8px;">Credits are issued manually after we receive and inspect your returned packaging. Redeem your balance automatically at checkout.</p>
                </div>
            `;
            bindLocationFields("prof", u);
            document.getElementById("profile-form").addEventListener("submit", async (e) => {
                e.preventDefault();
                const loc = readLocationFields("prof");
                u.name = document.getElementById("prof-name").value.trim();
                u.phone = document.getElementById("prof-phone").value.trim();
                u.birthdate = document.getElementById("prof-birthdate").value;
                u.division = loc.division;
                u.district = loc.district;
                u.area = loc.area;
                u.addressLine = loc.addressLine;
                u.landmark = loc.landmark;
                u.address = formatFullAddress(loc);
                syncStateToUser();
                saveState();
                updateHeaderAccount();
                await appendUserToGoogleSheet(u, "profile_update");
                showNotification("Profile updated!");
            });
        } else if (tabName === "orders") {
            if (state.orders.length === 0) {
                contentArea.innerHTML = `<p style="text-align:center; color:#666; padding:50px 0;">No orders yet. <a href="#shop" style="color:var(--forest-green);">Start shopping</a></p>`;
                return;
            }
            contentArea.innerHTML = `
                <h3 style="font-family:var(--font-heading); font-size:24px; margin-bottom:20px;">Orders & Tracking</h3>
                <div class="orders-list">
                    ${state.orders.slice().reverse().map(o => `
                        <div class="order-track-card" data-order-id="${o.id}">
                            <div class="order-track-header">
                                <div>
                                    <strong>${o.id}</strong>
                                    <span>${o.date} · ${o.itemsCount} items · ৳${o.price}</span>
                                </div>
                                <span class="order-status-badge">${o.status || "Confirmed"}</span>
                            </div>
                            <p style="font-size:13px; color:#555; margin:8px 0;">${o.address}, ${o.area} · ${o.paymentMethod || "bKash"}</p>
                            ${o.lineItems?.length ? `<ul class="order-line-items">${o.lineItems.map(li => `<li>${li.name} × ${li.qty} — ৳${li.lineTotal}</li>`).join("")}</ul>` : ""}
                            ${renderOrderTracker(o.status || "Confirmed", o.trackingCode || o.id)}
                            <div class="order-card-actions">
                                ${o.lineItems?.length ? `<button class="filter-chip reorder-btn" data-order="${o.id}">${t("reorder")}</button>` : ""}
                                ${o.status !== "Cancelled" && o.status !== "Delivered" ? `<button class="filter-chip cancel-order-btn" data-order="${o.id}">Request Cancel</button>` : ""}
                            </div>
                        </div>
                    `).join("")}
                </div>
            `;
            contentArea.querySelectorAll(".reorder-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    const order = state.orders.find(o => o.id === btn.getAttribute("data-order"));
                    const n = reorderItems(order?.lineItems);
                    showNotification(n ? `${n} items added to cart!` : "Items unavailable.");
                    navigateTo("checkout");
                });
            });
            contentArea.querySelectorAll(".cancel-order-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    const order = state.orders.find(o => o.id === btn.getAttribute("data-order"));
                    if (order) { order.status = "Cancel Requested"; saveState(); showNotification("Cancel request submitted."); renderTab("orders"); }
                });
            });
        } else if (tabName === "wishlist") {
            if (!state.wishlist.length) {
                contentArea.innerHTML = `<p style="text-align:center; color:#666; padding:50px 0;">Your wishlist is empty. <a href="#shop">Browse shop</a></p>`;
                return;
            }
            const items = state.wishlist.map(id => state.products.find(p => p.id === id)).filter(Boolean);
            contentArea.innerHTML = `
                <h3 style="font-family:var(--font-heading); font-size:24px; margin-bottom:20px;">${t("wishlist")}</h3>
                <div class="wishlist-grid">
                    ${items.map(p => `
                        <div class="wishlist-item" data-id="${p.id}">
                            ${p.image ? `<img src="${p.image}" alt="${p.name}">` : ""}
                            <div><strong>${p.name}</strong><br>৳${getActivePrice(p)}</div>
                            <button class="add-to-cart-btn wishlist-add" data-id="${p.id}">Add</button>
                            <button class="wishlist-remove" data-id="${p.id}">×</button>
                        </div>
                    `).join("")}
                </div>
            `;
            contentArea.querySelectorAll(".wishlist-add").forEach(btn => {
                btn.addEventListener("click", () => addToCart(btn.getAttribute("data-id")));
            });
            contentArea.querySelectorAll(".wishlist-remove").forEach(btn => {
                btn.addEventListener("click", () => { toggleWishlist(btn.getAttribute("data-id")); renderTab("wishlist"); });
            });
        } else if (tabName === "bookings") {
            if (state.bookings.length === 0) {
                contentArea.innerHTML = `<p style="text-align:center; color:#666; padding:50px 0;">You have not booked any specialist sessions yet.</p>`;
                return;
            }
            contentArea.innerHTML = `
                <h3 style="font-family:var(--font-heading); font-size:24px; margin-bottom:15px;">Booked Consultations</h3>
                <table class="orders-table">
                    <thead>
                        <tr>
                            <th>Booking ID</th>
                            <th>Expert</th>
                            <th>Specialization</th>
                            <th>Scheduled Slot</th>
                            <th>Price Paid</th>
                            <th>Room Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.bookings.map(b => `
                            <tr>
                                <td>${b.id}</td>
                                <td>${b.expertName}</td>
                                <td>${b.expertTag}</td>
                                <td>${b.slot}</td>
                                <td>৳${b.price}</td>
                                <td><a href="#meet" style="color:var(--forest-green); font-weight:600; text-decoration:underline;">Enter Video Room</a></td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        } else if (tabName === "returns") {
            contentArea.innerHTML = `
                <h3 style="font-family:var(--font-heading); font-size:24px; margin-bottom:15px; color:var(--forest-green)">Packaging Return Program</h3>
                <div style="background:var(--sand-light); padding:20px; border-radius:var(--radius-md); border-left:4px solid var(--gold); margin-bottom:20px;">
                    <p style="font-size:14px; line-height:1.7;">Hand cleaned amber glass jars and metal tiffins back to our delivery courier. Once received and inspected at our hub, <strong>৳25 Eco-Credits per unit</strong> are manually added to your wallet by our team.</p>
                </div>
                <form id="return-request-form" style="margin-bottom:24px;">
                    <div class="form-group"><label>Containers returning</label><input type="number" id="return-qty" class="form-control" min="1" value="1" required></div>
                    <div class="form-group"><label>Container type</label>
                        <select id="return-type" class="form-control"><option>Amber Glass Jar</option><option>Metal Tiffin</option><option>Mixed</option></select>
                    </div>
                    <div class="form-group"><label>Notes (optional)</label><textarea id="return-notes" class="form-control" rows="2"></textarea></div>
                    <button type="submit" class="submit-btn">Submit Return Request</button>
                </form>
                ${state.returnRequests.length ? `<h4>Your return requests</h4><ul class="return-requests-list">${state.returnRequests.map(r => `<li>${r.date}: ${r.qty} × ${r.type} — <strong>${r.status}</strong></li>`).join("")}</ul>` : ""}
            `;
            document.getElementById("return-request-form").addEventListener("submit", async (e) => {
                e.preventDefault();
                const request = {
                    id: `RET-${Date.now().toString().slice(-6)}`,
                    qty: parseInt(document.getElementById("return-qty").value, 10),
                    type: document.getElementById("return-type").value,
                    notes: document.getElementById("return-notes").value.trim(),
                    status: "Pending Pickup",
                    date: new Date().toLocaleDateString()
                };
                state.returnRequests.push(request);
                if (isSupabaseEnabled() && isCloudUser()) {
                    await saveReturnRequestToSupabase(state.currentUser.id, request);
                }
                saveState();
                showNotification("Return request submitted!");
                renderTab("returns");
            });
        } else if (tabName === "merchant-lock") {
            contentArea.innerHTML = `
                <h3 style="font-family:var(--font-heading); font-size:24px; margin-bottom:15px;">Merchant Panel</h3>
                <p style="color:#666; margin-bottom:16px;">Enter merchant PIN to access admin tools.</p>
                <form id="merchant-pin-form">
                    <div class="form-group"><label>PIN</label><input type="password" id="merchant-pin" class="form-control" maxlength="8" required></div>
                    <button type="submit" class="submit-btn">Unlock</button>
                </form>
            `;
            document.getElementById("merchant-pin-form").addEventListener("submit", (e) => {
                e.preventDefault();
                if (document.getElementById("merchant-pin").value === MERCHANT_PIN) {
                    sessionStorage.setItem("eco_merchant_unlocked", "1");
                    showNotification("Merchant panel unlocked.");
                    renderPage("dashboard");
                } else alert("Invalid PIN.");
            });
        } else if (tabName === "merchant") {
            contentArea.innerHTML = `
                <h3 style="font-family:var(--font-heading); font-size:24px; margin-bottom:15px; color:var(--forest-green)">Merchant Panel</h3>

                <div style="background:var(--ivory); padding:20px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:30px;">
                    <h4 style="margin-bottom:12px;">Issue Eco-Credits (Packaging Returns)</h4>
                    <p style="font-size:13px; color:#555; margin-bottom:15px;">Manually credit a customer's wallet after receiving returned packaging.</p>
                    <form id="issue-credits-form">
                        <div class="form-group"><label>Customer Email</label><input type="email" id="issue-email" class="form-control" required></div>
                        <div class="form-group"><label>Credits to Issue (৳)</label><input type="number" id="issue-amount" class="form-control" min="25" step="25" value="25" required></div>
                        <button type="submit" class="submit-btn">Issue Credits</button>
                    </form>
                </div>

                <h4 style="margin-bottom:10px;">Advance Order Status</h4>
                <form id="advance-order-form" style="margin-bottom:30px;">
                    <div class="form-group"><label>Order ID</label><input type="text" id="advance-order-id" class="form-control" placeholder="OD-123456" required></div>
                    <button type="submit" class="submit-btn">Advance to Next Status</button>
                </form>

                <h3 style="font-family:var(--font-heading); font-size:20px; margin-bottom:15px;">Google Sheets</h3>
                <p style="font-size:13px; color:#666; margin-bottom:16px;">Sync catalog from a sheet. Log orders to an <strong>Orders</strong> tab (<code>orders-webhook.gs</code>) and customers to a <strong>Customers</strong> tab (<code>users-webhook.gs</code>) via <code>sheets-config.js</code>.</p>
                <div style="background-color:var(--sand-light); padding:20px; border-radius:var(--radius-md); font-size:13px; margin-bottom:25px; border-left: 4px solid var(--gold);">
                    <code style="display:block; background:#fff; padding:8px; border-radius:4px; margin:8px 0; font-family:monospace; overflow-x:auto;">
                        id, name, category, subcategory, price, saleprice, inventory, organic, bpafree, packaging, origin, labcert, calories, carbs, protein, fat, servingsize, unit, description, photos
                    </code>
                </div>
                <form id="merchant-sheet-form">
                    <div class="form-group">
                        <label for="sheet-url-input">Google Sheet Link / CSV URL</label>
                        <input type="url" id="sheet-url-input" class="form-control" placeholder="https://docs.google.com/spreadsheets/d/..." value="${state.sheetUrl}">
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button type="submit" class="submit-btn" style="flex:1;">Sync Catalog</button>
                        <button type="button" id="reset-catalog-btn" class="filter-chip" style="border-radius:var(--radius-sm); padding:0 20px;">Reset to Default</button>
                    </div>
                </form>
            `;

            document.getElementById("issue-credits-form").addEventListener("submit", async (e) => {
                e.preventDefault();
                const email = document.getElementById("issue-email").value;
                const amount = parseInt(document.getElementById("issue-amount").value) || 0;
                if (await issueEcoCredits(email, amount)) {
                    showNotification(`Issued ৳${amount} Eco-Credits to ${email}`);
                    e.target.reset();
                } else {
                    alert("No account found with that email.");
                }
            });

            document.getElementById("advance-order-form").addEventListener("submit", async (e) => {
                e.preventDefault();
                const orderId = document.getElementById("advance-order-id").value.trim().toUpperCase();
                if (isSupabaseEnabled()) {
                    const newStatus = await merchantAdvanceOrder(orderId);
                    if (newStatus) {
                        const local = state.orders.find(o => o.id.toUpperCase() === orderId);
                        if (local) local.status = newStatus;
                        showNotification(`Order ${orderId} is now: ${newStatus}`);
                    } else {
                        alert("Order not found or already delivered.");
                    }
                    return;
                }
                let found = false;
                const advance = (orders) => {
                    const o = orders.find(x => x.id.toUpperCase() === orderId);
                    if (!o) return false;
                    const idx = ORDER_STATUSES.indexOf(o.status || "Confirmed");
                    if (idx < ORDER_STATUSES.length - 1) o.status = ORDER_STATUSES[idx + 1];
                    return true;
                };
                found = advance(state.orders);
                if (!found) {
                    for (const u of state.users) {
                        if (advance(u.orders || [])) { found = true; break; }
                    }
                }
                if (found) {
                    saveState();
                    showNotification(`Order ${orderId} advanced to next status.`);
                } else {
                    alert("Order not found.");
                }
            });

            document.getElementById("merchant-sheet-form").addEventListener("submit", async (e) => {
                e.preventDefault();
                const url = document.getElementById("sheet-url-input").value.trim();
                
                if (!url) {
                    alert("Please provide a valid URL!");
                    return;
                }

                showNotification("Syncing products from Google Sheet...");
                try {
                    const sheetProducts = await fetchGoogleSheetCatalog(url);
                    if (sheetProducts.length > 0) {
                        state.products = sheetProducts;
                        state.sheetUrl = url;
                        saveState();
                        showNotification(`Synced ${sheetProducts.length} products successfully!`);
                        renderPage("shop"); // Redirect to shop to see updates
                    } else {
                        throw new Error("No data parsed from CSV sheet feed.");
                    }
                } catch (err) {
                    alert("Synchronization failed! Check console and ensure sheet is published as CSV and accessible to anyone with the link.");
                    console.error(err);
                }
            });

            document.getElementById("reset-catalog-btn").addEventListener("click", () => {
                if (confirm("Reset catalog back to the built-in default?")) {
                    state.products = [...DEFAULT_PRODUCTS];
                    state.sheetUrl = "";
                    saveState();
                    showNotification("Catalog reverted to default built-in inventory.");
                    renderPage("shop");
                }
            });
        }
    };

    // Bind sidebar menu tabs
    container.querySelectorAll(".dashboard-menu-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const tab = e.target.getAttribute("data-tab");
            renderTab(tab);
        });
    });

    // Render default tab
    renderTab("profile");
}

// --- SHOPPING CART STATE & ACTIONS ---
function addToCart(productId) {
    const p = state.products.find(prod => prod.id === productId);
    if (!p) return;

    if (p.inventory <= 0) {
        showNotification("Sorry, this item is currently out of stock!");
        return;
    }

    const existing = state.cart.find(item => item.id === productId);
    const currentQtyInCart = existing ? existing.qty : 0;

    if (currentQtyInCart >= p.inventory) {
        showNotification(`Cannot add more. Only ${p.inventory} units available in stock.`);
        return;
    }

    if (existing) {
        existing.qty += 1;
    } else {
        state.cart.push({ id: productId, qty: 1 });
    }
    saveState();
    syncCartUI();
    showNotification("Product added to your zero-plastic tote!");
}

function updateCartQty(productId, delta) {
    const p = state.products.find(prod => prod.id === productId);
    const item = state.cart.find(c => c.id === productId);
    if (!item || !p) return;
    const next = item.qty + delta;
    if (next <= 0) {
        state.cart = state.cart.filter(c => c.id !== productId);
    } else if (next > p.inventory) {
        showNotification(`Only ${p.inventory} units available.`);
        return;
    } else {
        item.qty = next;
    }
    saveState();
    syncCartUI();
    renderCartItems();
}

function renderCartItems() {
    const container = document.getElementById("cart-items-list");
    const proceedBtn = document.getElementById("drawer-proceed-btn");

    if (state.cart.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px 0; color:#666;">${t("emptyCart")}</div>`;
        if (proceedBtn) proceedBtn.disabled = true;
        syncCartUI();
        return;
    }

    container.innerHTML = state.cart.map(item => {
        const p = state.products.find(prod => prod.id === item.id);
        if (!p) return "";
        const activePrice = getActivePrice(p);
        const itemTotal = activePrice * item.qty;

        return `
            <div class="cart-item">
                <div class="cart-item-img">
                    ${p.image
                        ? `<img src="${p.image}" alt="${p.name}" class="cart-item-product-img" loading="lazy">`
                        : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12zm-7-8c-2.76 0-5 2.24-5 5h2c0-1.66 1.34-3 3-3s3 1.34 3 3h2c0-2.76-2.24-5-5-5z"/></svg>`}
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${p.name}</div>
                    <div class="cart-qty-controls">
                        <button type="button" class="qty-btn" data-id="${p.id}" data-delta="-1" aria-label="Decrease">−</button>
                        <span>${item.qty} × ${getOrderUnit(p)}</span>
                        <button type="button" class="qty-btn" data-id="${p.id}" data-delta="1" aria-label="Increase">+</button>
                    </div>
                    <span class="cart-item-remove" data-id="${p.id}">Remove</span>
                </div>
                <div class="cart-item-price">৳${itemTotal}</div>
            </div>
        `;
    }).join("");

    container.querySelectorAll(".cart-item-remove").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            state.cart = state.cart.filter(item => item.id !== id);
            saveState();
            syncCartUI();
            renderCartItems();
        });
    });

    container.querySelectorAll(".qty-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            updateCartQty(btn.getAttribute("data-id"), parseInt(btn.getAttribute("data-delta"), 10));
        });
    });

    if (proceedBtn) proceedBtn.disabled = false;
    syncCartUI();
}

function renderCheckoutView(container) {
    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="checkout-empty">
                <h2>Your tote is empty</h2>
                <p>Add products before completing your order.</p>
                <button class="submit-btn" id="checkout-back-shop">Browse Shop</button>
            </div>
        `;
        document.getElementById("checkout-back-shop").addEventListener("click", () => navigateTo("shop"));
        return;
    }

    if (!state.currentUser && !state.guestCheckout) {
        container.innerHTML = `
            <div class="auth-card">
                <h2>Checkout Options</h2>
                <p>Sign in for order history & Eco-Credits, or continue as a guest.</p>
                <button class="submit-btn" id="checkout-go-login">Sign In</button>
                <button class="checkout-btn checkout-btn-outline" id="checkout-go-register">Create Account</button>
                <button class="checkout-btn checkout-btn-outline" id="checkout-guest" style="margin-top:8px;">${t("guestCheckout")}</button>
            </div>
        `;
        document.getElementById("checkout-go-login").addEventListener("click", () => {
            state.redirectAfterAuth = "checkout";
            navigateTo("login");
        });
        document.getElementById("checkout-go-register").addEventListener("click", () => {
            state.redirectAfterAuth = "checkout";
            navigateTo("register");
        });
        document.getElementById("checkout-guest").addEventListener("click", () => {
            state.guestCheckout = true;
            renderCheckoutView(container);
        });
        return;
    }

    renderCheckoutForm(container);
}

function renderCheckoutTotalsHtml() {
    const totals = getCheckoutTotals(state, state.activeCoupon);
    return { totals, html: `
        <div class="cart-row"><span>${t("subtotal")}</span><span>৳${totals.subtotal}</span></div>
        ${totals.couponDiscount ? `<div class="cart-row"><span>Promo Discount</span><span style="color:red;">-৳${totals.couponDiscount}</span></div>` : ""}
        <div class="cart-row"><span>Wallet Discount</span><span style="color:red;">-৳${totals.storeDeduction}</span></div>
        <div class="cart-row"><span>${t("deliveryFee")}</span><span>${totals.deliveryFee ? `৳${totals.deliveryFee}` : t("freeDelivery")}</span></div>
        <div class="cart-row total"><span>Grand Total</span><span>৳${totals.finalTotal}</span></div>
    ` };
}

function renderCheckoutForm(container) {
    const summaryHtml = state.cart.map(item => {
        const p = state.products.find(prod => prod.id === item.id);
        if (!p) return "";
        return `
            <div class="checkout-summary-item">
                <span>${p.name} <small>× ${item.qty}</small></span>
                <span>৳${getActivePrice(p) * item.qty}</span>
            </div>
        `;
    }).join("");

    const { totals, html: totalsHtml } = renderCheckoutTotalsHtml();
    const couponHints = Object.keys(COUPONS).map(k => `<code>${k}</code>`).join(", ");

    const u = state.currentUser;
    const hasDefault = u && u.division && u.district && u.area && u.addressLine;
    
    let defaultAddressCardHtml = "";
    let differentAddressToggleHtml = "";
    let locationFieldsClass = "";
    let saveAddressCheckboxHtml = "";
    let guestFieldsHtml = "";
    
    if (u) {
        if (hasDefault) {
            defaultAddressCardHtml = `
                <div class="default-address-card" id="default-address-summary">
                    <div class="default-address-card-header">
                        <span class="default-address-card-title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            Deliver to Default Address
                        </span>
                        <span class="default-address-card-badge">Default</span>
                    </div>
                    <div class="default-address-card-body">
                        <div class="default-address-card-name">${u.name} · ${u.phone}</div>
                        <div>${formatFullAddress(locationFromLegacy(u))}</div>
                    </div>
                </div>
            `;
            differentAddressToggleHtml = `
                <div class="checkout-different-address-toggle">
                    <label>
                        <input type="checkbox" id="use-different-address">
                        Deliver to a different address
                    </label>
                </div>
            `;
            locationFieldsClass = "collapsible-checkout-section";
            saveAddressCheckboxHtml = `
                <div class="save-address-profile-toggle">
                    <label>
                        <input type="checkbox" id="save-address-to-profile">
                        Save this new address as my default delivery address
                    </label>
                </div>
            `;
        } else {
            locationFieldsClass = "";
        }
    } else {
        guestFieldsHtml = `
            <div class="form-group">
                <label for="delivery-email">Email Address</label>
                <input type="email" id="delivery-email" class="form-control" placeholder="your@email.com" required>
            </div>
            <div class="form-group">
                <label for="delivery-birthdate">Date of Birth</label>
                <input type="date" id="delivery-birthdate" class="form-control" required max="${new Date().toISOString().slice(0, 10)}">
            </div>
        `;
        locationFieldsClass = "";
    }

    container.innerHTML = `
        <div class="checkout-page">
            <div class="page-title">
                <h2>${t("confirmOrder")}</h2>
                <p>Review your tote and enter delivery details to complete checkout.</p>
            </div>
            <div class="checkout-layout">
                <div class="checkout-summary-card">
                    <h3>Order Summary</h3>
                    <div class="checkout-summary-items">${summaryHtml}</div>
                    <div id="checkout-totals-block">${totalsHtml}</div>
                    <div class="cart-wallet-info">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zM12 6L5.5 17h13L12 6z"/></svg>
                        <span>Wallet credits are issued after we receive your returned packaging. Eco-Guardian (200+ credits) gets free delivery.</span>
                    </div>
                </div>
                <div class="checkout-form-card">
                    <h3>Delivery &amp; Payment</h3>
                    ${defaultAddressCardHtml}
                    ${differentAddressToggleHtml}
                    
                    <div id="different-address-section" class="${locationFieldsClass}">
                        ${guestFieldsHtml}
                        <div class="form-group">
                            <label for="delivery-name">Full Name</label>
                            <input type="text" id="delivery-name" class="form-control" placeholder="Recipient name" value="${u ? u.name : ''}">
                        </div>
                        <div class="form-group">
                            <label for="delivery-phone">Mobile Number</label>
                            <input type="tel" id="delivery-phone" class="form-control" placeholder="01XXXXXXXXX" maxlength="11" value="${u ? u.phone : ''}">
                        </div>
                        <h4 class="form-section-title">Delivery location</h4>
                        ${renderLocationFieldsHtml("delivery", u || {})}
                        ${saveAddressCheckboxHtml}
                    </div>
                    
                    <div class="form-group">
                        <label for="delivery-slot">Delivery Time Slot</label>
                        <select id="delivery-slot" class="form-control">
                            <option value="Morning Shift (8:00 AM - 12:00 PM)">Morning Shift (8:00 AM - 12:00 PM)</option>
                            <option value="Afternoon Shift (12:00 PM - 4:00 PM)">Afternoon Shift (12:00 PM - 4:00 PM)</option>
                            <option value="Evening Shift (4:00 PM - 8:00 PM)">Evening Shift (4:00 PM - 8:00 PM)</option>
                            <option value="Night Shift (8:00 PM - 12:00 AM)">Night Shift (8:00 PM - 12:00 AM)</option>
                        </select>
                    </div>
                    <div class="form-group coupon-row">
                        <label for="coupon-code">${t("coupon")}</label>
                        <div class="coupon-input-row">
                            <input type="text" id="coupon-code" class="form-control" placeholder="WELCOME10" value="${state.activeCoupon}">
                            <button type="button" class="submit-btn" id="apply-coupon-btn">${t("apply")}</button>
                        </div>
                        <small style="color:#888;">Try: ${couponHints}</small>
                    </div>
                    <div class="form-group">
                        <label>Payment Method</label>
                        <div class="payment-method-row">
                            <label class="payment-option"><input type="radio" name="payment-method" value="bkash" checked> bKash</label>
                            <label class="payment-option"><input type="radio" name="payment-method" value="cod"> Cash on Delivery</label>
                        </div>
                    </div>
                    <button class="checkout-btn" id="place-order-btn">${t("placeOrder")}</button>
                </div>
            </div>
        </div>
    `;

    bindLocationFields("delivery", locationFromLegacy(state.currentUser || {}));
    prefillDeliveryForm();

    const useDiffCheckbox = document.getElementById("use-different-address");
    const diffSec = document.getElementById("different-address-section");
    if (useDiffCheckbox && diffSec) {
        const updateVisibility = () => {
            if (useDiffCheckbox.checked) {
                diffSec.classList.add("open");
            } else {
                diffSec.classList.remove("open");
            }
        };
        useDiffCheckbox.addEventListener("change", updateVisibility);
        updateVisibility();
    }

    document.getElementById("apply-coupon-btn").addEventListener("click", () => {
        state.activeCoupon = document.getElementById("coupon-code").value.trim();
        const result = applyCoupon(state.activeCoupon, getCheckoutTotals(state, "").subtotal);
        showNotification(result.message);
        document.getElementById("checkout-totals-block").innerHTML = renderCheckoutTotalsHtml().html;
    });

    document.getElementById("place-order-btn").addEventListener("click", async () => {
        const details = getDeliveryDetailsFromCart();
        const err = validateDeliveryDetails(details);
        if (err) { alert(err); return; }

        const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || "bkash";
        const { totals } = renderCheckoutTotalsHtml();

        state.pendingCheckout = {
            amount: totals.finalTotal,
            slot: details.slot,
            storeDeduction: totals.storeDeduction,
            couponDiscount: totals.couponDiscount,
            deliveryFee: totals.deliveryFee,
            delivery: details,
            paymentMethod,
            lineItems: buildOrderLineItems(state.cart, state.products)
        };
        state.tempBooking = null;

        if (paymentMethod === "cod") {
            await finalizeTransactionAsync(totals.finalTotal, "Zero-Plastic Cart Checkout", details.slot, 0, totals.storeDeduction, details, "Cash on Delivery");
            return;
        }

        triggerBkashPayment(totals.finalTotal, "Zero-Plastic Cart Checkout", details.slot, 0, totals.storeDeduction);
    });
}

// --- BKASH PAYMENT GATEWAY SIMULATION ---
function triggerBkashPayment(amount, reason, slot = "", creditsToEarn = 0, storeDeduction = 0) {
    const modal = document.getElementById("bkash-modal-overlay");
    modal.classList.add("open");

    // Close any drawers
    document.getElementById("cart-slider").classList.remove("open");

    document.getElementById("bkash-merchant-amount").textContent = `৳${amount}`;
    document.getElementById("bkash-merchant-num").textContent = "01778522749";

    const body = document.getElementById("bkash-modal-body");
    
    // STEP 1: Phone Number Input
    body.innerHTML = `
        <div class="bkash-instructions">Enter your bKash wallet number to initiate transaction</div>
        <div class="bkash-input-group">
            <input type="tel" id="bkash-phone-input" class="bkash-input" placeholder="e.g. 01xxxxxxxxx" maxlength="11" value="01778522749">
        </div>
        <button id="bkash-phone-confirm" class="bkash-action-btn">Proceed</button>
    `;

    document.getElementById("bkash-phone-confirm").addEventListener("click", () => {
        const phone = document.getElementById("bkash-phone-input").value.trim();
        if (phone.length < 11) {
            alert("Please enter a valid 11-digit mobile number!");
            return;
        }
        
        // STEP 2: Verification Code (OTP)
        body.innerHTML = `
            <div class="bkash-instructions">A verification code (OTP) has been sent to ${phone}. Enter it below.</div>
            <div class="bkash-input-group">
                <input type="text" id="bkash-otp-input" class="bkash-input" placeholder="Verification Code" maxlength="6" value="123456">
            </div>
            <button id="bkash-otp-confirm" class="bkash-action-btn">Verify</button>
        `;

        document.getElementById("bkash-otp-confirm").addEventListener("click", () => {
            // STEP 3: PIN Verification
            body.innerHTML = `
                <div class="bkash-instructions">Enter PIN of your bKash account</div>
                <div class="bkash-input-group">
                    <input type="password" id="bkash-pin-input" class="bkash-input" placeholder="Enter 5-digit PIN" maxlength="5" style="letter-spacing:6px;">
                </div>
                <button id="bkash-pin-confirm" class="bkash-action-btn">Confirm Payment</button>
            `;

            document.getElementById("bkash-pin-confirm").addEventListener("click", () => {
                const pin = document.getElementById("bkash-pin-input").value.trim();
                if (pin.length < 5) {
                    alert("Please enter your 5-digit security PIN!");
                    return;
                }

                // Process Payment (Loading Screen Animation)
                body.innerHTML = `
                    <div style="text-align:center; padding:30px;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E2136E" stroke-width="2" style="animation: spin 1s linear infinite;">
                            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                        </svg>
                        <p style="margin-top:15px; font-weight:600; color:#E2136E;">Processing Transaction...</p>
                    </div>
                `;

                // Add spinning keyframe if not present
                if (!document.getElementById("spin-keyframes")) {
                    const style = document.createElement("style");
                    style.id = "spin-keyframes";
                    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
                    document.head.appendChild(style);
                }

                setTimeout(async () => {
                    const pending = state.pendingCheckout;
                    await finalizeTransactionAsync(
                        amount, reason, slot, 0, storeDeduction,
                        pending?.delivery,
                        "bKash"
                    );
                }, 2000);
            });
        });
    });
}

function finalizeTransaction(amount, reason, slot, creditsToEarn, storeDeduction, delivery = null, paymentMethod = "bKash") {
    return finalizeTransactionAsync(amount, reason, slot, creditsToEarn, storeDeduction, delivery, paymentMethod);
}

async function finalizeTransactionAsync(amount, reason, slot, creditsToEarn, storeDeduction, delivery = null, paymentMethod = "bKash") {
    closeBkashModal();
    document.getElementById("cart-slider")?.classList.remove("open");
    
    if (state.tempBooking) {
        state.bookings.push(state.tempBooking);
        showNotification(`Successfully booked consultation session with ${state.tempBooking.expertName}!`);
        state.tempBooking = null;
        saveState();
        renderPage("dashboard");
        return;
    }

    const orderId = `OD-${Date.now().toString().slice(-6)}`;
    const trackingCode = `TRK-${Date.now().toString().slice(-8)}`;
    const itemsCount = state.cart.reduce((sum, i) => sum + i.qty, 0);
    const details = delivery || state.pendingCheckout?.delivery || getDeliveryDetailsFromCart();
    const lineItems = state.pendingCheckout?.lineItems || buildOrderLineItems(state.cart, state.products);

    state.cart.forEach(item => {
        const p = state.products.find(prod => prod.id === item.id);
        if (p) p.inventory = Math.max(0, p.inventory - item.qty);
    });

    const newOrder = {
        id: orderId,
        trackingCode,
        date: new Date().toLocaleDateString(),
        slot: slot || details.slot || "Morning Shift",
        itemsCount,
        lineItems,
        price: amount,
        status: "Confirmed",
        paymentMethod: paymentMethod || state.pendingCheckout?.paymentMethod || "bKash",
        deliveryFee: state.pendingCheckout?.deliveryFee || 0,
        couponDiscount: state.pendingCheckout?.couponDiscount || 0,
        walletApplied: storeDeduction,
        name: details.name,
        phone: details.phone,
        division: details.division || "",
        district: details.district || "",
        area: details.area,
        addressLine: details.addressLine || "",
        landmark: details.landmark || "",
        address: details.address || formatFullAddress(details),
        guest: !state.currentUser,
        email: details.email || (state.currentUser ? state.currentUser.email : ""),
        birthdate: details.birthdate || (state.currentUser ? state.currentUser.birthdate : "")
    };

    state.orders.push(newOrder);
    state.wallet -= storeDeduction;
    state.pendingCheckout = null;

    if (state.currentUser) {
        const saveAddressChecked = document.getElementById("save-address-to-profile")?.checked;
        const useDifferentAddress = document.getElementById("use-different-address")?.checked;
        const hasDefault = state.currentUser.division && state.currentUser.district && state.currentUser.area && state.currentUser.addressLine;
        
        if (saveAddressChecked || !hasDefault || !useDifferentAddress) {
            state.currentUser.name = details.name;
            state.currentUser.phone = details.phone;
            state.currentUser.division = details.division;
            state.currentUser.district = details.district;
            state.currentUser.area = details.area;
            state.currentUser.addressLine = details.addressLine;
            state.currentUser.landmark = details.landmark;
            state.currentUser.address = details.address;
        }
    }

    if (isSupabaseEnabled()) {
        const saveResult = await saveOrderToSupabase(newOrder, isCloudUser() ? state.currentUser.id : null);
        if (!saveResult.ok) {
            console.warn("Cloud order save failed:", saveResult.message);
        }
    }

    const sheetResult = await appendOrderToGoogleSheet(newOrder);
    if (!sheetResult.ok && !sheetResult.skipped) {
        console.warn("Google Sheets order log failed:", sheetResult.message);
    }

    state.cart = [];
    state.guestCheckout = false;
    state.activeCoupon = "";
    saveState();
    syncCartUI();
    localStorage.setItem(TRACKING_LOOKUP_KEY, orderId);

    const content = document.getElementById("main-content");
    content.innerHTML = `
        <div class="order-success-card">
            <div class="order-success-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/></svg>
            </div>
            <h2>Order Confirmed!</h2>
            <p>Thank you for choosing zero-plastic delivery.</p>
            
            <div class="order-success-details">
                <div><strong>Order Reference:</strong> <span>${orderId}</span></div>
                <div><strong>Tracking ID:</strong> <span>${trackingCode}</span></div>
                <div><strong>Delivery Address:</strong> <span>${details.address}</span></div>
                <div><strong>Division / District / Area:</strong> <span>${details.division}, ${details.district}, ${details.area}</span></div>
                <div><strong>Time Slot:</strong> <span>${newOrder.slot}</span></div>
                <div><strong>Payment:</strong> <span>${newOrder.paymentMethod}</span></div>
                ${storeDeduction > 0 ? `<div><strong>Wallet Applied:</strong> <span>-৳${storeDeduction}</span></div>` : ""}
                ${newOrder.deliveryFee ? `<div><strong>Delivery Fee:</strong> <span>৳${newOrder.deliveryFee}</span></div>` : ""}
                ${newOrder.couponDiscount ? `<div><strong>Promo Discount:</strong> <span>-৳${newOrder.couponDiscount}</span></div>` : ""}
                <div class="order-success-total"><strong>Total:</strong> <span>৳${amount}</span></div>
            </div>

            ${renderOrderTracker("Confirmed", trackingCode)}

            <div class="order-success-actions">
                <button class="hero-cta" id="success-track-btn">Track Order</button>
                <button class="filter-chip" id="success-shop-btn">Continue Shopping</button>
            </div>
        </div>
    `;
    document.getElementById("success-track-btn").addEventListener("click", () => navigateTo("track"));
    document.getElementById("success-shop-btn").addEventListener("click", () => navigateTo("shop"));
    showNotification("Order placed successfully!");
}

function closeBkashModal() {
    document.getElementById("bkash-modal-overlay").classList.remove("open");
}
