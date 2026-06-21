import { getAreasForDistrict, getDistrictsForDivision, getDefaultLocation, BANGLADESH_LOCATIONS } from "./bangladesh-locations.js";
import { getLang } from "./i18n.js";

export function formatFullAddress(loc = {}) {
    return [
        loc.addressLine,
        loc.landmark,
        loc.area,
        loc.district,
        loc.division
    ].filter(Boolean).join(", ");
}

export function locationFromLegacy(user = {}) {
    const defaults = getDefaultLocation();
    if (!user || (!user.division && user.area)) {
        const legacyArea = user.area || defaults.area;
        const inDhakaCity = ["Gulshan", "Banani", "Baridhara", "Dhanmondi", "Uttara", "Mirpur", "Mohammadpur", "Motijheel", "Tejgaon", "Wari", "Bashundhara"].includes(legacyArea);
        return {
            division: user.division || "Dhaka",
            district: user.district || (inDhakaCity ? "Dhaka" : "Dhaka"),
            area: legacyArea,
            addressLine: user.addressLine || user.address || "",
            landmark: user.landmark || ""
        };
    }
    return {
        division: user.division || defaults.division,
        district: user.district || defaults.district,
        area: user.area || defaults.area,
        addressLine: user.addressLine || user.address || "",
        landmark: user.landmark || ""
    };
}

export function readLocationFields(prefix) {
    return {
        division: document.getElementById(`${prefix}-division`)?.value || "",
        district: document.getElementById(`${prefix}-district`)?.value || "",
        area: document.getElementById(`${prefix}-area`)?.value || "",
        addressLine: document.getElementById(`${prefix}-address-line`)?.value.trim() || "",
        landmark: document.getElementById(`${prefix}-landmark`)?.value.trim() || ""
    };
}

function label(key, en, bn) {
    const labels = { division: ["Division", "বিভাগ"], district: ["District", "জেলা"], area: ["Area / Zone", "এলাকা / জোন"], addressLine: ["House / Road / Block", "বাড়ি / রোড / ব্লক"], landmark: ["Landmark (optional)", "ল্যান্ডমার্ক (ঐচ্ছিক)"] };
    const pair = labels[key] || [en, bn];
    return getLang() === "bn" ? pair[1] : pair[0];
}

export function renderLocationFieldsHtml(prefix, values = {}) {
    const v = { ...getDefaultLocation(), ...locationFromLegacy(values) };
    const lang = getLang();
    const divisionOptions = BANGLADESH_LOCATIONS.map((d) => {
        const name = lang === "bn" ? d.nameBn : d.name;
        return `<option value="${d.name}" ${d.name === v.division ? "selected" : ""}>${name}</option>`;
    }).join("");

    return `
        <div class="location-grid">
            <div class="form-group">
                <label for="${prefix}-division">${label("division")}</label>
                <select id="${prefix}-division" class="form-control" required>${divisionOptions}</select>
            </div>
            <div class="form-group">
                <label for="${prefix}-district">${label("district")}</label>
                <select id="${prefix}-district" class="form-control" required></select>
            </div>
            <div class="form-group">
                <label for="${prefix}-area">${label("area")}</label>
                <select id="${prefix}-area" class="form-control" required></select>
            </div>
            <div class="form-group form-group-full">
                <label for="${prefix}-address-line">${label("addressLine")}</label>
                <input type="text" id="${prefix}-address-line" class="form-control" value="${v.addressLine.replace(/"/g, "&quot;")}" placeholder="House, road, block..." required>
            </div>
            <div class="form-group form-group-full">
                <label for="${prefix}-landmark">${label("landmark")}</label>
                <input type="text" id="${prefix}-landmark" class="form-control" value="${v.landmark.replace(/"/g, "&quot;")}" placeholder="Near mosque, school, shop...">
            </div>
        </div>
    `;
}

export function bindLocationFields(prefix, values = {}) {
    const v = { ...getDefaultLocation(), ...locationFromLegacy(values) };
    const divisionEl = document.getElementById(`${prefix}-division`);
    const districtEl = document.getElementById(`${prefix}-district`);
    const areaEl = document.getElementById(`${prefix}-area`);
    if (!divisionEl || !districtEl || !areaEl) return;

    const fillDistricts = () => {
        const districts = getDistrictsForDivision(divisionEl.value);
        districtEl.innerHTML = districts.map((name) =>
            `<option value="${name}" ${name === v.district ? "selected" : ""}>${name}</option>`
        ).join("");
        if (!districts.includes(districtEl.value)) {
            districtEl.value = districts[0] || "";
        }
        fillAreas();
    };

    const fillAreas = () => {
        const areas = getAreasForDistrict(divisionEl.value, districtEl.value);
        const current = areaEl.value || v.area;
        areaEl.innerHTML = areas.map((name) =>
            `<option value="${name}" ${name === current ? "selected" : ""}>${name}</option>`
        ).join("");
        if (!areas.includes(areaEl.value)) {
            areaEl.value = areas[0] || "";
        }
    };

    divisionEl.addEventListener("change", fillDistricts);
    districtEl.addEventListener("change", fillAreas);
    fillDistricts();
    if (v.district && getDistrictsForDivision(v.division).includes(v.district)) {
        districtEl.value = v.district;
    }
    fillAreas();
    if (v.area && getAreasForDistrict(divisionEl.value, districtEl.value).includes(v.area)) {
        areaEl.value = v.area;
    }
}

export function getAgeGroup(birthdate) {
    if (!birthdate) return "";
    const born = new Date(birthdate);
    if (Number.isNaN(born.getTime())) return "";
    const age = Math.floor((Date.now() - born.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) return "Under 18";
    if (age < 25) return "18-24";
    if (age < 35) return "25-34";
    if (age < 45) return "35-44";
    if (age < 55) return "45-54";
    return "55+";
}
