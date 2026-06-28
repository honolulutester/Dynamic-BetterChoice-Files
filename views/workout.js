import { state, saveState, syncCartUI } from '../store.js';
import { showNotification } from '../app.js';
import { WORKOUT_SHOP_MATCHERS } from '../config.js';

export function renderWorkoutView(container) {
    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>Dynamic Wellness & Workout Planner</h2>
                <p>Construct customized fitness splits designed around urban Bangladeshi life</p>
            </div>
        </div>

        <div class="workout-builder-layout">
            <div class="builder-panel">
                <h3 style="font-family:var(--font-heading); font-size:22px; margin-bottom:20px; color:var(--forest-green)">Biometrics & Schedule</h3>
                <form id="workout-form">
                    <div class="form-group">
                        <label for="workout-goal">Primary Fitness Goal</label>
                        <select id="workout-goal" class="form-control">
                            <option value="hypertrophy">Hypertrophy (Muscle Gain)</option>
                            <option value="fatloss">Fat Loss & Conditioning</option>
                            <option value="mobility">Sustainable Mobility</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="workout-split">Weekly Split Structure</label>
                        <select id="workout-split" class="form-control">
                            <option value="3">3 Days (Full Body)</option>
                            <option value="4">4 Days (Upper / Lower)</option>
                            <option value="5">5 Days (Push/Pull/Legs + arms)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="workout-commute">Commute Time & Commute Stress</label>
                        <select id="workout-commute" class="form-control">
                            <option value="low">Low (< 30 min daily commute)</option>
                            <option value="med">Medium (30 - 90 min daily traffic)</option>
                            <option value="high">High (90+ min daily commute - Heavy fatigue)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="workout-monsoon">Monsoon Adaptability</label>
                        <select id="workout-monsoon" class="form-control">
                            <option value="yes">Monsoon Lockdown (Home workout alternates)</option>
                            <option value="no">Gym Bound (Access to a physical facility)</option>
                        </select>
                    </div>
                    <button type="submit" class="submit-btn">Generate Plan</button>
                </form>
            </div>

            <div class="workout-result-panel" id="workout-result-container">
                <div class="workout-placeholder">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6.5 6.5h11v11h-11zM2 9h4.5M17.5 9H22M2 15h4.5M17.5 15H22"/></svg>
                    <h3>Calibrate Your Regime</h3>
                    <p style="font-size:14px; max-width:320px; margin:10px auto 0;">Provide your goals and daily constraints to outline progressive load splits.</p>
                </div>
            </div>
        </div>
    `;

    // Fill inputs with previously saved workout if it exists
    if (state.savedWorkouts) {
        document.getElementById("workout-goal").value = state.savedWorkouts.inputs.goal;
        document.getElementById("workout-split").value = state.savedWorkouts.inputs.split;
        document.getElementById("workout-commute").value = state.savedWorkouts.inputs.commute;
        document.getElementById("workout-monsoon").value = state.savedWorkouts.inputs.monsoon;
        renderGeneratedWorkout(state.savedWorkouts.plan);
    }

    document.getElementById("workout-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const goal = document.getElementById("workout-goal").value;
        const split = parseInt(document.getElementById("workout-split").value);
        const commute = document.getElementById("workout-commute").value;
        const monsoon = document.getElementById("workout-monsoon").value;

        const generatedPlan = calculateWorkoutPlan(goal, split, commute, monsoon);
        state.savedWorkouts = {
            inputs: { goal, split, commute, monsoon },
            plan: generatedPlan
        };
        saveState();
        renderGeneratedWorkout(generatedPlan);
        showNotification("Workout plan generated and synchronized with profile!");
    });
}

function calculateWorkoutPlan(goal, splitDays, commute, monsoon) {
    const workouts = [];
    const intensity = commute === "high" ? "Moderate Intensity (FATIGUE REGULATION)" : "High Intensity (PROGRESSIVE OVERLOAD)";
    
    // Choose exercise variations based on Monsoon
    const homeOrGym = monsoon === "yes";

    const exercisesDb = {
        chest: homeOrGym ? ["Decline Push-ups (Tempo 3-0-1)", "Floor Dips", "Standard Pushups"] : ["Incline Dumbbell Press", "Barbell Bench Press", "Cable Chest Fly"],
        back: homeOrGym ? ["Towel Isometric Rows", "Door-Frame Pull-ups", "Prone Back Extensions"] : ["Lat Pull-downs", "Barbell Row", "Single-Arm Dumbbell Row"],
        legs: homeOrGym ? ["Pistol Squats", "Bulgarian Split Squats (Slow tempo)", "Glute Bridges"] : ["Barbell Back Squats", "Romanian Deadlifts", "Leg Press"],
        shoulders: homeOrGym ? ["Handstand Hold/Push-ups", "Pike Push-ups", "Water Jar Lateral Raises"] : ["Overhead Barbell Press", "Dumbbell Lateral Raises", "Face Pulls"],
        core: ["Plank Hold (1 min)", "Hanging Leg Raises", "Bicycle Crunches"]
    };

    for (let i = 1; i <= splitDays; i++) {
        let title = `Day ${i}: `;
        let exercises = [];

        if (splitDays === 3) {
            title += "Full Body Calisthenics & Strength";
            exercises = [
                { name: exercisesDb.legs[0], sets: "3 Sets x 8-12 Reps" },
                { name: exercisesDb.chest[0], sets: "3 Sets x 10-15 Reps" },
                { name: exercisesDb.back[0], sets: "3 Sets x 10-12 Reps" },
                { name: exercisesDb.shoulders[1], sets: "2 Sets x 12-15 Reps" },
                { name: exercisesDb.core[0], sets: "3 Sets to Failure" }
            ];
        } else if (splitDays === 4) {
            if (i % 2 === 1) {
                title += "Upper Body Blast";
                exercises = [
                    { name: exercisesDb.chest[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.back[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.shoulders[0], sets: "3 Sets x 10-12 Reps" },
                    { name: exercisesDb.chest[1], sets: "3 Sets x 12 Reps" }
                ];
            } else {
                title += "Lower Body & Core";
                exercises = [
                    { name: exercisesDb.legs[0], sets: "4 Sets x 8-12 Reps" },
                    { name: exercisesDb.legs[1], sets: "3 Sets x 12-15 Reps" },
                    { name: exercisesDb.legs[2], sets: "3 Sets x 15 Reps" },
                    { name: exercisesDb.core[1], sets: "3 Sets x 15 Reps" }
                ];
            }
        } else {
            const pushPullLegs = ["Push Day", "Pull Day", "Leg Day", "Shoulder focus", "Arm Hypertrophy"];
            title += pushPullLegs[i - 1];
            if (i === 1) {
                exercises = [
                    { name: exercisesDb.chest[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.chest[1], sets: "3 Sets x 12 Reps" },
                    { name: exercisesDb.shoulders[1], sets: "3 Sets x 15 Reps" }
                ];
            } else if (i === 2) {
                exercises = [
                    { name: exercisesDb.back[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.back[1], sets: "3 Sets x 12 Reps" },
                    { name: exercisesDb.core[0], sets: "3 Sets" }
                ];
            } else if (i === 3) {
                exercises = [
                    { name: exercisesDb.legs[0], sets: "4 Sets x 8-10 Reps" },
                    { name: exercisesDb.legs[1], sets: "3 Sets x 12 Reps" },
                    { name: exercisesDb.legs[2], sets: "3 Sets x 15 Reps" }
                ];
            } else if (i === 4) {
                exercises = [
                    { name: exercisesDb.shoulders[0], sets: "4 Sets x 8-12 Reps" },
                    { name: exercisesDb.shoulders[1], sets: "3 Sets x 15 Reps" },
                    { name: exercisesDb.core[1], sets: "3 Sets" }
                ];
            } else {
                exercises = [
                    { name: "Chin-Ups / Bicep Curls", sets: "4 Sets x 10 Reps" },
                    { name: "Diamond Push-ups / Tricep Pushdowns", sets: "4 Sets x 12 Reps" },
                    { name: "Wrist Roller / Forearm Curls", sets: "3 Sets x 15 Reps" }
                ];
            }
        }

        workouts.push({ title, exercises, intensity });
    }

    return workouts;
}

function renderGeneratedWorkout(plan) {
    const container = document.getElementById("workout-result-container");
    if (!container) return;
    container.innerHTML = `
        <h3 style="font-family:var(--font-heading); font-size:26px; margin-bottom:8px; color:var(--forest-green)">Your Calibrated Regime</h3>
        <p style="font-size:13px; color:#666; margin-bottom:25px;">Adjusted for fatigue thresholds, traffic stressors, and local weather patterns.</p>
        
        <div class="workout-split-grid">
            ${plan.map(day => `
                <div class="workout-day-card">
                    <div class="workout-day-title">
                        <span>${day.title}</span>
                        <span style="font-size:11px; text-transform:uppercase; background-color:rgba(30,58,47,0.06); padding:4px 10px; border-radius:30px;">${day.intensity}</span>
                    </div>
                    <div class="workout-exercises">
                        ${day.exercises.map(ex => `
                            <div class="exercise-row">
                                <span class="exercise-name">${ex.name}</span>
                                <span class="exercise-sets">${ex.sets}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `).join("")}
        </div>
        <div class="workout-action-row">
            <button class="filter-chip" id="workout-print-btn">Print / Save PDF</button>
            <button class="add-ingredients-btn" id="workout-shop-btn">Shop Recovery Bundle</button>
        </div>
        <p style="font-size:12px; color:#555; margin-top:20px; font-style:italic; text-align:center;">
            * Video guidelines and progressive overload tracking modules can be unlocked by purchasing human specialist consultations.
        </p>
    `;

    document.getElementById("workout-print-btn")?.addEventListener("click", () => window.print());
    document.getElementById("workout-shop-btn")?.addEventListener("click", () => {
        let added = 0;
        WORKOUT_SHOP_MATCHERS.forEach(matcher => {
            const product = state.products.find(p => p.name.toLowerCase().includes(matcher) && p.inventory > 0);
            if (!product) return;
            const existing = state.cart.find(c => c.productId === product.id);
            if (existing) existing.qty = Math.min(existing.qty + 1, product.inventory);
            else state.cart.push({ productId: product.id, qty: 1 });
            added++;
        });
        saveState();
        syncCartUI();
        showNotification(added ? "Recovery bundle added to cart!" : "No matching supplements in stock.");
    });
}
