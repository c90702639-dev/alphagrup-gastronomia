import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return new Response(null, { status: 302, headers: { Location: "/contacto" } });
  }

  const nombre = form.get("nombre");
  const email = form.get("email");
  console.log(`[contacto] ${nombre} <${email}>: ${form.get("mensaje")}`);

  return new Response(null, {
    status: 303,
    headers: { Location: "/contacto?enviado=1" },
  });
};
