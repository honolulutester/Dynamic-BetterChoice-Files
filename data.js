// --- Google Sheets Catalog Source ---
export const DEFAULT_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/1i0jfpBrPlWpVTXEX6BMFdKgbx-pYiODVwRa0P_aLM-k/edit?gid=835001213";

const CATEGORY_ALIASES = {
    "premium proteins": "Premium Pasture & Sustainable Proteins",
    "premium pasture & sustainable proteins": "Premium Pasture & Sustainable Proteins",
    "nutritional supplements": "Pure Micro-Nutritional Supplements",
    "pure micro-nutritional supplements": "Pure Micro-Nutritional Supplements",
    "conscious foods": "Conscious Foods & Native Grains",
    "conscious foods & native grains": "Conscious Foods & Native Grains",
    "functional beverages": "Sustainable Functional Beverages",
    "sustainable functional beverages": "Sustainable Functional Beverages",
    "culinary hardware & wood artifacts": "Culinary Hardware & Wood Artifacts",
    "culinary hardware": "Culinary Hardware & Wood Artifacts",
    "glass & home organization": "Premium Glass & Home Organization",
    "premium glass & home organization": "Premium Glass & Home Organization"
};

export function normalizeCategory(value) {
    if (!value) return value;
    const lowerVal = value.toLowerCase().trim();
    if (CATEGORY_ALIASES[lowerVal]) return CATEGORY_ALIASES[lowerVal];

    if (lowerVal.includes("protein") && !lowerVal.includes("supplement")) {
        return "Premium Pasture & Sustainable Proteins";
    }
    if (lowerVal.includes("supplement")) return "Pure Micro-Nutritional Supplements";
    if (lowerVal.includes("grain") || lowerVal.includes("food") || lowerVal.includes("conscious")) {
        return "Conscious Foods & Native Grains";
    }
    if (lowerVal.includes("beverage") || lowerVal.includes("drink") || lowerVal.includes("functional")) {
        return "Sustainable Functional Beverages";
    }
    if (lowerVal.includes("hardware") || lowerVal.includes("wood")) {
        return "Culinary Hardware & Wood Artifacts";
    }
    if (lowerVal.includes("glass") || lowerVal.includes("organization")) {
        return "Premium Glass & Home Organization";
    }
    return value;
}

export function extractImageUrl(value) {
    const all = extractAllImageUrls(value);
    return all[0] || "";
}

