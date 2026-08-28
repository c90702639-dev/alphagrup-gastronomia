import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const DIVISIONS = ["Panadería", "Gastronomía", "Frío", "Bebidas"];
const BRANDS = [
  "Rational", "Cook Rite", "Hoshizaki", "Winterhalter", "Meiko", "Cambro",
  "Snack Pro", "Atosa", "Roboqbo", "Hidronix", "Parker", "Alpha",
  "Spaceman", "Atoll", "Heatline", "Casseq", "Turbofan", "Mareno", "Santos",
];

// canonical category mapping
const CATEGORY_MAP = {
  "hornos combinados": "Hornos Combinados",
  coccion: "Cocción",
  mantenedores: "Mantenedores",
  freidora: "Freidora",
  "sarten basculante": "Sartén Basculante",
  marmita: "Marmita",
  microondas: "Microondas",
};

function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const db = JSON.parse(await readFile("src/data/products.json", "utf8"));

for (const p of db.products) {
  // Gather all candidate terms: scraped terms live on card but we only stored final fields;
  // re-derive from sourceUrl path segments + stored fields.
  const urlParts = new URL(p.sourceUrl).pathname.split("/").filter(Boolean);
  const catSlug = urlParts[1] || ""; // /tienda/<cat>/<slug>/

  const catCanonical =
    CATEGORY_MAP[catSlug] ||
    CATEGORY_MAP[norm(catSlug)] ||
    p.category ||
    "Equipos";

  // Brand: match against name + category string + old brand field
  const hay = norm(`${p.name} ${p.category} ${p.brand}`);
  let brand = "Alpha";
  for (const b of BRANDS) {
    if (hay.includes(norm(b))) {
      brand = b;
      break;
    }
  }

  p.brand = brand;
  p.category = catCanonical;
}

db.categories = [...new Set(db.products.map((p) => p.category))];
db.brands = [...new Set(db.products.map((p) => p.brand))];

await writeFile(
  "src/data/products.json",
  JSON.stringify(db, null, 2),
  "utf8",
);

console.log("Categories:", db.categories.join(", "));
console.log("Brands:", db.brands.join(", "));
console.log(
  "Image counts:",
  db.products.filter((p) => p.images.length === 0).length,
  "products without images",
);
