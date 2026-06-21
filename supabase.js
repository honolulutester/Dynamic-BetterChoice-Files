import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";
import { MERCHANT_PIN } from "./config.js";

let client = null;

export function isSupabaseEnabled() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.includes("supabase.co"));
}

export function getAuthRedirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
}

export function isAuthCallbackHash(hash = window.location.hash) {
    if (!hash || hash === "#") return false;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    return params.has("access_token") || params.has("refresh_token") || params.has("error") || params.has("error_description");
}

export function getSupabase() {
    if (!isSupabaseEnabled()) return null;
    if (!client) {
        client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                detectSessionInUrl: true,
                persistSession: true,
                autoRefreshToken: true,
                flowType: "implicit"
            }
        });
    }
    return client;
}

function dbOrderToApp(row) {
    if (!row) return null;
    return {
        id: row.id,
        trackingCode: row.tracking_code,
        date: row.order_date,
        slot: row.slot,
        itemsCount: row.items_count,
        lineItems: row.line_items || [],
        price: Number(row.price),
        status: row.status,
        paymentMethod: row.payment_method,
        deliveryFee: Number(row.delivery_fee || 0),
        couponDiscount: Number(row.coupon_discount || 0),
        walletApplied: Number(row.wallet_applied || 0),
        name: row.recipient_name,
        phone: row.phone,
        division: row.division || "",
        district: row.district || "",
        area: row.area,
        addressLine: row.address_line || row.address || "",
        landmark: row.landmark || "",
        address: row.address,
        guest: row.is_guest
    };
}

function appOrderToDb(order, userId) {
    return {
        id: order.id,
        user_id: userId || null,
        tracking_code: order.trackingCode,
        order_date: order.date,
        slot: order.slot,
        items_count: order.itemsCount,
        line_items: order.lineItems || [],
        price: order.price,
        status: order.status || "Confirmed",
        payment_method: order.paymentMethod,
        delivery_fee: order.deliveryFee || 0,
        coupon_discount: order.couponDiscount || 0,
        wallet_applied: order.walletApplied || 0,
        recipient_name: order.name,
        phone: order.phone,
        division: order.division || "",
        district: order.district || "",
        area: order.area,
        address_line: order.addressLine || order.address || "",
        landmark: order.landmark || "",
        address: order.address,
        is_guest: Boolean(order.guest)
    };
}

function profileRowToUser(profile, orders, wishlist, returnRequests) {
    return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone || "",
        division: profile.division || "Dhaka",
        district: profile.district || "Dhaka",
        area: profile.area || "Gulshan",
        addressLine: profile.address_line || profile.address || "",
        landmark: profile.landmark || "",
        address: profile.address || "",
        birthdate: profile.birthdate || "",
        wallet: Number(profile.wallet || 0),
        lifetimeCredits: Number(profile.lifetime_credits || 0),
        cart: profile.cart || [],
        bookings: profile.bookings || [],
        savedWorkouts: profile.saved_workouts,
        savedMeals: profile.saved_meals,
        subscribed: profile.subscribed || false,
        orders: orders.map(dbOrderToApp),
        wishlist: wishlist || [],
        returnRequests: (returnRequests || []).map(r => ({
            id: r.id,
            qty: r.qty,
            type: r.container_type,
            notes: r.notes,
            status: r.status,
            date: new Date(r.created_at).toLocaleDateString()
        }))
    };
}

export async function initSupabaseAuth(onAuthChange) {
    const sb = getSupabase();
    if (!sb) return { session: null, authCallback: false };

    const hadAuthHash = isAuthCallbackHash();

    sb.auth.onAuthStateChange((_event, session) => {
        onAuthChange?.(session);
    });

    const { data: { session }, error } = await sb.auth.getSession();

    if (hadAuthHash) {
        const base = `${window.location.pathname}${window.location.search}`;
        if (session) {
            history.replaceState(null, "", `${base}#dashboard`);
        } else {
            history.replaceState(null, "", `${base}#login`);
        }
    }

    return {
        session,
        authCallback: hadAuthHash,
        error: error?.message || (hadAuthHash && !session
            ? new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description")
            : null)
    };
}

export async function loadUserFromSupabase(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return null;

    const [profileRes, ordersRes, wishlistRes, returnsRes] = await Promise.all([
        sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
        sb.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        sb.from("wishlist").select("product_id").eq("user_id", userId),
        sb.from("return_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false })
    ]);

    if (profileRes.error) throw profileRes.error;
    if (!profileRes.data) return null;

    return profileRowToUser(
        profileRes.data,
        ordersRes.data || [],
        (wishlistRes.data || []).map(w => w.product_id),
        returnsRes.data || []
    );
}

export async function supabaseRegister({ name, email, phone, password, division, district, area, addressLine, landmark, address, birthdate }) {
    const sb = getSupabase();
    if (!sb) return { ok: false, message: "Supabase is not configured." };

    const normalizedEmail = email.trim().toLowerCase();
    const fullAddress = address || [addressLine, landmark, area, district, division].filter(Boolean).join(", ");
    const { data, error } = await sb.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
            data: {
                name: name.trim(),
                phone,
                division,
                district,
                area,
                address_line: addressLine,
                landmark,
                address: fullAddress,
                birthdate: birthdate || ""
            },
            emailRedirectTo: getAuthRedirectUrl()
        }
    });

    if (error) return { ok: false, message: error.message };
    if (!data.user) return { ok: false, message: "Registration failed." };

    const { error: profileError } = await sb.from("profiles").upsert({
        id: data.user.id,
        email: normalizedEmail,
        name: name.trim(),
        phone: phone.trim(),
        division: division || "Dhaka",
        district: district || "Dhaka",
        area: area || "Gulshan",
        address_line: addressLine?.trim() || "",
        landmark: landmark?.trim() || "",
        address: fullAddress,
        birthdate: birthdate || null
    });

    if (profileError && data.session) return { ok: false, message: profileError.message };

    if (data.session) {
        const user = await loadUserFromSupabase(data.user.id);
        return { ok: true, user, needsEmailConfirm: false };
    }

    return {
        ok: true,
        needsEmailConfirm: true,
        message: "Check your email to confirm your account, then sign in."
    };
}

