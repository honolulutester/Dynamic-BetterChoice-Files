import { state } from '../store.js';
import { t } from '../i18n.js';

export function renderEcoImpactView(container) {
    const returnsList = state.currentUser ? (state.returnRequests || []) : [];
    const totalReturnedQty = returnsList.reduce((sum, r) => sum + r.qty, 0);
    const ordersList = state.currentUser ? (state.orders || []) : [];
    const totalOrdersCount = ordersList.length;
    const userPlasticSaved = (totalReturnedQty * 50) + (totalOrdersCount * 20);

    let currentTierNum = 1;
    let currentTierName = t("level1Name");
    let currentTierDesc = t("level1Desc");
    let nextTierName = t("level2Name");
    let nextTierGoalVal = 5;
    let nextTierReward = t("levelRewardReducedShipping");

    if (totalReturnedQty >= 30) {
        currentTierNum = 4;
        currentTierName = t("level4Name");
        currentTierDesc = t("level4Desc");
        nextTierName = "";
        nextTierGoalVal = 30;
        nextTierReward = "";
    } else if (totalReturnedQty >= 15) {
        currentTierNum = 3;
        currentTierName = t("level3Name");
        currentTierDesc = t("level3Desc");
        nextTierName = t("level4Name");
        nextTierGoalVal = 30;
        nextTierReward = t("levelRewardCertificate");
    } else if (totalReturnedQty >= 5) {
        currentTierNum = 2;
        currentTierName = t("level2Name");
        currentTierDesc = t("level2Desc");
        nextTierName = t("level3Name");
        nextTierGoalVal = 15;
        nextTierReward = t("levelRewardDiscount");
    }

    const TIER_ICONS = {
        1: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#2e7d32;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
        2: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#b27a12;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`,
        3: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#d84315;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"/></svg>`,
        4: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#c2185b;"><circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>`
    };

    const tiers = [
        {
            level: 1,
            name: t("level1Name"),
            required: 0,
            reward: t("ecoCreditsLabel"),
            desc: t("level1Desc"),
            unlocked: state.currentUser && totalReturnedQty >= 0,
            iconSvg: TIER_ICONS[1]
        },
        {
            level: 2,
            name: t("level2Name"),
            required: 5,
            reward: t("levelRewardReducedShipping"),
            desc: t("level2Desc"),
            unlocked: state.currentUser && totalReturnedQty >= 5,
            iconSvg: TIER_ICONS[2]
        },
        {
            level: 3,
            name: t("level3Name"),
            required: 15,
            reward: t("levelRewardDiscount"),
            desc: t("level3Desc"),
            unlocked: state.currentUser && totalReturnedQty >= 15,
            iconSvg: TIER_ICONS[3]
        },
        {
            level: 4,
            name: t("level4Name"),
            required: 30,
            reward: t("levelRewardCertificate"),
            desc: t("level4Desc"),
            unlocked: state.currentUser && totalReturnedQty >= 30,
            iconSvg: TIER_ICONS[4]
        }
    ];

    let progressPercentage = 0;
    if (currentTierNum === 1) {
        progressPercentage = Math.min((totalReturnedQty / 5) * 100, 100);
    } else if (currentTierNum === 2) {
        const subProgress = totalReturnedQty - 5;
        progressPercentage = Math.min((subProgress / (15 - 5)) * 100, 100);
    } else if (currentTierNum === 3) {
        const subProgress = totalReturnedQty - 15;
        progressPercentage = Math.min((subProgress / (30 - 15)) * 100, 100);
    } else if (currentTierNum === 4) {
        progressPercentage = 100;
    }

    if (!state.currentUser) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h2>${t("ecoImpactTitle")}</h2>
                    <p>${t("ecoImpactSubtitle")}</p>
                </div>
            </div>
            
            <div class="impact-layout">
                <div class="guest-impact-card">
                    <p>${t("guestImpactNotice")}</p>
                    <div class="guest-impact-actions">
                        <a href="#login" class="auth-btn login-btn">${t("signIn")}</a>
                        <a href="#register" class="auth-btn register-btn">Sign Up</a>
                    </div>
                </div>
                
                <div class="tiers-grid-title">
                    <h3>Recycling Tiers & Rewards Preview</h3>
                    <p>Earn Eco-Credits for returning glass packaging and unlock these exclusive benefits.</p>
                </div>
                
                <div class="tiers-container-grid">
                    ${tiers.map(tier => `
                        <div class="tier-card locked">
                            <div class="tier-card-lock-overlay">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </div>
                            <div class="tier-header-info">
                                <div class="tier-badge-row">
                                    <span class="tier-level-num">Level ${tier.level}</span>
                                    <span class="tier-status-tag locked-tag">${t("locked")}</span>
                                </div>
                                <h4 class="tier-title">
                                    ${tier.name}
                                </h4>
                                <p class="tier-desc">${tier.desc}</p>
                            </div>
                            <div class="tier-rewards-box">
                                Goal Requirement: ${tier.required} returns<br>
                                Reward: ${tier.reward}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <div class="page-title">
                <h2>${t("ecoImpactTitle")}</h2>
                <p>${t("ecoImpactSubtitle")}</p>
            </div>
        </div>

        <div class="impact-layout">
            <div class="impact-hero-card">
                <div class="impact-hero-header">
                    <h3>${state.currentUser.name}'s Recycling Profile</h3>
                    <p>Make the better, healthier choice for the planet. Your zero-plastic contributions are logged below.</p>
                </div>
                <div class="impact-metrics-row">
                    <div class="impact-metric-col">
                        <div class="impact-metric-label">${t("returnedQtyLabel")}</div>
                        <div class="impact-metric-value">${totalReturnedQty} <span>units</span></div>
                    </div>
                    <div class="impact-metric-col">
                        <div class="impact-metric-label">${t("plasticSavedLabel")}</div>
                        <div class="impact-metric-value">${userPlasticSaved}<span>g</span></div>
                    </div>
                    <div class="impact-metric-col">
                        <div class="impact-metric-label">${t("currentLevel")}</div>
                        <div class="impact-metric-value tier-highlight">${currentTierName}</div>
                    </div>
                </div>
            </div>

            <div class="impact-progress-card">
                <div class="progress-header-row">
                    <h4>Recycling Milestone Progress</h4>
                    <span class="progress-goal-indicator">
                        ${currentTierNum < 4 
                            ? `${totalReturnedQty} / ${nextTierGoalVal} returns`
                            : `Maximum level achieved!`
                        }
                    </span>
                </div>
                <div class="impact-progress-track">
                    <div class="impact-progress-bar" style="width: ${progressPercentage}%;">
                        <span class="progress-pct-overlay">${Math.round(progressPercentage)}%</span>
                    </div>
                </div>
                <div class="progress-footer-text">
                    ${currentTierNum < 4
                        ? `<strong>Goal:</strong> Return <strong>${nextTierGoalVal - totalReturnedQty}</strong> more containers to unlock <strong>${nextTierReward}</strong> (${nextTierName} status).`
                        : `<strong>Incredible!</strong> You have reached the highest tier. Thank you for leading Bangladesh's sustainable retail movement.`
                    }
                </div>
            </div>

            <div class="tiers-grid-title">
                <h3>Recycling Levels & Achievements</h3>
                <p>Track your environmental milestones and review unlocked perks.</p>
            </div>
            
            <div class="tiers-container-grid">
                ${tiers.map(tier => {
                    return `
                        <div class="tier-card ${tier.unlocked ? 'unlocked' : 'locked'}">
                            ${!tier.unlocked ? `
                                <div class="tier-card-lock-overlay" title="${t("locked")}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                </div>
                            ` : ""}
                            <div class="tier-header-info">
                                <div class="tier-badge-row">
                                    <span class="tier-level-num">Level ${tier.level}</span>
                                    <span class="tier-status-tag ${tier.unlocked ? 'unlocked-tag' : 'locked-tag'}">
                                        ${tier.unlocked ? t("unlocked") : t("locked")}
                                    </span>
                                </div>
                                <h4 class="tier-title" style="display:flex; align-items:center; gap:8px;">
                                    <span style="display:inline-flex;">${tier.iconSvg}</span>
                                    ${tier.name}
                                </h4>
                                <p class="tier-desc">${tier.desc}</p>
                            </div>
                            <div class="tier-rewards-box">
                                ${tier.unlocked
                                    ? `<strong>Unlocked Perk:</strong> ${tier.reward}`
                                    : `<strong>Unlocks at:</strong> ${tier.required} returned containers`
                                }
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}
