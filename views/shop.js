import { state, addToCart, toggleWishlist } from '../store.js';
import { getOrderUnit } from '../data.js';
import { t, subcategoryLabel, SHOP_CATEGORY_CHIPS } from '../i18n.js';
import { getActivePrice, getProductTraceUrl, drawQRToCanvas } from '../helpers.js';
import { isSupabaseEnabled, fetchProductReviews, submitProductReview } from '../supabase.js';

export function renderProductImage(product, className = "product-img") {
    if (product.image) {
        return `<img src="${product.image}" alt="${product.name}" class="${className}" loading="lazy">`;
    }
    return `<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12zm-7-8c-2.76 0-5 2.24-5 5h2c0-1.66 1.34-3 3-3s3 1.34 3 3h2c0-2.76-2.24-5-5-5z"/></svg>`;
}

export function renderShopView(container) {
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
        <div class="pagination-container" id="shop-pagination"></div>
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
    let currentPage = 1;
    const itemsPerPage = 16;

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
                currentPage = 1;
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

        const paginationGrid = document.getElementById("shop-pagination");

        if (filtered.length === 0) {
            productGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#666;">${t("noProductsFound")}</div>`;
            if (paginationGrid) paginationGrid.innerHTML = "";
            return;
        }

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

        productGrid.innerHTML = paginated.map(p => {
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
                toggleWishlist(id);
                const on = state.wishlist.includes(id);
                e.currentTarget.classList.toggle("active", on);
                showNotification(on ? "Added to wishlist." : "Removed from wishlist.");
            });
        });

        // Render pagination controls
        if (paginationGrid) {
            if (totalPages <= 1) {
                paginationGrid.innerHTML = "";
            } else {
                const startItem = startIndex + 1;
                const endItem = Math.min(startIndex + itemsPerPage, filtered.length);
                const infoText = t("showingProducts", { start: startItem, end: endItem, total: filtered.length });
                
                const prevDisabled = currentPage === 1 ? "disabled" : "";
                const nextDisabled = currentPage === totalPages ? "disabled" : "";
                
                let pagesHtml = "";
                if (totalPages <= 5) {
                    for (let i = 1; i <= totalPages; i++) {
                        pagesHtml += `<button class="pagination-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                    }
                } else {
                    if (currentPage > 2) {
                        pagesHtml += `<button class="pagination-number" data-page="1">1</button>`;
                        if (currentPage > 3) pagesHtml += `<span class="pagination-ellipsis">...</span>`;
                    }
                    
                    const start = Math.max(1, currentPage - 1);
                    const end = Math.min(totalPages, currentPage + 1);
                    for (let i = start; i <= end; i++) {
                        if (i === 1 && currentPage > 2) continue;
                        if (i === totalPages && currentPage < totalPages - 1) continue;
                        pagesHtml += `<button class="pagination-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                    }
                    
                    if (currentPage < totalPages - 1) {
                        if (currentPage < totalPages - 2) pagesHtml += `<span class="pagination-ellipsis">...</span>`;
                        pagesHtml += `<button class="pagination-number" data-page="${totalPages}">${totalPages}</button>`;
                    }
                }

                paginationGrid.innerHTML = `
                    <span class="pagination-info">${infoText}</span>
                    <div class="pagination">
                        <button class="pagination-btn prev-btn" ${prevDisabled} aria-label="${t("prevPage")}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                        </button>
                        ${pagesHtml}
                        <button class="pagination-btn next-btn" ${nextDisabled} aria-label="${t("nextPage")}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                        </button>
                    </div>
                `;

                paginationGrid.querySelector(".prev-btn").addEventListener("click", () => {
                    if (currentPage > 1) {
                        currentPage--;
                        filterAndRender();
                        document.querySelector(".page-header").scrollIntoView({ behavior: "smooth" });
                    }
                });

                paginationGrid.querySelector(".next-btn").addEventListener("click", () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        filterAndRender();
                        document.querySelector(".page-header").scrollIntoView({ behavior: "smooth" });
                    }
                });

                paginationGrid.querySelectorAll(".pagination-number").forEach(numBtn => {
                    numBtn.addEventListener("click", (e) => {
                        const targetPage = parseInt(e.currentTarget.getAttribute("data-page"), 10);
                        if (targetPage && targetPage !== currentPage) {
                            currentPage = targetPage;
                            filterAndRender();
                            document.querySelector(".page-header").scrollIntoView({ behavior: "smooth" });
                        }
                    });
                });
            }
        }
    };

    // Category filters bind
    document.querySelectorAll("#category-filters .filter-chip").forEach(chip => {
        chip.addEventListener("click", (e) => {
            document.querySelectorAll("#category-filters .filter-chip").forEach(c => c.classList.remove("active"));
            e.target.classList.add("active");
            activeCat = e.target.getAttribute("data-category");
            activeSubcat = "All";
            currentPage = 1;
            renderSubcategoryFilters();
            filterAndRender();
        });
    });

    searchInput.addEventListener("input", () => {
        currentPage = 1;
        filterAndRender();
    });
    sortSelect.addEventListener("change", () => {
        currentPage = 1;
        filterAndRender();
    });
    renderSubcategoryFilters();
    filterAndRender();
}

export async function renderTraceabilityView(container) {
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
            state.saveState(); // Update cached copy
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
