import { state, saveState, syncCartUI } from '../store.js';
import { MEAL_INGREDIENT_KEYS } from '../config.js';
import { findMealProducts } from '../helpers.js';

export function renderMealView(container) {
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
                    <button class="book-slot-btn" id="book-dietician-btn">Book Certified Dietician</button>
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

    document.getElementById("book-dietician-btn").addEventListener("click", () => {
        window.location.hash = '#experts';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

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
    if (!container) return;
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
            const existing = state.cart.find(item => item.productId === product.id);
            if (existing) {
                if (existing.qty < product.inventory) { existing.qty += 1; added++; }
            } else {
                state.cart.push({ productId: product.id, qty: 1 });
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
