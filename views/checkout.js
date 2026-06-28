import { state, saveState, syncCartUI, isCloudUser } from '../store.js';
import { getOrderUnit } from '../data.js';
import { t, orderStatusLabel } from '../i18n.js';
import { getActivePrice, getCheckoutTotals, applyCoupon, buildOrderLineItems } from '../helpers.js';
import { isSupabaseEnabled, saveOrderToSupabase } from '../supabase.js';
import { renderLocationFieldsHtml, bindLocationFields, readLocationFields, locationFromLegacy, formatFullAddress } from '../location-fields.js';
import { COUPONS, ORDER_STATUSES, TRACKING_LOOKUP_KEY } from '../config.js';
import { appendOrderToGoogleSheet } from '../orders-sheet.js';

export function renderCheckoutView(container) {
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
        const p = state.products.find(prod => prod.id === (item.productId || item.id));
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
                        <div class="payment-method-row" style="margin-bottom: 6px;">
                            <label class="payment-option"><input type="radio" name="payment-method" value="bkash" checked> bKash</label>
                            <label class="payment-option"><input type="radio" name="payment-method" value="cod"> Cash on Delivery</label>
                        </div>
                        <small style="color:#777; font-size:11px; display:block;">
                            * Cards (Visa/Mastercard) and other mobile wallets (Nagad, Rocket) coming soon!
                        </small>
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

export function renderOrderTracker(status, trackingCode) {
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

// --- UPGRADED INTERACTIVE BKASH PAYMENT GATEWAY SIMULATION ---
export function triggerBkashPayment(amount, reason, slot = "", creditsToEarn = 0, storeDeduction = 0) {
    const modal = document.getElementById("bkash-modal-overlay");
    modal.classList.add("open");

    // Close any drawers
    document.getElementById("cart-slider").classList.remove("open");

    document.getElementById("bkash-merchant-amount").textContent = `৳${amount}`;
    document.getElementById("bkash-merchant-num").textContent = "01778522749";

    const body = document.getElementById("bkash-modal-body");
    
    // STEP 1: Phone Number Input & Validation
    const renderStep1 = () => {
        body.innerHTML = `
            <div class="bkash-instructions">Enter your bKash wallet number to initiate transaction</div>
            <div class="bkash-input-group">
                <input type="tel" id="bkash-phone-input" class="bkash-input" placeholder="e.g. 01xxxxxxxxx" maxlength="11" value="01778522749">
                <div class="bkash-error-msg" id="bkash-phone-error" style="color:#ffcc00; font-size:11px; margin-top:4px; display:none;"></div>
            </div>
            <button id="bkash-phone-confirm" class="bkash-action-btn">Proceed</button>
            <div style="font-size: 10px; color: rgba(255,255,255,0.7); text-align: center; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 10px;">
                Note: Additional payment options (Visa/Mastercard, Nagad, Rocket) are currently in development.
            </div>
        `;

        document.getElementById("bkash-phone-confirm").addEventListener("click", () => {
            const phone = document.getElementById("bkash-phone-input").value.trim();
            const errEl = document.getElementById("bkash-phone-error");
            
            if (!/^01\d{9}$/.test(phone)) {
                errEl.textContent = "Please enter a valid 11-digit bKash wallet number!";
                errEl.style.display = "block";
                return;
            }
            errEl.style.display = "none";

            // Simulating API loading validation delay
            body.innerHTML = `
                <div style="text-align:center; padding:30px;">
                    <div class="bkash-spinner" style="margin: 0 auto 15px;"></div>
                    <p style="font-weight:600; color:#E2136E;">Verifying wallet account...</p>
                </div>
            `;

            setTimeout(() => {
                // Generate simulated OTP
                const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
                
                // Visual SMS Notification overlay toast
                const toast = document.createElement("div");
                toast.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #333;
                    color: #fff;
                    padding: 12px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 99999;
                    font-family: monospace;
                    border-left: 5px solid #E2136E;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                `;
                toast.innerHTML = `
                    <div style="font-weight:bold; font-size:11px; color:#E2136E;">💬 SMS (bKash)</div>
                    <div>Verification code: <strong>${generatedOtp}</strong> for BetterChoice payment of ৳${amount}. Valid for 3 mins.</div>
                `;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 12000);

                renderStep2(phone, generatedOtp);
            }, 1000);
        });
    };

    // STEP 2: Verification Code (OTP) & Timer
    const renderStep2 = (phone, generatedOtp) => {
        let timeLeft = 60;
        body.innerHTML = `
            <div class="bkash-instructions">A verification code (OTP) has been sent to ${phone}. Enter it below.</div>
            <div class="bkash-input-group">
                <input type="text" id="bkash-otp-input" class="bkash-input" placeholder="Enter 6-digit OTP" maxlength="6" style="text-align:center; letter-spacing:4px;">
                <div class="bkash-error-msg" id="bkash-otp-error" style="color:#ffcc00; font-size:11px; margin-top:4px; display:none;"></div>
                <div id="bkash-otp-timer" style="color:#fff; font-size:11px; margin-top:8px; opacity:0.8; text-align:center;">Resend OTP in 60s</div>
            </div>
            <button id="bkash-otp-confirm" class="bkash-action-btn">Verify OTP</button>
        `;

        const timerEl = document.getElementById("bkash-otp-timer");
        const timerId = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(timerId);
                timerEl.innerHTML = `<a href="#" id="resend-otp-link" style="color:#fff; text-decoration:underline;">Resend OTP</a>`;
                document.getElementById("resend-otp-link").addEventListener("click", (e) => {
                    e.preventDefault();
                    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
                    showNotification("Simulated OTP Resent!");
                    clearInterval(timerId);
                    renderStep2(phone, newOtp);
                });
            } else {
                timerEl.textContent = `Resend OTP in ${timeLeft}s`;
            }
        }, 1000);

        document.getElementById("bkash-otp-confirm").addEventListener("click", () => {
            const enteredOtp = document.getElementById("bkash-otp-input").value.trim();
            const errEl = document.getElementById("bkash-otp-error");

            if (enteredOtp !== generatedOtp) {
                errEl.textContent = "Invalid verification code! Please check the SMS notification toast.";
                errEl.style.display = "block";
                return;
            }
            clearInterval(timerId);
            errEl.style.display = "none";
            renderStep3();
        });
    };

    // STEP 3: PIN Verification
    const renderStep3 = () => {
        body.innerHTML = `
            <div class="bkash-instructions">Enter PIN of your bKash account</div>
            <div class="bkash-input-group">
                <input type="password" id="bkash-pin-input" class="bkash-input" placeholder="Enter 5-digit PIN" maxlength="5" style="text-align:center; letter-spacing:8px;">
                <div class="bkash-error-msg" id="bkash-pin-error" style="color:#ffcc00; font-size:11px; margin-top:4px; display:none;"></div>
            </div>
            <button id="bkash-pin-confirm" class="bkash-action-btn">Confirm Payment</button>
        `;

        document.getElementById("bkash-pin-confirm").addEventListener("click", () => {
            const pin = document.getElementById("bkash-pin-input").value.trim();
            const errEl = document.getElementById("bkash-pin-error");

            if (!/^\d{5}$/.test(pin)) {
                errEl.textContent = "Please enter your 5-digit numerical security PIN!";
                errEl.style.display = "block";
                return;
            }
            errEl.style.display = "none";

            // STEP 4: Processing Screen with status shifts
            body.innerHTML = `
                <div style="text-align:center; padding:30px;">
                    <div class="bkash-spinner" style="margin: 0 auto 15px;"></div>
                    <p id="bkash-status-text" style="font-weight:600; color:#E2136E; transition: all 0.3s;">Connecting to bKash gateway...</p>
                </div>
            `;

            const statusText = document.getElementById("bkash-status-text");
            setTimeout(() => {
                statusText.textContent = `Authorizing amount of ৳${amount}...`;
            }, 1000);

            setTimeout(async () => {
                statusText.textContent = "Payment successful! finalising order...";
                const pending = state.pendingCheckout;
                await finalizeTransactionAsync(
                    amount, reason, slot, 0, storeDeduction,
                    pending?.delivery,
                    "bKash"
                );
            }, 2500);
        });
    };

    // Add styles for the bKash spinner if not present
    if (!document.getElementById("bkash-sandbox-styles")) {
        const style = document.createElement("style");
        style.id = "bkash-sandbox-styles";
        style.textContent = `
            .bkash-spinner {
                width: 48px;
                height: 48px;
                border: 5px solid rgba(226, 19, 110, 0.25);
                border-top-color: #E2136E;
                border-radius: 50%;
                animation: bkash-spin 1s linear infinite;
            }
            @keyframes bkash-spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }

    renderStep1();
}

export function closeBkashModal() {
    document.getElementById("bkash-modal-overlay").classList.remove("open");
}

export async function finalizeTransactionAsync(amount, reason, slot, creditsToEarn, storeDeduction, delivery = null, paymentMethod = "bKash") {
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
        const p = state.products.find(prod => prod.id === (item.productId || item.id));
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

    // Dynamic digital invoice receipt layout
    const content = document.getElementById("main-content");
    content.innerHTML = `
        <div class="order-success-card">
            <div class="order-success-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/></svg>
            </div>
            <h2>Order Confirmed!</h2>
            <p>Thank you for choosing zero-plastic delivery. Your invoice has been generated below.</p>
            
            <div class="order-invoice-receipt" id="printable-invoice" style="background:#fff; border:1px solid #eee; border-radius:8px; padding:24px; text-align:left; color:#333; margin:24px 0; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--forest-green); padding-bottom:12px; margin-bottom:16px;">
                    <div>
                        <h3 style="margin:0; font-family:var(--font-heading); color:var(--forest-green);">BetterChoice</h3>
                        <small style="color:#666;">Bangladesh Sustainable Retail Movement</small>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-weight:bold; color:#777;">INVOICE</span><br>
                        <small>Date: ${newOrder.date}</small>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; font-size:12px; line-height:1.4;">
                    <div>
                        <strong style="color:var(--forest-green); text-transform:uppercase; font-size:10px; letter-spacing:0.05em; display:block; margin-bottom:4px;">Delivered To:</strong>
                        <strong>Name:</strong> ${details.name}<br>
                        <strong>Phone:</strong> ${details.phone}<br>
                        <strong>Address:</strong> ${details.address}
                    </div>
                    <div>
                        <strong style="color:var(--forest-green); text-transform:uppercase; font-size:10px; letter-spacing:0.05em; display:block; margin-bottom:4px;">Metadata:</strong>
                        <strong>Order Ref:</strong> ${orderId}<br>
                        <strong>Payment:</strong> ${newOrder.paymentMethod}<br>
                        <strong>Time Slot:</strong> ${newOrder.slot}
                    </div>
                </div>

                <div style="margin-bottom:20px;">
                    <table style="width:100%; border-collapse:collapse; font-size:12px;">
                        <thead>
                            <tr style="border-bottom:1px solid #ddd; text-align:left; color:#666; font-weight:bold;">
                                <th style="padding:6px 0;">Item Description</th>
                                <th style="padding:6px 0; text-align:center;">Qty</th>
                                <th style="padding:6px 0; text-align:right;">Price</th>
                                <th style="padding:6px 0; text-align:right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lineItems.map(item => `
                                <tr style="border-bottom:1px solid #f4f4f4;">
                                    <td style="padding:8px 0;">${item.name}</td>
                                    <td style="padding:8px 0; text-align:center;">${item.qty}</td>
                                    <td style="padding:8px 0; text-align:right;">৳${item.price}</td>
                                    <td style="padding:8px 0; text-align:right;">৳${item.lineTotal}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>

                <div style="border-top:1px solid #ddd; padding-top:10px; font-size:12px; text-align:right; line-height:1.6;">
                    ${storeDeduction > 0 ? `<div>Wallet Applied: <span style="color:red;">-৳${storeDeduction}</span></div>` : ""}
                    ${newOrder.couponDiscount ? `<div>Promo Discount: <span style="color:red;">-৳${newOrder.couponDiscount}</span></div>` : ""}
                    ${newOrder.deliveryFee ? `<div>Delivery Fee: <span>৳${newOrder.deliveryFee}</span></div>` : ""}
                    <div style="font-size:16px; font-weight:bold; color:var(--forest-green); margin-top:4px;">Grand Total: <span>৳${amount}</span></div>
                </div>
            </div>

            ${renderOrderTracker("Confirmed", trackingCode)}

            <div class="order-success-actions" style="margin-top:24px;">
                <button class="hero-cta" id="success-print-btn" style="background:#555; border-color:#555;">Print Invoice</button>
                <button class="hero-cta" id="success-track-btn">Track Order</button>
                <button class="filter-chip" id="success-shop-btn">Continue Shopping</button>
            </div>
        </div>
    `;

    document.getElementById("success-print-btn").addEventListener("click", () => {
        window.print();
    });
    document.getElementById("success-track-btn").addEventListener("click", () => navigateTo("track"));
    document.getElementById("success-shop-btn").addEventListener("click", () => navigateTo("shop"));
    showNotification("Order placed successfully!");
}
