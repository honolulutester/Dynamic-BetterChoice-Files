/** Bangladesh administrative divisions → districts (areas vary by district). */

const DHAKA_CITY_AREAS = [
    "Gulshan", "Banani", "Baridhara", "Dhanmondi", "Uttara", "Mirpur",
    "Mohammadpur", "Motijheel", "Tejgaon", "Wari", "Bashundhara", "Other"
];

const DEFAULT_AREAS = ["Sadar / Headquarters", "Other"];

export const BANGLADESH_LOCATIONS = [
    {
        name: "Barishal",
        nameBn: "বরিশাল",
        districts: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"]
    },
    {
        name: "Chattogram",
        nameBn: "চট্টগ্রাম",
        districts: ["Bandarban", "Brahmanbaria", "Chandpur", "Chattogram", "Cumilla", "Cox's Bazar", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati"]
    },
    {
        name: "Dhaka",
        nameBn: "ঢাকা",
        districts: ["Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur", "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari", "Shariatpur", "Tangail"]
    },
    {
        name: "Khulna",
        nameBn: "খুলনা",
        districts: ["Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"]
    },
    {
        name: "Rajshahi",
        nameBn: "রাজশাহী",
        districts: ["Bogura", "Joypurhat", "Naogaon", "Natore", "Chapainawabganj", "Pabna", "Rajshahi", "Sirajganj"]
    },
    {
        name: "Rangpur",
        nameBn: "রংপুর",
        districts: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"]
    },
    {
        name: "Mymensingh",
        nameBn: "ময়মনসিংহ",
        districts: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"]
    },
    {
        name: "Sylhet",
        nameBn: "সিলেট",
        districts: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"]
    }
];

export function getDivisionNames(lang = "en") {
    return BANGLADESH_LOCATIONS.map((d) => (lang === "bn" ? d.nameBn : d.name));
}

export function getDistrictsForDivision(divisionName) {
    const division = BANGLADESH_LOCATIONS.find((d) => d.name === divisionName);
    return division ? [...division.districts] : [];
}

export function getAreasForDistrict(divisionName, districtName) {
    if (divisionName === "Dhaka" && districtName === "Dhaka") {
        return [...DHAKA_CITY_AREAS];
    }
    if (divisionName === "Dhaka" && districtName === "Narayanganj") {
        return ["Sadar", "Siddhirganj", "Kadambari", "Other"];
    }
    if (divisionName === "Dhaka" && districtName === "Gazipur") {
        return ["Sadar", "Tongi", "Konabari", "Other"];
    }
    return [...DEFAULT_AREAS];
}

export function getDefaultLocation() {
    return {
        division: "Dhaka",
        district: "Dhaka",
        area: "Gulshan",
        addressLine: "",
        landmark: ""
    };
}
