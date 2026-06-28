import { DEFAULT_PRODUCTS, DEFAULT_SHEET_URL, fetchGoogleSheetCatalog, ARTICLES, fetchGoogleSheetEditorial } from './data.js';
import { MERCHANT_PIN, CATALOG_CACHE_VERSION } from './config.js';
import { appendUserToGoogleSheet } from './orders-sheet.js';
import { t } from './i18n.js';
import { formatFullAddress } from './location-fields.js';
import {
    isSupabaseEnabled, loadUserFromSupabase,
    supabaseRegister, supabaseLogin, supabaseLogout,
    syncWishlistToSupabase, merchantIssueCredits, refreshCurrentUserProfile
} from './supabase.js';

// --- APPLICATION STATE ---
export let state = {
    products: [...DEFAULT_PRODUCTS],
    articles: [...ARTICLES],
    cart: [],
    wallet: 0,
    lifetimeCredits: 0,
    orders: [],
    bookings: [],
    savedWorkouts: null,
    savedMeals: null,
    sheetUrl: DEFAULT_SHEET_URL,
    editorialSheetUrl: "",
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

// --- SYNCHRONIZE STATE HELPERS ---
export function syncUserToState(user) {
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

export function syncStateToUser() {
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

export function clearUserSessionState() {
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

export function isCloudUser() {
    return state.currentUser?.id && !String(state.currentUser.id).startsWith("usr-");
}

// --- LOCAL STORAGE STATE ACTIONS ---
export function loadState() {
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

        const savedEditorialUrl = localStorage.getItem("eco_editorial_sheet_url");
        state.editorialSheetUrl = savedEditorialUrl || "";

        const cachedProducts = localStorage.getItem("eco_products_cache");
        if (cachedProducts) state.products = JSON.parse(cachedProducts);

        const cachedArticles = localStorage.getItem("eco_articles_cache");
        if (cachedArticles) state.articles = JSON.parse(cachedArticles);
    } catch (e) {
        console.error("Error reading localStorage state:", e);
    }
}

export function saveState() {
    try {
        if (state.currentUser && !isCloudUser()) {
            syncStateToUser();
            localStorage.setItem("eco_users", JSON.stringify(state.users));
            localStorage.setItem("eco_session", state.currentUser.id);
        } else if (!state.currentUser) {
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
        localStorage.setItem("eco_reviews", JSON.stringify(state.productReviews));
        localStorage.setItem("eco_newsletter", JSON.stringify(state.newsletter));
        localStorage.setItem("eco_chat", JSON.stringify(state.chatMessages));
        localStorage.setItem("eco_sheet_url", state.sheetUrl);
        localStorage.setItem("eco_editorial_sheet_url", state.editorialSheetUrl);
        localStorage.setItem("eco_products_cache", JSON.stringify(state.products));
        localStorage.setItem("eco_articles_cache", JSON.stringify(state.articles));
    } catch (e) {
        console.error("Error writing state:", e);
    }
}

// --- GLOBAL SHELL ELEMENT SYNCS ---
export function syncCartUI() {
    const badge = document.getElementById("cart-badge-count");
    const totalQty = state.cart.reduce((sum, item) => sum + item.qty, 0);
    if (badge) {
        badge.textContent = totalQty;
        badge.style.display = totalQty > 0 ? "flex" : "none";
    }

    const { subtotal, itemCount } = getCartTotals();
    const countEl = document.getElementById("cart-item-count");
    const subEl = document.getElementById("cart-drawer-subtotal");
    if (countEl) countEl.textContent = `${itemCount} ${t("items")}`;
    if (subEl) subEl.textContent = `৳${subtotal}`;

    const walletBadge = document.getElementById("header-eco-wallet");
    if (walletBadge) {
        walletBadge.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 3.99L19.53 19H4.47L12 5.99zM13 16h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
            ${state.wallet} ${t("ecoCreditsLabel")}
        `;
    }
}

export function updateHeaderAccount() {
    const label = document.getElementById("header-account-label");
    if (label) {
        label.textContent = state.currentUser ? state.currentUser.name.split(" ")[0] : t("signIn");
    }
}

// --- CORE MUTATION ACTIONS ---
export async function registerUser({ name, email, phone, password, division, district, area, addressLine, landmark, birthdate }) {
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

export async function loginUser(email, password) {
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

export async function logoutUser() {
    if (isSupabaseEnabled()) await supabaseLogout();
    clearUserSessionState();
    saveState();
}

export function isMerchantUnlocked() {
    return sessionStorage.getItem("eco_merchant_unlocked") === "1";
}

export function toggleWishlist(productId) {
    const idx = state.wishlist.indexOf(productId);
    if (idx >= 0) state.wishlist.splice(idx, 1);
    else state.wishlist.push(productId);
    saveState();
    if (isSupabaseEnabled() && isCloudUser()) {
        syncWishlistToSupabase(state.currentUser.id, state.wishlist);
    }
}

export function reorderItems(lineItems) {
    if (!lineItems || !lineItems.length) return 0;
    let added = 0;
    lineItems.forEach(li => {
        const p = state.products.find(x => x.name === li.name);
        if (p && p.inventory !== 0) {
            const qty = Math.min(li.qty, p.inventory || 99);
            const cartItem = state.cart.find(c => c.productId === p.id);
            if (cartItem) cartItem.qty = Math.min(qty, p.inventory || 99);
            else state.cart.push({ productId: p.id, qty });
            added++;
        }
    });
    if (added) {
        saveState();
        syncCartUI();
    }
    return added;
}

export function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || product.inventory === 0) return false;

    const cartItem = state.cart.find(item => item.productId === productId);
    if (cartItem) {
        if (product.inventory && cartItem.qty >= product.inventory) return false;
        cartItem.qty++;
    } else {
        state.cart.push({ productId, qty: 1 });
    }
    saveState();
    syncCartUI();
    return true;
}

export function updateCartQty(productId, delta) {
    const idx = state.cart.findIndex(item => item.productId === productId);
    if (idx === -1) return;

    const product = state.products.find(p => p.id === productId);
    state.cart[idx].qty += delta;

    if (state.cart[idx].qty <= 0) {
        state.cart.splice(idx, 1);
    } else if (product && product.inventory && state.cart[idx].qty > product.inventory) {
        state.cart[idx].qty = product.inventory;
    }
    saveState();
    syncCartUI();
}

export function getCartTotals() {
    let subtotal = 0;
    let itemCount = 0;
    state.cart.forEach(item => {
        const product = state.products.find(p => p.id === item.productId);
        if (product) {
            const price = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
            subtotal += price * item.qty;
            itemCount += item.qty;
        }
    });
    return { subtotal, itemCount };
}

export async function issueEcoCredits(email, amount) {
    if (isSupabaseEnabled()) {
        if (await merchantIssueCredits(email, amount)) {
            if (state.currentUser && state.currentUser.email === email) {
                await refreshCurrentUserProfile(state.currentUser.id, (user) => {
                    if (user) {
                        state.currentUser = user;
                        syncUserToState(user);
                    }
                });
            }
            return true;
        }
        return false;
    }

    const user = state.users.find(u => u.email === email.trim().toLowerCase());
    if (!user) return false;
    user.wallet = (user.wallet || 0) + amount;
    user.lifetimeCredits = (user.lifetimeCredits || 0) + amount;
    if (state.currentUser && state.currentUser.id === user.id) {
        state.wallet = user.wallet;
        state.lifetimeCredits = user.lifetimeCredits;
    }
    saveState();
    syncCartUI();
    return true;
}
