import * as cheerio from "cheerio";
import { readFile } from "node:fs/promises";

const html = await readFile(
  `${process.env.TEMP}/opencode/product-sample.html`,
  "utf8",
);
const $ = cheerio.load(html);

for (const tag of ["h1", "h2", "h3", "h4", "h5"]) {
  $(tag).each((_, el) => {
    const t = $(el).text().trim();
    if (t) console.log(`${tag}: ${t.slice(0, 90)}`);
  });
}

$('[class*="title" i]').each((_, el) => {
  const c = $(el).attr("class") || "";
  const t = $(el).text().trim();
  if (t && t.length < 80 && !c.includes("css") && !c.includes("style"))
    console.log(`CLS: ${c.slice(0, 70)} => ${t.slice(0, 60)}`);
});

// jet listing link contents (title links)
$(".jet-listing-dynamic-link__content, .jet-listing-dynamic-link").each(
  (_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 80)
      console.log(`JETLINK: ${(($(el).attr("class") || "")) .slice(0, 50)} => ${t}`);
  },
);

const fields = [];
$(".jet-listing-dynamic-field__content").each((_, el) =>
  fields.push($(el).text().trim()),
);
console.log("FIELDS:", JSON.stringify(fields, null, 1));
