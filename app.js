import {
    state, loadState, saveState, syncCartUI, updateHeaderAccount,
    clearUserSessionState, syncUserToState, updateCartQty
} from './store.js';
import { DEFAULT_PRODUCTS, fetchGoogleSheetCatalog, getOrderUnit, fetchGoogleSheetEditorial } from './data.js';
import { CATALOG_CACHE_VERSION, TRACKING_LOOKUP_KEY } from './config.js';
import {
    isSupabaseEnabled, initSupabaseAuth, loadUserFromSupabase,
    subscribeNewsletterEmail, isAuthCallbackHash
} from './supabase.js';
import { isOrdersSheetEnabled, isUsersSheetEnabled } from './orders-sheet.js';
import { ORDERS_SHEET_WEBHOOK_URL } from './sheets-config.js';
import { getLang, setLang, applyShellI18n, bindI18nState, t } from './i18n.js';
import { parseProductIdFromUrl, getActivePrice } from './helpers.js';

// --- VIEW MODULE IMPORTS ---
import { renderShopView, renderTraceabilityView } from './views/shop.js';
import { renderEcoImpactView } from './views/impact.js';
import { renderWorkoutView } from './views/workout.js';
import { renderMealView } from './views/meals.js';
import { renderExpertsView, renderEditorialView, renderAboutView, renderPoliciesView, renderTrackView, renderEditorialSubmitView } from './views/misc.js';
import { renderLoginView, renderRegisterView } from './views/auth.js';
import { renderCheckoutView, closeBkashModal } from './views/checkout.js';

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
    "shop", "impact", "traceability", "workout", "meals", "experts", "editorial", "editorial-submit",
    "dashboard", "login", "register", "track", "about", "policies", "checkout"
]);

function getAppPageFromHash(hash = window.location.hash) {
    const raw = (hash || "").replace(/^#/, "");
    if (!raw || isAuthCallbackHash(`#${raw}`)) return null;
    const page = raw.split("&")[0];
    return APP_PAGES.has(page) ? page : null;
}

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

    if (isOrdersSheetEnabled() && ORDERS_SHEET_WEBHOOK_URL) {
        fetch(ORDERS_SHEET_WEBHOOK_URL).catch(() => {});
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

    if (state.editorialSheetUrl) {
        showNotification("Auto-syncing articles with Google Sheets...");
        try {
            const sheetArticles = await fetchGoogleSheetEditorial(state.editorialSheetUrl);
            if (sheetArticles.length > 0) {
                state.articles = sheetArticles;
                saveState();
                showNotification("Editorial Hub successfully updated from Google Sheets!");
            }
        } catch (e) {
            console.warn("Failed auto-syncing Google Sheet articles on startup. Using cached data.", e);
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

// --- ROUTING SYSTEM ---
export function setupRouting() {
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const page = e.currentTarget.getAttribute("data-page");
            navigateTo(page);
        });
    });

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

export function navigateTo(page) {
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

// --- LIVE CHAT DRAWER CONFIGS ---
export function setupLiveChat() {
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

export function openLiveChat() {
    const panel = document.getElementById("live-chat-panel");
    if (panel) {
        panel.classList.add("open");
        const box = document.getElementById("live-chat-messages");
        if (box) box.scrollTop = box.scrollHeight;
    }
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

// Show standard slide-in notification
export function showNotification(message) {
    const banner = document.getElementById("notification-banner");
    banner.querySelector(".notification-msg").textContent = message;
    banner.classList.add("show");
    setTimeout(() => {
        banner.classList.remove("show");
    }, 4000);
}

// --- RENDER ROUTER CONTROLLER ---
export function renderPage(page) {
    document.querySelectorAll(".nav-link").forEach(link => {
        if (link.getAttribute("data-page") === page) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });

    const content = document.getElementById("main-content");
    content.innerHTML = "";

    switch (page) {
        case "shop":
            renderShopView(content);
            break;
        case "impact":
            renderEcoImpactView(content);
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
        case "editorial-submit":
            renderEditorialSubmitView(content);
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

export function navigateAfterAuth() {
    const dest = state.redirectAfterAuth || "shop";
    state.redirectAfterAuth = null;
    navigateTo(dest);
}

// --- CART DRAWER RENDERER ---
export function renderCartItems() {
    const container = document.getElementById("cart-items-list");
    const proceedBtn = document.getElementById("drawer-proceed-btn");

    if (state.cart.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px 0; color:#666;">${t("emptyCart")}</div>`;
        if (proceedBtn) proceedBtn.disabled = true;
        syncCartUI();
        return;
    }

    container.innerHTML = state.cart.map(item => {
        const p = state.products.find(prod => prod.id === item.productId);
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
            state.cart = state.cart.filter(item => item.productId !== id);
            saveState();
            syncCartUI();
            renderCartItems();
        });
    });

    container.querySelectorAll(".qty-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            updateCartQty(btn.getAttribute("data-id"), parseInt(btn.getAttribute("data-delta"), 10));
            renderCartItems();
        });
    });

    if (proceedBtn) proceedBtn.disabled = false;
    syncCartUI();
}

window.navigateTo = navigateTo;
window.renderPage = renderPage;
window.showNotification = showNotification;
window.openLiveChat = openLiveChat;
window.navigateAfterAuth = navigateAfterAuth;


