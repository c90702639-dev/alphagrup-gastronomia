import * as cheerio from "cheerio";
import { writeFile, mkdir } from "node:fs/promises";

const BASE = "https://grupoalpha.com";
const LISTING = `${BASE}/gastronomia/`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
      });
      if (res.ok) return await res.text();
      console.error(`  HTTP ${res.status} on ${url} (attempt ${attempt})`);
    } catch (e) {
      console.error(`  FETCH ERROR ${url}: ${e.message} (attempt ${attempt})`);
    }
    await sleep(1200 * attempt);
  }
  return null;
}

function parseListing(html) {
  const $ = cheerio.load(html);
  const items = [];
  $(".jet-listing-grid__item").each((_, item) => {
    const $i = $(item);
    const href = $i.find('a[href*="/tienda/"]').first().attr("href");
    if (!href) return;
    const url = href.split("?")[0];
    const name = $i.find("h2").first().text().trim();
    const img = $i.find("img").first().attr("src") || "";
    const terms = [];
    $i.find(".jet-listing-dynamic-terms__link").each((__, t) => {
      const txt = $(t).text().trim();
      if (txt && !terms.includes(txt)) terms.push(txt);
    });
    // terms order: [División, Subcategoría..., Marca]
    const brand = terms.length ? terms[terms.length - 1] : null;
    const category = terms.length > 1 ? terms[terms.length - 2] : null;
    const division = terms.length ? terms[0] : null;
    items.push({ url, name, image: img.split("?")[0], brand, category, division });
  });
  // dedupe by URL
  const map = new Map(items.map((i) => [i.url, i]));
  return [...map.values()];
}

function parseProduct(html) {
  const $ = cheerio.load(html);

  const name =
    $("h2.elementor-heading-title").first().text().trim() ||
    ($("title").text() || "").replace(/\s*–\s*Grupo Alpha\s*$/i, "").trim();

  const specs = {};
  $(".jet-listing-dynamic-field__content").each((_, el) => {
    const txt = $(el).text().trim();
    const m = txt.match(/^([^:]+):\s*(.+)$/s);
    if (m) specs[m[1].trim()] = m[2].trim();
  });

  const images = [];
  $("img").each((_, el) => {
    const s = ($(el).attr("src") || "").split("?")[0];
    if (
      s.includes("/uploads/") &&
      !/logo/i.test(s) &&
      !images.includes(s)
    )
      images.push(s);
  });

  return { name, specs, images };
}

async function main() {
  console.log(`Fetching listing: ${LISTING}`);
  const html = await get(LISTING);
  if (!html) process.exit(1);

  const cards = parseListing(html);
  console.log(`Found ${cards.length} products`);

  const products = [];
  let i = 0;
  for (const card of cards) {
    i++;
    await sleep(350);
    const phtml = await get(card.url);
    const details = phtml ? parseProduct(phtml) : { name: "", specs: {}, images: [] };

    const slug = new URL(card.url).pathname
      .split("/")
      .filter(Boolean)
      .pop();

    products.push({
      id: slug,
      slug,
      name: details.name || card.name,
      division: card.division || "Gastronomía",
      category: card.category || "Equipos",
      brand: card.brand || "Alpha",
      specs: details.specs,
      images: details.images.length ? details.images : card.image ? [card.image] : [],
      sourceUrl: card.url,
    });
    console.log(
      `[${i}/${cards.length}] ${details.name || card.name} (${card.brand || "?"} / ${card.category || "?"})`,
    );
  }

  const categories = [...new Set(products.map((p) => p.category))];
  const brands = [...new Set(products.map((p) => p.brand))];

  await mkdir("src/data", { recursive: true });
  await writeFile(
    "src/data/products.json",
    JSON.stringify(
      { scrapedAt: new Date().toISOString(), division: "Gastronomía", categories, brands, products },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\n✓ Saved ${products.length} products → src/data/products.json`);
  console.log(`Categories (${categories.length}):`, categories.join(", "));
  console.log(`Brands (${brands.length}):`, brands.join(", "));
}

main();
