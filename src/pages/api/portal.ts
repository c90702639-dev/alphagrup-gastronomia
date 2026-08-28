import type { APIRoute } from "astro";
import crypto from "node:crypto";

export const prerender = false;

const PASSWORD = () => import.meta.env.PORTAL_PASSWORD || "alpha2026";
const COOKIE = "ga_portal";

function token(): string {
  return crypto
    .createHash("sha256")
    .update(`${PASSWORD()}::grupo-alpha-portal`)
    .digest("hex")
    .slice(0, 32);
}

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("logout") !== null) {
    return redirect("/portal", {
      headers: { "Set-Cookie": `${COOKIE}=; Max-Age=0; Path=/` },
    });
  }
  // simple login form for GET without cookie handled by portal page itself
  return new Response(null, { status: 404 });
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData().catch(() => null);
  const pw = form?.get("password");
  if (pw !== PASSWORD()) {
    return redirect("/portal?error=1");
  }
  return redirect("/portal/chat", {
    headers: {
      "Set-Cookie": `${COOKIE}=${token()}; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax`,
    },
  });
};

export function isAuthed(cookies: { get: (k: string) => { value: string } | undefined }): boolean {
  return cookies.get(COOKIE)?.value === token();
}
