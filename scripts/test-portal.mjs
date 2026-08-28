// Quick end-to-end check of the portal auth flow
const BASE = "http://localhost:4321";

const login = await fetch(`${BASE}/api/portal-login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: BASE,
  },
  body: "password=alpha2026",
  redirect: "manual",
});
console.log("login:", login.status, "→", login.headers.get("location"));
const setCookie = login.headers.get("set-cookie") || "";
const cookie = setCookie.split(";")[0];

const wrong = await fetch(`${BASE}/api/portal-login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: BASE,
  },
  body: "password=incorrecta",
  redirect: "manual",
});
console.log("wrong password:", wrong.status, "→", wrong.headers.get("location"));

const noAuth = await fetch(`${BASE}/portal/chat`, { redirect: "manual" });
console.log("chat sin cookie:", noAuth.status, "→", noAuth.headers.get("location"));

const withAuth = await fetch(`${BASE}/portal/chat`, {
  headers: { Cookie: cookie },
});
console.log("chat con cookie:", withAuth.status);

const uso = await fetch(`${BASE}/portal/uso`, { headers: { Cookie: cookie } });
console.log("uso con cookie:", uso.status);

const docs = await fetch(`${BASE}/portal/documentos`, { headers: { Cookie: cookie } });
console.log("documentos con cookie:", docs.status);
