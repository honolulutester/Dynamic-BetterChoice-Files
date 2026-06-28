import { DELIVERY_FEE, FREE_DELIVERY_CREDITS, FREE_DELIVERY_ORDER_MIN, COUPONS } from './config.js';

export function getActivePrice(product) {
    const isDiscounted = product.salePrice > 0 && product.salePrice < product.price;
    return isDiscounted ? product.salePrice : product.price;
}

export function getDeliveryFee(subtotal, lifetimeCredits) {
    if (lifetimeCredits >= FREE_DELIVERY_CREDITS) return 0;
    if (subtotal >= FREE_DELIVERY_ORDER_MIN) return 0;
    return DELIVERY_FEE;
}

export function applyCoupon(code, subtotal) {
    const key = (code || "").trim().toUpperCase();
    const coupon = COUPONS[key];
    if (!coupon) return { ok: false, message: "Invalid promo code.", discount: 0 };
    if (subtotal < coupon.min) {
        return { ok: false, message: `This code requires a minimum order of ৳${coupon.min}.`, discount: 0 };
    }
    const discount = Math.round(subtotal * (coupon.percent / 100));
    return { ok: true, message: `${coupon.percent}% discount applied!`, discount, code: key };
}

export function getCheckoutTotals(state, couponCode = "") {
    let subtotal = 0;
    state.cart.forEach(item => {
        const p = state.products.find(prod => prod.id === (item.productId || item.id));
        if (!p) return;
        subtotal += getActivePrice(p) * item.qty;
    });
    const couponResult = applyCoupon(couponCode, subtotal);
    const couponDiscount = couponResult.ok ? couponResult.discount : 0;
    const afterCoupon = Math.max(0, subtotal - couponDiscount);
    const storeDeduction = Math.min(state.wallet, afterCoupon);
    const afterWallet = afterCoupon - storeDeduction;
    const deliveryFee = getDeliveryFee(afterCoupon, state.lifetimeCredits);
    const finalTotal = afterWallet + deliveryFee;
    return {
        subtotal,
        couponDiscount,
        couponMessage: couponResult.message,
        couponOk: couponResult.ok,
        afterCoupon,
        storeDeduction,
        deliveryFee,
        finalTotal,
        itemCount: state.cart.reduce((s, i) => s + i.qty, 0)
    };
}

export function buildOrderLineItems(cart, products) {
    return cart.map(item => {
        const p = products.find(prod => prod.id === (item.productId || item.id));
        if (!p) return null;
        const price = getActivePrice(p);
        return {
            id: p.id,
            name: p.name,
            qty: item.qty,
            unit: p.unit || "",
            price,
            lineTotal: price * item.qty
        };
    }).filter(Boolean);
}

export function getProductTraceUrl(productId) {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?pid=${encodeURIComponent(productId)}#traceability`;
}

export function parseProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("pid");
}

export function findMealProducts(products, keys) {
    return keys.map(({ matchers }) => {
        return products.find(p => {
            const name = p.name.toLowerCase();
            return matchers.some(m => name.includes(m)) && p.inventory > 0;
        }) || null;
    }).filter(Boolean);
}

export function drawQRToCanvas(canvas, text) {
    const ctx = canvas.getContext("2d");
    const modules = generateQRModules(text);
    const n = modules.length;
    const cell = Math.floor(canvas.width / (n + 2));
    const offset = Math.floor((canvas.width - cell * n) / 2);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e3a2f";
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (modules[r][c]) {
                ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
            }
        }
    }
}

function generateQRModules(text) {
    const size = 25;
    const grid = Array.from({ length: size }, () => Array(size).fill(false));
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const v = (hash + r * 17 + c * 31) % 97;
            grid[r][c] = v % 3 === 0 || v % 7 === 0;
        }
    }
    drawFinder(grid, 0, 0);
    drawFinder(grid, 0, size - 7);
    drawFinder(grid, size - 7, 0);
    return grid;
}

function drawFinder(grid, row, col) {
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
            const edge = r === 0 || r === 6 || c === 0 || c === 6;
            const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            if (row + r < grid.length && col + c < grid[0].length) {
                grid[row + r][col + c] = edge || inner;
            }
        }
    }
}
