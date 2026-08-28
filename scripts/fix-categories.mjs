import { readFile, writeFile } from "node:fs/promises";

function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const RULES = [
  ["gabinete mantenedor", "Mantenedores"],
  ["vitrina caliente", "Mantenedores"],
  ["freidora", "Freidora"],
  ["sarten basculante", "Sartén Basculante"],
  ["marmita", "Marmita"],
  ["microondas", "Microondas"],
];

const db = JSON.parse(await readFile("src/data/products.json", "utf8"));

for (const p of db.products) {
  if (p.category !== "Gastronomía") continue;
  const n = norm(p.name);
  for (const [needle, cat] of RULES) {
    if (n.includes(needle)) {
      p.category = cat;
      break;
    }
  }
}

db.categories = [...new Set(db.products.map((p) => p.category))].sort();
await writeFile("src/data/products.json", JSON.stringify(db, null, 2), "utf8");

console.log("Categories:", db.categories.join(", "));