export function extractAllImageUrls(value) {
    if (!value) return [];
    const trimmed = value.trim();
    const urls = trimmed.match(/https?:\/\/[^\s")\],]+/gi) || [];
    if (urls.length) return [...new Set(urls)];
    if (/^https?:\/\//i.test(trimmed)) return [trimmed];
    return [];
}

function buildCsvExportUrl(url) {
    if (!url.includes("docs.google.com/spreadsheets")) return url;

    const sheetIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) return url;

    const sheetId = sheetIdMatch[1];
    const gidMatch = url.match(/[?&#]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

// --- High-Level Catalog Database ---
export const DEFAULT_PRODUCTS = [
    // Category I: Premium Pasture & Sustainable Proteins
    {
        id: "p1",
        name: "Grass-Fed Indigenous Beef (Beshit)",
        category: "Premium Pasture & Sustainable Proteins",
        subcategory: "Grass-Fed & Free-Roaming Red Meats",
        price: 950,
        salePrice: 890, // On Sale
        inventory: 15,
        organic: true,
        bpafree: true,
        packaging: "Banana Fiber Wrap & Reusable Jute Tote",
        origin: "Char-Fasson Pastures, Bhola",
        labCert: "BSTI-ORG-8092-A",
        calories: 250,
        carbs: 0,
        protein: 26,
        fat: 16,
        servingSize: "100g",
        productionDate: "2026-06-18",
        expiryDate: "2026-06-25",
        description: "Premium beef from free-roaming indigenous cattle raised on natural saline-grass pastures. Hormone-free and antibiotic-free."
    },
    {
        id: "p2",
        name: "Antibiotic-Free Native Deshi Poultry",
        category: "Premium Pasture & Sustainable Proteins",
        subcategory: "Antibiotic-Free Native Poultry",
        price: 680,
        salePrice: 0,
        inventory: 20,
        organic: true,
        bpafree: true,
        packaging: "Seed-Infused Paper Wrap & Jute Tote",
        origin: "Greenhouse Farms, Joypurhat",
        labCert: "LAB-CLEARED-4091",
        calories: 165,
        carbs: 0,
        protein: 31,
        fat: 3.6,
        servingSize: "100g",
        productionDate: "2026-06-18",
        expiryDate: "2026-06-23",
        description: "Deshi breed chickens allowed to forage naturally. Fully certified free from residual antibiotics, pesticides, and growth hormones."
    },
    {
        id: "p3",
        name: "Wild-Caught Delta Hilsha (Premium Size)",
        category: "Premium Pasture & Sustainable Proteins",
        subcategory: "Wild-Caught & Formalin-Free Delta & Marine Seafood",
        price: 1800,
        salePrice: 0,
        inventory: 8,
        organic: true,
        bpafree: true,
        packaging: "Waxed Banana Leaves in Clay Pot",
        origin: "Padma River Estuary, Chandpur",
        labCert: "SGS-FM-1102-QA",
        calories: 310,
        carbs: 0,
        protein: 22,
        fat: 24,
        servingSize: "100g",
        productionDate: "2026-06-19",
        expiryDate: "2026-06-22",
        description: "Prized Padma Hilsha, harvested by artisanal fishermen. Tested formalin-free. Rich in heart-healthy Omega-3 fatty acids."
    },
    {
        id: "p4",
        name: "Pasture-Raised Organic Eggs (1 Dozen)",
        category: "Premium Pasture & Sustainable Proteins",
        subcategory: "Pasture-Raised Farm Dairy & Eggs",
        price: 240,
        salePrice: 220, // On Sale
        inventory: 0, // Out of Stock
        organic: true,
        bpafree: true,
        packaging: "Recycled Pulp Egg Carton (Zero-Plastic)",
        origin: "Niribili Organic Poultry Farm, Gazipur",
        labCert: "BSTI-EGG-2029",
        calories: 140,
        carbs: 1,
        protein: 12,
        fat: 10,
        servingSize: "2 Eggs (100g)",
        productionDate: "2026-06-17",
        expiryDate: "2026-07-15",
        description: "Dark orange yolks loaded with nutrients. Hens roam outdoor pastures freely and feed on organic grains, seeds, and insects."
    },

    // Category II: Pure Micro-Nutritional Supplements
    {
        id: "p5",
        name: "Grass-Fed Bio-Active Whey Isolate",
        category: "Pure Micro-Nutritional Supplements",
        subcategory: "Clean Protein Isolates & Powders",
        price: 3800,
        salePrice: 0,
        inventory: 5,
        organic: true,
        bpafree: true,
        packaging: "Heavy UV-Blocking Amber Glass Jar",
        origin: "Organic Dairy Partner Farms, Nilphamari",
        labCert: "BSTI-SUP-1120-P",
        calories: 110,
        carbs: 1,
        protein: 25,
        fat: 0,
        servingSize: "30g scoop",
        productionDate: "2026-04-10",
        expiryDate: "2027-10-10",
        description: "Ultra-pure, unflavored whey protein isolate. Soy-free, gluten-free, with zero chemical sweeteners or fillers."
    },
    {
        id: "p6",
        name: "Organic Moringa Leaf Extract (Botanical Adaptogen)",
        category: "Pure Micro-Nutritional Supplements",
        subcategory: "Organic Local Botanical Extracts & Herbal Adaptogens",
        price: 450,
        salePrice: 390, // On Sale
        inventory: 30,
        organic: true,
        bpafree: true,
        packaging: "Amber Glass Dropper Bottle",
        origin: "Moringa Orchards, Panchagarh",
        labCert: "LAB-BIO-7729",
        calories: 5,
        carbs: 1,
        protein: 0,
        fat: 0,
        servingSize: "1 ml",
        productionDate: "2026-05-15",
        expiryDate: "2027-05-15",
        description: "Concentrated bioactive extract of native Moringa Oleifera. Powerful anti-inflammatory and cellular energizer."
    },
    {
        id: "p7",
        name: "Pure Cold-Pressed Black Seed Oil (Kalonji)",
        category: "Pure Micro-Nutritional Supplements",
        subcategory: "Pure Cold-Pressed Wellness Oils",
        price: 850,
        salePrice: 0,
        inventory: 18,
        organic: true,
        bpafree: true,
        packaging: "UV-Shield Amber Glass Bottle",
        origin: "Kalonji Fields, Natore",
        labCert: "BSTI-OIL-5521",
        calories: 120,
        carbs: 0,
        protein: 0,
        fat: 14,
        servingSize: "1 Tablespoon (14g)",
        productionDate: "2026-06-01",
        expiryDate: "2027-12-01",
        description: "First-press oil from organic Nigella Sativa seeds. Traditional remedy for immune modulation, metabolic support, and vitality."
    },
    {
        id: "p8",
        name: "Molecularly Distilled Algae Omega-3",
        category: "Pure Micro-Nutritional Supplements",
        subcategory: "Molecularly Distilled & Vitamin Essentials",
        price: 2600,
        salePrice: 0,
        inventory: 12,
        organic: true,
        bpafree: true,
        packaging: "Heavy Amber Glass Apothecary Bottle",
        origin: "Marine Cultivation Hub, Cox's Bazar",
        labCert: "LAB-CERT-9908",
        calories: 15,
        carbs: 0,
        protein: 0,
        fat: 1.5,
        servingSize: "1 softgel",
        productionDate: "2026-05-01",
        expiryDate: "2027-11-01",
        description: "Sustainable vegan alternative to fish oil. Grown in controlled bio-reactors, molecularly distilled for maximum purity."
    },

    // Category III: Conscious Foods & Native Grains
    {
        id: "p9",
        name: "Low-Glycemic Heirloom Kalijira Rice",
        category: "Conscious Foods & Native Grains",
        subcategory: "Heirloom & Low-Glycemic Heritage Rice",
        price: 240,
        salePrice: 0,
        inventory: 50,
        organic: true,
        bpafree: true,
        packaging: "Unbleached Banana-Fiber Bag",
        origin: "Floodplain Farms, Netrokona",
        labCert: "BSTI-GRN-3011",
        calories: 150,
        carbs: 32,
        protein: 4,
        fat: 0.5,
        servingSize: "45g dry",
        productionDate: "2026-05-20",
        expiryDate: "2027-05-20",
        description: "Tiny, highly aromatic deshi heirloom grain. Rich in minerals and low glycemic index, making it diabetic-friendly."
    },
    {
        id: "p10",
        name: "Organic Red Lentils (Deshi Masur Dal)",
        category: "Conscious Foods & Native Grains",
        subcategory: "Organic Pulses, Flour, & Ancient Grains",
        price: 180,
        salePrice: 160, // On Sale
        inventory: 40,
        organic: true,
        bpafree: true,
        packaging: "Banana-Fiber Pouch",
        origin: "Lentil Co-op, Kushtia",
        labCert: "LAB-FOOD-8891",
        calories: 115,
        carbs: 20,
        protein: 9,
        fat: 0.4,
        servingSize: "100g cooked",
        productionDate: "2026-06-05",
        expiryDate: "2027-06-05",
        description: "Deshi small-grain red lentils, highly nutritious and easy to digest. Unpolished and pesticide-free."
    },
    {
        id: "p11",
        name: "Wooden-Ghani Cold-Pressed Mustard Oil",
        category: "Conscious Foods & Native Grains",
        subcategory: "Wooden-Ghani Cold-Pressed Oils",
        price: 490,
        salePrice: 0,
        inventory: 25,
        organic: true,
        bpafree: true,
        packaging: "Thick Amber Glass Bottle",
        origin: "Oil Mills of Tangail",
        labCert: "BSTI-OIL-2290",
        calories: 120,
        carbs: 0,
        protein: 0,
        fat: 14,
        servingSize: "1 Tablespoon (14g)",
        productionDate: "2026-06-10",
        expiryDate: "2027-06-10",
        description: "Pressed slowly in traditional Jackwood Ghani at temperatures below 40°C. Retention of all natural antioxidants and fiery flavor."
    },
    {
        id: "p12",
        name: "Raw Sundarbans Multifloral Honey",
        category: "Conscious Foods & Native Grains",
        subcategory: "Raw Micro-Batch Sweeteners & Superfood Seeds",
        price: 980,
        salePrice: 0,
        inventory: 15,
        organic: true,
        bpafree: true,
        packaging: "Heavy Mason Glass Jar with Wooden Lid",
        origin: "Sundarbans Delta Mangrove Forest",
        labCert: "BSTI-HON-4001",
        calories: 64,
        carbs: 17,
        protein: 0,
        fat: 0,
        servingSize: "1 Tablespoon (21g)",
        productionDate: "2026-05-02",
        expiryDate: "2028-05-02",
        description: "Harvested ethically by Mawalis from wild hives deep in the mangrove. Unpasteurized and unfiltered, containing active enzymes."
    },

    // Category IV: Sustainable Functional Beverages
    {
        id: "p13",
        name: "Single-Origin Bandarban Nitro Cold Brew",
        category: "Sustainable Functional Beverages",
        subcategory: "Single-Origin Nitro & Cold Brew Coffees",
        price: 280,
        salePrice: 0,
        inventory: 14,
        organic: true,
        bpafree: true,
        packaging: "Heavy Glass Stout Bottle with Metal Crown Cap",
        origin: "Sajek Valley Coffee Estate, Chittagong Hill Tracts",
        labCert: "LAB-BEV-5501",
        calories: 5,
        carbs: 1,
        protein: 0,
        fat: 0,
        servingSize: "250ml",
        productionDate: "2026-06-18",
        expiryDate: "2026-07-02",
        description: "Slow-brewed for 16 hours using mountain aquifer water. Low acidity, rich notes of chocolate and local spices."
    },
    {
        id: "p14",
        name: "Bio-Active Ginger & Lemongrass Kombucha",
        category: "Sustainable Functional Beverages",
        subcategory: "Bio-Active Living Teas & Fermented Kombuchas",
        price: 320,
        salePrice: 0,
        inventory: 16,
        organic: true,
        bpafree: true,
        packaging: "Amber Swing-Top Glass Bottle",
        origin: "Kombucha Fermentary, Sylhet",
        labCert: "LAB-BEV-9932",
        calories: 35,
        carbs: 8,
        protein: 0,
        fat: 0,
        servingSize: "330ml",
        productionDate: "2026-06-12",
        expiryDate: "2026-09-12",
        description: "Living probiotic beverage brewed with organic Sylhet black tea, fresh hill ginger, and raw cane sugar."
    },
    {
        id: "p15",
        name: "Natural Green Coconut Water (Elixir)",
        category: "Sustainable Functional Beverages",
        subcategory: "Natural Electrolyte Enhancers & Elixirs",
        price: 150,
        salePrice: 0,
        inventory: 22,
        organic: true,
        bpafree: true,
        packaging: "Amber Glass Bottle with Ring Pull",
        origin: "Coconut Groves of Bagerhat",
        labCert: "BSTI-BEV-1022",
        calories: 45,
        carbs: 11,
        protein: 0.5,
        fat: 0,
        servingSize: "300ml",
        productionDate: "2026-06-19",
        expiryDate: "2026-06-24",
        description: "100% pure deshi daab water. Bottled sterile within hours of harvesting. Packed with natural potassium and hydration minerals."
    },
    {
        id: "p16",
        name: "Aquifer Raw Mineral Water",
        category: "Sustainable Functional Beverages",
        subcategory: "Aquifer Mineral Waters & Unpasteurized Plant Milks",
        price: 90,
        salePrice: 75, // On Sale
        inventory: 45,
        organic: true,
        bpafree: true,
        packaging: "Heavy Reusable Swing-Top Glass Bottle",
        origin: "Protected Deep Aquifer, Srimangal",
        labCert: "BSTI-H2O-9005",
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        servingSize: "500ml",
        productionDate: "2026-06-15",
        expiryDate: "2026-12-15",
        description: "Naturally filtered aquifer mineral water with optimal alkalinity. Pure taste, zero synthetic filtration chemicals."
    },

    // Category V: Culinary Hardware & Wood Artifacts
    {
        id: "p17",
        name: "Jackwood End-Grain Prep Block",
        category: "Culinary Hardware & Wood Artifacts",
        subcategory: "Solid End-Grain Wooden Prep Blocks & Spoons",
        price: 2400,
        salePrice: 0,
        inventory: 4,
        organic: true,
        bpafree: true,
        packaging: "Banana Fiber Wrap & Jute Tote",
        origin: "Artisan Woodworks, Jessore",
        labCert: "CERT-WOOD-5011",
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        servingSize: "1 Unit",
        productionDate: "2026-05-10",
        expiryDate: "N/A",
        description: "Solid, dense Jackwood block cured in organic coconut oil. Naturally antibacterial, kind to high-carbon blades."
    },
    {
        id: "p18",
        name: "Hand-Forged High-Carbon Steel Boti-Knife",
        category: "Culinary Hardware & Wood Artifacts",
        subcategory: "Hand-Forged High-Carbon Steel Knives",
        price: 3200,
        salePrice: 0,
        inventory: 5,
        organic: true,
        bpafree: true,
        packaging: "Wooden Scabbard & Jute Tote",
        origin: "Blacksmith Guild, Kamrangirchar",
        labCert: "CERT-METAL-8022",
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        servingSize: "1 Unit",
        productionDate: "2026-04-20",
        expiryDate: "N/A",
        description: "Traditional kitchen cutting implement hand-forged from recycled industrial carbon-steel. Mounted on jackwood base."
    },
    {
        id: "p19",
        name: "Pre-Seasoned Cast Iron Skillet (10-inch)",
        category: "Culinary Hardware & Wood Artifacts",
        subcategory: "Pre-Seasoned Cast Iron & Tri-Ply Stainless Steel Cookware",
        price: 2900,
        salePrice: 2600, // On Sale
        inventory: 6,
        organic: true,
        bpafree: true,
        packaging: "Unbleached Recycled Cardboard Box",
        origin: "Eco-Casting Foundry, Bogura",
        labCert: "CERT-IRON-3012",
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        servingSize: "1 Unit",
        productionDate: "2026-05-01",
        expiryDate: "N/A",
        description: "Heavy cast-iron skillet seasoned 3 times with organic mustard oil. Excellent heat retention and naturally non-stick."
    },
    {
        id: "p20",
        name: "Natural Volcanic Stone Shil-Pata",
        category: "Culinary Hardware & Wood Artifacts",
        subcategory: "Natural Volcanic Stone & Bamboo Culinary Tools",
        price: 1500,
        salePrice: 0,
        inventory: 3,
        organic: true,
        bpafree: true,
        packaging: "Sturdy Jackwood Shipping crate",
        origin: "Quarry Craftsmen, Sylhet",
        labCert: "CERT-STONE-1102",
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        servingSize: "1 Unit",
        productionDate: "2026-03-15",
        expiryDate: "N/A",
        description: "Traditional stone grinder for spices. Carved from a single piece of heavy volcanic river-stone. Lasts generations."
    },

    // Category VI: Premium Glass & Home Organization
    {
        id: "p21",
        name: "Borosilicate Thermal Meal Prep Containers (Set of 3)",
        category: "Premium Glass & Home Organization",
        subcategory: "Borosilicate Glass High-Thermal Meal Prep Containers",
        price: 1950,
        salePrice: 0,
        inventory: 10,
        organic: true,
        bpafree: true,
        packaging: "Recycled Paper Box",
        origin: "Glassworks Ltd, Narayanganj",
        labCert: "CERT-GLASS-6601",
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        servingSize: "3 Containers",
        productionDate: "2026-06-01",
        expiryDate: "N/A",
        description: "Highly heat-resistant borosilicate glass containers. Oven, microwave, and dishwasher safe. Wooden airtight lids."
    },
    {
        id: "p22",
        name: "Stackable Glass Pantry Jars with Bamboo Lids (Set of 4)",
        category: "Premium Glass & Home Organization",
        subcategory: "Stackable Modular Glass Pantry Jars with Natural Wood Lids",
        price: 1650,
        salePrice: 1450, // On Sale
        inventory: 12,
        organic: true,
        bpafree: true,
        packaging: "Recycled Paper Dividers",
        origin: "Glassworks Ltd, Narayanganj",
        labCert: "CERT-GLASS-6602",
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        servingSize: "4 Jars",
        productionDate: "2026-06-01",
        expiryDate: "N/A",
        description: "Modular, space-saving storage solution. High clarity glass with sustainable bamboo suction seals."
    },
    {
        id: "p23",
        name: "Marine-Grade Stainless Steel Lunch Box (2-Tier)",
        category: "Premium Glass & Home Organization",
        subcategory: "Marine-Grade Stainless Steel Lunch Boxes & Tiffins",
        price: 1800,
        salePrice: 0,
        inventory: 7,
        organic: true,
        bpafree: true,
        packaging: "Unbleached Cotton Drawstring Bag",
        origin: "Steel Fabricators, Chittagong",
        labCert: "CERT-STEEL-9921",
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        servingSize: "1 Unit",
        productionDate: "2026-05-20",
        expiryDate: "N/A",
        description: "Double-layered 304 food-grade stainless steel lunch carrier. Leakproof latch system, completely plastic-free."
    },
    {
        id: "p24",
        name: "Woven Jute Canvas Storage Basket Set",
        category: "Premium Glass & Home Organization",
        subcategory: "Sustainable Woven Fiber & Metal Wire Storage Bins",
        price: 1200,
        salePrice: 0,
        inventory: 15,
        organic: true,
        bpafree: true,
        packaging: "Paper Tag & Hemp Rope Ties",
        origin: "Weavers Collective, Faridpur",
        labCert: "CERT-JUTE-1229",
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        servingSize: "2 Baskets",
        productionDate: "2026-06-10",
        expiryDate: "N/A",
        description: "Handwoven heavy-duty storage baskets made from golden grade jute fiber. Eco-friendly home organization."
    }
];

// --- Editorial Hub Articles ---
export const ARTICLES = [
    {
        id: "a1",
        title: "Combating Plastic Pollution in the Bengal Delta",
        tag: "Conservation",
        excerpt: "An in-depth look at how packaging choices affect the delicate ecosystem of the Sundarbans and the Bay of Bengal, and the shift towards biodegradable fibers.",
        author: "Dr. Farhana Yasmin, Environmentalist",
        date: "June 15, 2026",
        content: `The Bengal Delta, the largest delta in the world, is choked by a silent crisis: non-biodegradable plastics. Every single-use packaging bag, water bottle, and synthetic wrapping material discarded in urban centers like Dhaka eventually makes its way into our river systems, terminating in the delicate mangroves of the Sundarbans and the marine habitats of the Bay of Bengal.

Our ancestors relied on natural banana leaves, earthen clay pots, and golden jute canvas to transport and store food. These organic substrates degraded seamlessly back into the delta's soil, feeding rather than poisoning the environment. 

By replacing synthetic polymers with local biodegradable materials like unbleached seed-infused paper, jackwood containers, and woven jute bags, we can eliminate plastic from the supply chain. This shift not only protects the delta's biodiversity but also supports local rural artisans and farmers, closing the loop in a circular economy.`
    },
    {
        id: "a2",
        title: "Traditional Bengali Cooking in Pre-Seasoned Cast Iron",
        tag: "Culinary Art",
        excerpt: "Reclaiming the health benefits and deep flavors of cooking traditional deshi dishes in cast iron pans rather than Teflon-coated cookware.",
        author: "Chef Tariqul Islam",
        date: "June 10, 2026",
        content: `For decades, modern kitchens in Bangladesh have adopted Teflon and chemical-coated non-stick cookware, unaware of the endocrine-disrupting chemicals (like BPA, PFOA) that leach into food under high heat. 

Reclaiming the traditional cast-iron 'karahi' or skillet is a return to clean, healthy eating. Cast iron distributes heat evenly, sealing in natural juices and caramelizing organic proteins like grass-fed deshi beef or wild river Hilsha to perfection.

Furthermore, cooking acidic gravies (like tomatoes or lemon-infused fish curries) in cast iron naturally fortifies the food with bioavailable dietary iron, combating anemia. By seasoning iron with organic ghani mustard oil, you build a natural, non-toxic, glassy non-stick layer that makes chemical coatings obsolete.`
    },
    {
        id: "a3",
        title: "Progressive Overload Tactics for the Monsoon Season",
        tag: "Fitness & Wellness",
        excerpt: "How to maintain your hypertrophic splits and progressive strength gains at home when heavy rainfall disrupts outdoor activity and commute.",
        author: "Sabir Rahman, Certified Pro-Trainer",
        date: "June 05, 2026",
        content: `The heavy monsoon downpours in cities like Dhaka and Chittagong often disrupt gym routines. Gridlocked traffic and flooded streets make commuting to fitness centers a chore. 

However, progress doesn't need to stall. You can maintain hypertrophy and strength splits by adjusting your training variables. Leverage high-intensity callisthenics splits, tempo control, and progressive mechanical disadvantages. 

By slowing down the eccentric phase of a squat, performing handstand pushup splits, or using heavy Jackwood block lifting routines, you can stimulate muscular growth and trigger metabolic adaptations. Combine this with single-click balanced shopping carts containing high-density proteins and bio-active micro-nutrients to keep your recovery optimal.`
    }
];

// --- Professional Human Experts ---
export const EXPERTS = [
    {
        id: "ex1",
        name: "Nafisa Kamal, RD",
        tag: "Certified Dietician & Macro Planner",
        bio: "Specializing in local organic diets, sports nutrition, and clean eating. Focused on omnivore meal architectural design using high-nutrient Bangladeshi delta proteins.",
        price: 1500,
        photo: "NK",
        slots: ["Mon 3:00 PM", "Mon 5:00 PM", "Wed 10:00 AM", "Wed 4:00 PM"]
    },
    {
        id: "ex2",
        name: "Zeeshan Al-Meezan, CSCS",
        tag: "Elite Pro-Trainer & Bio-Mechanic",
        bio: "Expert in progressive overload splits, functional mobility, and indoor adaptations. Creator of monsoon home-workout routines for busy Dhaka professionals.",
        price: 1800,
        photo: "ZM",
        slots: ["Tue 11:00 AM", "Tue 2:00 PM", "Thu 4:00 PM", "Thu 6:00 PM"]
    }
];

// --- Company Profile (About Us) ---
export const COMPANY_PROFILE = {
    tagline: "Make the better, healthier choice",
    mission: "BetterChoice exists to make premium, verifiable nutrition accessible to urban Bangladesh — without a single gram of synthetic plastic in the supply chain.",
    vision: "To become Bengal's most trusted closed-loop wellness marketplace, where every product is traceable, every package is returnable, and every customer relationship is personal.",
    story: `Founded in Dhaka in 2024, BetterChoice began as a frustration with opaque sourcing and plastic-saturated grocery delivery. A small team of nutritionists, supply-chain engineers, and conservation advocates set out to prove that luxury and sustainability are not opposites.

Today we partner with 40+ certified organic farms, fisheries, and artisan workshops across Bangladesh — from Char-Fasson pastures to Sundarbans honey cooperatives. Every SKU in our catalog carries farm-of-origin data, lab clearance IDs, and full macro transparency.

We serve health-conscious professionals across Gulshan, Banani, and Dhanmondi with zero-plastic logistics, and we are expanding across Greater Dhaka with the same material standards that earned us BSTI accreditation and Bengal Conservation guidelines alignment.`,
    stats: [
        { value: "60+", label: "Curated Organic SKUs" },
        { value: "100%", label: "Zero-Plastic Packaging" },
        { value: "40+", label: "Certified Farm Partners" },
        { value: "৳25", label: "Eco-Credit per Return Unit" }
    ],
    values: [
        { title: "Radical Transparency", desc: "QR traceability on every product. You see the farm, the lab cert, and the macros before you buy." },
        { title: "Closed-Loop Materials", desc: "Amber glass, jute, banana fiber, and steel — designed to return, not landfill." },
        { title: "Local First", desc: "Delta proteins, heritage grains, and hill-tract botanicals sourced within Bangladesh wherever possible." },
        { title: "Human Wellness", desc: "Beyond commerce — workout planning, meal architecture, and certified expert consultations built in." }
    ],
    leadership: [
        { name: "Dr. Farhana Yasmin", role: "Co-Founder & Head of Conservation", bio: "Environmental scientist and Sundarbans policy advisor. Leads our zero-plastic packaging mandate." },
        { name: "Arif Mahmud", role: "Co-Founder & CEO", bio: "Former supply-chain director. Built our farm-to-door cold chain across the Bengal delta." },
        { name: "Nafisa Kamal, RD", role: "Chief Nutrition Officer", bio: "Registered dietician overseeing macro transparency and the Meal Architect engine." }
    ],
    contact: {
        email: "hello@betterchoice.bd",
        phone: "01778522749",
        hq: "Gulshan Avenue, Dhaka 1212, Bangladesh"
    }
};

// --- Customer Policies ---
export const CUSTOMER_POLICIES = [
    {
        id: "shipping",
        title: "Shipping & Delivery",
        content: `BetterChoice delivers exclusively within Greater Dhaka. Priority zones include Gulshan, Banani, and Dhanmondi with same-day and next-day slots available.

**Delivery slots:** Morning (8 AM–12 PM), Afternoon (12–4 PM), Evening (4–8 PM), and Night (8 PM–12 AM).

**Packaging:** All orders ship in handwoven jute-canvas totes with amber glass and compostable inner wraps. No synthetic plastic is used at any stage.

**Fees:** Free delivery on orders over ৳1,500 for Eco-Guardian tier members (200+ lifetime credits). Standard delivery fee of ৳80 applies otherwise.

You must provide a complete delivery address and valid 11-digit mobile number at checkout. Our courier will call 30 minutes before arrival.`
    },
    {
        id: "returns",
        title: "Returns & Refunds",
        content: `**Perishable goods** (fresh proteins, dairy, beverages with under 7-day shelf life): Returns accepted only if items arrive damaged, warm-chain broken, or materially not as described. Photo evidence required within 2 hours of delivery.

**Non-perishable goods** (supplements, grains, hardware, glassware): Unopened items may be returned within 7 days for store credit or exchange.

**Refunds:** bKash payments refunded within 3–5 business days. Cash on Delivery refunds issued as Eco-Wallet store credit.

To initiate a return, contact Live Chat or email hello@betterchoice.bd with your order ID.`
    },
    {
        id: "eco-credits",
        title: "Eco-Credits & Packaging Returns",
        content: `Our closed-loop program rewards verified returns of amber glass jars, swing-top bottles, and metal tiffins.

**Rate:** ৳25 Eco-Credits per inspected unit.

**How it works:**
1. Rinse containers and place them in your reusable return bag.
2. Hand them to our courier on your next delivery.
3. Our hub inspects and sanitizes each unit within 24–48 hours.
4. Credits are manually issued to your wallet by our team — not self-claimed at checkout.

**Redemption:** 1 Eco-Credit = ৳1.00, applied automatically at checkout from your wallet balance.

Fraudulent return claims are grounds for account suspension.`
    },
    {
        id: "payment",
        title: "Payment Methods",
        content: `We accept:

**bKash:** Secure mobile wallet payment via our merchant gateway (01778522749). Complete the OTP and PIN verification flow at checkout.

**Cash on Delivery (COD):** Pay the courier in cash upon receipt. Wallet discounts still apply before the COD total is calculated.

We do not store bKash PINs or payment credentials. All transactions are processed through official channels.`
    },
    {
        id: "accounts",
        title: "Accounts & Data",
        content: `Creating a BetterChoice account lets you track orders, manage your delivery profile, redeem Eco-Credits, and receive exclusive newsletter offers.

We store your name, email, phone, delivery address, order history, and wallet balance to operate the service. We do not sell personal data to third parties.

You may request account deletion by emailing hello@betterchoice.bd. Deletion removes your profile but retains anonymized order records for regulatory compliance.`
    },
    {
        id: "privacy",
        title: "Privacy Policy",
        content: `BetterChoice collects information you provide at registration, checkout, and newsletter signup. This includes contact details, delivery addresses, and communication preferences.

**How we use data:** Order fulfilment, delivery coordination, Eco-Credit management, customer support, and marketing (only if you subscribe).

**Cookies & storage:** We use browser local storage to maintain your session, cart, and preferences. No third-party advertising trackers are installed.

**Contact:** For privacy inquiries, email hello@betterchoice.bd.`
    },
    {
        id: "terms",
        title: "Terms of Service",
        content: `By using BetterChoice you agree to these terms:

1. Product descriptions, lab certifications, and nutritional data are sourced from verified partners and updated via our catalog system.
2. Inventory is live — orders are confirmed only after successful payment or COD placement.
3. BetterChoice reserves the right to refuse service for policy violations or fraudulent Eco-Credit claims.
4. Wellness tools (Workout Planner, Meal Architect) are informational and not a substitute for medical advice.
5. Expert consultations are independent professional services governed by separate booking terms.
6. These terms may be updated; continued use constitutes acceptance of revisions posted on this page.

Governing law: People's Republic of Bangladesh.`
    }
];

// --- Order unit helpers (purchase qty vs nutritional servingSize) ---
export function inferOrderUnit(product) {
    const name = (product.name || "").toLowerCase();
    const sub = (product.subcategory || "").toLowerCase();

    if (name.includes("egg")) return "1 dozen (12 pcs)";
    if (name.includes("milk") || name.includes("kefir")) return "500ml bottle";
    if (name.includes("ghee")) return "500g jar";
    if (sub.includes("red meat") || sub.includes("poultry") || /chicken|beef|mutton|duck/.test(name)) return "per kg";
    if (sub.includes("seafood") || /fish|hilsha|pomfret|rui|prawn|salmon/.test(name)) return "per kg";
    if (sub.includes("heritage rice") || sub.includes("pulse") || sub.includes("grain") || sub.includes("flour") || /dal|lentil|oat|rice|spelt/.test(name)) return "1 kg pack";
    if (sub.includes("oil") || name.includes("honey") || name.includes("salt")) return "500ml bottle";
    if (sub.includes("beverage") || sub.includes("brew") || sub.includes("ferment") || sub.includes("tea") || sub.includes("elixir") || sub.includes("water") || sub.includes("milk")) {
        const ss = product.servingSize || "";
        if (/ml|l/i.test(ss)) return ss.match(/bottle|can|tin/i) ? ss : `${ss} bottle`;
        return "1 bottle";
    }
    if (sub.includes("supplement") || sub.includes("protein") || sub.includes("botanical") || sub.includes("distilled") || sub.includes("capsule")) {
        if (product.servingSize && /scoop|cap|drop|softgel|jar|g\b/i.test(product.servingSize)) {
            return `1 pack (${product.servingSize})`;
        }
        return "1 unit";
    }
    if (sub.includes("glass") || sub.includes("hardware") || sub.includes("wood") || sub.includes("knife") || sub.includes("cookware") || sub.includes("container") || sub.includes("jar") || sub.includes("tiffin") || sub.includes("basket")) {
        const ss = product.servingSize || "";
        if (/set|tier|container|jar|unit|piece/i.test(ss)) return ss;
        return "1 unit";
    }
    const ss = product.servingSize || "";
    if (/dozen|jar|bottle|unit|set|tier|container|\d+\s*ml|\d+\s*l\b/i.test(ss)) return ss;
    return "1 unit";
}

export function formatUnitLabel(unit) {
    if (!unit) return "";
    const u = unit.trim();
    const lower = u.toLowerCase();
    if (lower === "kg") return "per kg";
    if (lower === "liter" || lower === "litre" || lower === "l") return "1 liter";
    return u;
}

export function getOrderUnit(product) {
    const raw = product.unit && String(product.unit).trim()
        ? String(product.unit).trim()
        : inferOrderUnit(product);
    return formatUnitLabel(raw);
}

// --- GOOGLE SHEETS / CSV PARSING UTILITIES ---
export function parseCSV(csvText) {
    if (!csvText) return [];
    
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        let c = csvText[i];
        let next = csvText[i+1];

        if (c === '"') {
            if (inQuotes && next === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',') {
            if (inQuotes) {
                row[row.length - 1] += c;
            } else {
                row.push("");
            }
        } else if (c === '\r' || c === '\n') {
            if (inQuotes) {
                row[row.length - 1] += c;
            } else {
                if (c === '\r' && next === '\n') {
                    i++;
                }
                lines.push(row);
                row = [""];
            }
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== "") {
        lines.push(row);
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map(h => h.trim().toLowerCase().replace(/\s+/g, ""));
    const data = [];

    for (let r = 1; r < lines.length; r++) {
        const rowData = lines[r];
        if (rowData.length < headers.length) continue;
        
        const obj = {};
        for (let h = 0; h < headers.length; h++) {
            let key = headers[h];
            // Normalize field names
            if (key === "itemid" || key === "id") key = "id";
            if (key === "name" || key === "itemname") key = "name";
            if (key === "price" || key === "price(bdt)") key = "price";
            if (key === "saleprice" || key === "discountprice") key = "salePrice";
            if (key === "inventory" || key === "stock" || key === "quantity") key = "inventory";
            if (key === "origin" || key === "farmoforigin") key = "origin";
            if (key === "cert" || key === "labcert" || key === "certificate") key = "labCert";
            if (key === "imagelink" || key === "imageurl" || key === "photo" || key === "photos" || key === "image") key = "image";
            if (key === "servingsize" || key === "serving") key = "servingSize";
            if (key === "unit" || key === "orderunit" || key === "packsize" || key === "purchaseunit" || key === "qtyunit") key = "unit";
            
            let val = rowData[h]?.trim() || "";
            
            // Type conversions
            if (key === "price" || key === "salePrice" || key === "inventory" || key === "calories" || key === "carbs" || key === "protein" || key === "fat") {
                val = parseFloat(val.replace(/[^\d.]/g, "")) || 0;
            } else if (key === "organic" || key === "bpafree") {
                val = val.toLowerCase() === "true" || val === "1" || val.toLowerCase() === "yes";
            } else if (key === "category") {
                val = normalizeCategory(val);
            } else if (key === "image") {
                const imgs = extractAllImageUrls(val);
                val = imgs[0] || "";
                obj.images = imgs;
            } else if (key === "id") {
                val = String(val);
            }
            
            obj[key] = val;
        }
        
        // Ensure defaults if fields are missing from sheet
        if (!obj.id) obj.id = `sheet-p-${r}`;
        if (!obj.name) continue;
        if (obj.organic === undefined) obj.organic = true;
        if (obj.bpafree === undefined) obj.bpafree = true;
        if (obj.salePrice === undefined) obj.salePrice = 0;
        if (obj.inventory === undefined) obj.inventory = 10;
        if (!obj.image) obj.image = "";
        if (!obj.images?.length && obj.image) obj.images = [obj.image];
        if (!obj.images) obj.images = [];
        if (!obj.unit) obj.unit = inferOrderUnit(obj);
        else obj.unit = formatUnitLabel(obj.unit);

        data.push(obj);
    }
    
    return data;
}

// Fetch published CSV from Google Sheet URL
export async function fetchGoogleSheetCatalog(url) {
    try {
        const csvUrl = buildCsvExportUrl(url);
        
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error("Could not retrieve spreadsheet feed.");
        
        const text = await response.text();
        return parseCSV(text);
    } catch (err) {
        console.error("Google Sheets synchronization failed:", err);
        throw err;
    }
}
