import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const db = JSON.parse(await readFile("src/data/products.json", "utf8"));
await mkdir("public/productos", { recursive: true });

let ok = 0,
  fail = 0;
for (const p of db.products) {
  if (!p.images.length) continue;
  const url = p.images[0];
  const ext = (url.match(/\.(png|jpe?g|webp)(\?|$)/i)?.[1] || "png").toLowerCase();
  const file = `public/productos/${p.slug}.${ext}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await pipeline(res.body, createWriteStream(file));
    p.localImage = `/productos/${p.slug}.${ext}`;
    ok++;
  } catch (e) {
    console.error(`FAIL ${p.slug}: ${e.message}`);
    fail++;
  }
}

await writeFile("src/data/products.json", JSON.stringify(db, null, 2), "utf8");
console.log(`✓ Downloaded ${ok}, failed ${fail}`);
