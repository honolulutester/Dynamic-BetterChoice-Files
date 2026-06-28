import { state, loginUser, registerUser, updateHeaderAccount } from '../store.js';
import { isSupabaseEnabled, supabaseResetPassword, resendConfirmationEmail } from '../supabase.js';
import { renderLocationFieldsHtml, bindLocationFields, readLocationFields } from '../location-fields.js';
import { t } from '../i18n.js';
import { navigateTo, navigateAfterAuth, showNotification } from '../app.js';

export function renderLoginView(container) {
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

export function renderRegisterView(container) {
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
