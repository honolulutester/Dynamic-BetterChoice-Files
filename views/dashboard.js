import {
    state, saveState, syncStateToUser, updateHeaderAccount,
    logoutUser, reorderItems, addToCart, toggleWishlist,
    isMerchantUnlocked, issueEcoCredits, isCloudUser
} from '../store.js';
import { t } from '../i18n.js';
import { isSupabaseEnabled, saveReturnRequestToSupabase, merchantAdvanceOrder } from '../supabase.js';
import { appendUserToGoogleSheet } from '../orders-sheet.js';
import { fetchGoogleSheetCatalog, DEFAULT_PRODUCTS } from '../data.js';
import { MERCHANT_PIN, ORDER_STATUSES } from '../config.js';
import { getActivePrice } from '../helpers.js';
import { renderLocationFieldsHtml, bindLocationFields, readLocationFields, locationFromLegacy, formatFullAddress } from '../location-fields.js';
import { renderLoginView } from './auth.js';
import { renderOrderTracker } from './checkout.js';

function getLoyaltyTier(credits) {
    if (credits < 200) return { name: "Eco-Novice", next: "Eco-Guardian", target: 200, progress: (credits / 200) * 100 };
    if (credits < 500) return { name: "Eco-Guardian", next: "Sustainability Sovereign", target: 500, progress: ((credits - 200) / 300) * 100 };
    return { name: "Sustainability Sovereign", next: "Max Level", target: 500, progress: 100 };
}

export function renderDashboardView(container) {
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
                            <p style="font-size:13px; color:#555; margin:8px 0;">${o.address || o.addressLine}, ${o.area} · ${o.paymentMethod || "bKash"}</p>
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
                btn.addEventListener("click", () => {
                    addToCart(btn.getAttribute("data-id"));
                });
            });
            contentArea.querySelectorAll(".wishlist-remove").forEach(btn => {
                btn.addEventListener("click", () => {
                    toggleWishlist(btn.getAttribute("data-id"));
                    renderTab("wishlist");
                });
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
                        renderPage("shop");
                    } else {
                        throw new Error("No data parsed from CSV sheet feed.");
                    }
                } catch (err) {
                    alert("Synchronization failed! Check CSV configuration.");
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

    container.querySelectorAll(".dashboard-menu-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const tab = e.target.getAttribute("data-tab");
            renderTab(tab);
        });
    });

    renderTab("profile");
}
