// Check what the portal pages actually serve
const BASE = "http://localhost:4321";

// login first
const login = await fetch(`${BASE}/api/portal-login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE },
  body: "password=alpha2026",
  redirect: "manual",
});
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
console.log("cookie:", cookie.slice(0, 30) + "...");

for (const path of ["/portal/chat", "/portal/uso"]) {
  const res = await fetch(BASE + path, { headers: { Cookie: cookie } });
  const html = await res.text();
  console.log(`\n=== ${path} (${res.status}, ${html.length} bytes) ===`);
  // count style/link tags
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/gi)].map((m) => m[0]);
  console.log("stylesheet links:", styles.length);
  styles.slice(0, 3).forEach((s) => console.log("  ", s.slice(0, 120)));
  const astroStyles = html.match(/<style[^>]*>/gi)?.length || 0;
  console.log("inline <style> tags:", astroStyles);
  console.log("has astro-island:", html.includes("astro-island"));
  console.log("has body class/bg:", html.match(/<body[^>]*>/)?.[0]?.slice(0, 100));
  // check for tailwind utility classes in html
  console.log("has text-tinta-2 class:", html.includes("text-tinta-2") || html.includes("text-tinta"));
}
