import type { APIRoute } from "astro";
import { portalPassword, portalToken, PORTAL_COOKIE } from "../../lib/ai/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (form?.get("password") !== portalPassword()) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/portal?error=1" },
    });
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/portal/chat",
      "Set-Cookie": `${PORTAL_COOKIE}=${portalToken()}; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax`,
    },
  });
};