export async function supabaseLogin(email, password) {
    const sb = getSupabase();
    if (!sb) return { ok: false, message: "Supabase is not configured." };

    const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
    });

    if (error) {
        const needsEmailConfirm = /not confirmed|email.*confirm/i.test(error.message);
        return {
            ok: false,
            message: needsEmailConfirm
                ? "Please confirm your email first. Check your inbox, or tap Resend confirmation below."
                : error.message,
            needsEmailConfirm
        };
    }
    const user = await loadUserFromSupabase(data.user.id);
    if (!user) return { ok: false, message: "Profile not found. Contact support." };
    return { ok: true, user };
}

export async function resendConfirmationEmail(email) {
    const sb = getSupabase();
    if (!sb) return { ok: false, message: "Supabase is not configured." };

    const { error } = await sb.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: getAuthRedirectUrl() }
    });

    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Confirmation email sent. Open the link on the same device where you use BetterChoice." };
}

export async function supabaseLogout() {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
}

export async function supabaseResetPassword(email) {
    const sb = getSupabase();
    if (!sb) return { ok: false, message: "Supabase is not configured." };
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: getAuthRedirectUrl()
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Password reset link sent to your email." };
}

export async function persistProfileToSupabase(userId, snapshot) {
    const sb = getSupabase();
    if (!sb || !userId) return;

    await sb.from("profiles").update({
        name: snapshot.name,
        phone: snapshot.phone,
        division: snapshot.division,
        district: snapshot.district,
        area: snapshot.area,
        address_line: snapshot.addressLine,
        landmark: snapshot.landmark,
        address: snapshot.address,
        birthdate: snapshot.birthdate || null,
        wallet: snapshot.wallet,
        lifetime_credits: snapshot.lifetimeCredits,
        cart: snapshot.cart,
        bookings: snapshot.bookings,
        saved_workouts: snapshot.savedWorkouts,
        saved_meals: snapshot.savedMeals,
        subscribed: snapshot.subscribed,
        updated_at: new Date().toISOString()
    }).eq("id", userId);
}

export async function saveOrderToSupabase(order, userId) {
    const sb = getSupabase();
    if (!sb) return { ok: false };
    const { error } = await sb.from("orders").insert(appOrderToDb(order, userId));
    if (error) {
        console.error("Order save failed:", error);
        return { ok: false, message: error.message };
    }
    return { ok: true };
}

export async function syncWishlistToSupabase(userId, productIds) {
    const sb = getSupabase();
    if (!sb || !userId) return;

    await sb.from("wishlist").delete().eq("user_id", userId);
    if (!productIds.length) return;

    await sb.from("wishlist").insert(
        productIds.map(product_id => ({ user_id: userId, product_id }))
    );
}

export async function saveReturnRequestToSupabase(userId, request) {
    const sb = getSupabase();
    if (!sb || !userId) return;
    await sb.from("return_requests").insert({
        id: request.id,
        user_id: userId,
        qty: request.qty,
        container_type: request.type,
        notes: request.notes || "",
        status: request.status
    });
}

export async function fetchProductReviews(productId) {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from("product_reviews")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
    return (data || []).map(r => ({
        user: r.user_name,
        rating: r.rating,
        text: r.review_text,
        date: new Date(r.created_at).toLocaleDateString()
    }));
}

export async function submitProductReview({ productId, userId, userName, rating, text }) {
    const sb = getSupabase();
    if (!sb) return { ok: false };
    const { error } = await sb.from("product_reviews").insert({
        product_id: productId,
        user_id: userId,
        user_name: userName,
        rating,
        review_text: text
    });
    return error ? { ok: false, message: error.message } : { ok: true };
}

export async function subscribeNewsletterEmail(email) {
    const sb = getSupabase();
    if (!sb) return { ok: false };
    const { error } = await sb.from("newsletter_subscribers").upsert({ email: email.trim().toLowerCase() });
    return error ? { ok: false, message: error.message } : { ok: true };
}

export async function trackOrderById(orderId) {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc("get_order_for_tracking", { order_id: orderId.trim() });
    if (error || !data?.length) return null;
    return dbOrderToApp(data[0]);
}

export async function merchantIssueCredits(email, amount) {
    const sb = getSupabase();
    if (!sb) return false;
    const { data, error } = await sb.rpc("merchant_issue_credits", {
        target_email: email.trim().toLowerCase(),
        credit_amount: amount,
        pin: MERCHANT_PIN
    });
    if (error) {
        console.error(error);
        return false;
    }
    return Boolean(data);
}

export async function merchantAdvanceOrder(orderId) {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc("merchant_advance_order", {
        order_id: orderId.trim(),
        pin: MERCHANT_PIN
    });
    if (error) {
        console.error(error);
        return null;
    }
    return data;
}

export async function refreshCurrentUserOrders(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return [];
    const { data } = await sb.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return (data || []).map(dbOrderToApp);
}

export async function refreshCurrentUserProfile(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return null;
    const { data } = await sb.from("profiles").select("wallet, lifetime_credits").eq("id", userId).maybeSingle();
    return data ? { wallet: Number(data.wallet), lifetimeCredits: Number(data.lifetime_credits) } : null;
}
