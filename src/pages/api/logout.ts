import type { APIRoute } from "astro";
import { PORTAL_COOKIE } from "../../lib/ai/auth";

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(null, {
    status: 302,
    headers: {
      Location: "/portal",
      "Set-Cookie": `${PORTAL_COOKIE}=; Max-Age=0; Path=/`,
    },
  });
