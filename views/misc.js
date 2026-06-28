import { EXPERTS, ARTICLES, COMPANY_PROFILE, CUSTOMER_POLICIES } from '../data.js';
import { state } from '../store.js';
import { t } from '../i18n.js';
import { TRACKING_LOOKUP_KEY, ORDER_STATUSES } from '../config.js';
import { isSupabaseEnabled, trackOrderById } from '../supabase.js';
import { formatFullAddress } from '../location-fields.js';
import { triggerBkashPayment, renderOrderTracker } from './checkout.js';

function formatPolicyText(text) {
    return text
        .split("\n\n")
        .map(p => `<p>${p.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`)
        .join("");
}

export function renderExpertsView(container) {
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
            
            const parentCard = e.target.closest(".expert-card");
            const selectedSlotBtn = parentCard.querySelector(".expert-slot-btn.active");
            
            if (!selectedSlotBtn) {
                alert("Please select an availability slot first!");
                return;
            }

            const slot = selectedSlotBtn.getAttribute("data-slot");
            
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

export function renderEditorialView(container) {
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

export function renderAboutView(container) {
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

export function renderPoliciesView(container) {
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

export function renderTrackView(container) {
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
