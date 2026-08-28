import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const res = await fetch("https://grupoalpha.com/gastronomia/", {
  headers: { "User-Agent": UA },
});
const html = await res.text();
const $ = cheerio.load(html);

const item = $(".jet-listing-grid__item").first();
console.log("ITEMS:", $(".jet-listing-grid__item").length);
if (item.length) {
  const out = [];
  item.find("*").each((_, el) => {
    const cls = $(el).attr("class") || "";
    const txt = $(el).clone().children().remove().end().text().trim();
    if (txt && txt.length < 90)
      out.push(`${el.tagName} [${cls.slice(0, 60)}] => ${txt}`);
  });
  console.log(out.join("\n"));
}
