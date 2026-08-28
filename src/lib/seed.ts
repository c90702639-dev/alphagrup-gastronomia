import { list, writeAll, newId } from "./store";
import { products, finalPrice, priceFor } from "./products";

/**
 * Seeds realistic demo data on first run so the dashboard looks alive.
 * Every seeded item carries demo:true → the purge button removes only these.
 */

export interface LeadItem {
  slug: string;
  name: string;
  brand: string;
  qty: number;
  price: number;
}

export interface Lead {
  id: string;
  fecha: number;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  pais: string;
  mensaje?: string;
  items: LeadItem[];
  total: number;
  estado: "nuevo" | "contactado" | "cotizada" | "ganado" | "perdido";
  notas: { ts: number; texto: string }[];
  demo?: boolean;
}

const CLIENTES = [
  ["María Fernanda López", "Restaurante La Terraza", "Ciudad de México", "nuevo"],
  ["Carlos Mendoza", "Hotel Vista Real", "Guatemala", "contactado"],
  ["Ana Gabriela Rojas", "Cafetería Dulce Amanecer", "Costa Rica", "cotizada"],
  ["Jorge Iván Ramírez", "Cadena Sabor & Co.", "Colombia", "cotizada"],
  ["Luisa Martínez", "Panadería La Espiga", "Perú", "nuevo"],
  ["Roberto Castillo", "Comedor Industrial Alimentos SA", "El Salvador", "ganado"],
  ["Patricia Núñez", "Hospital General del Este", "República Dominicana", "contactado"],
  ["Diego Fernando Torres", "Pizzería Napoli", "México", "perdido"],
  ["Valeria Jiménez", "Cloud Kitchen Central", "México", "nuevo"],
  ["Andrés Villalobos", "Supermercados La Colonia", "Honduras" , "contactado"],
] as const;

function pickItems(n: number): LeadItem[] {
  const out: LeadItem[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    let p = products[Math.floor(Math.random() * products.length)];
    while (used.has(p.slug)) p = products[Math.floor(Math.random() * products.length)];
    used.add(p.slug);
    out.push({
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      qty: 1 + Math.floor(Math.random() * 4),
      price: finalPrice(p),
    });
  }
  return out;
}

export async function ensureSeeded(): Promise<void> {
  const meta = await list<{ id: string; key: string }>("meta");
  if (meta.some((m) => m.key === "seeded")) return;

  const DAY = 86_400_000;
  const now = Date.now();

  /* ── leads: 10 spread across last 14 days ─────────────────── */
  const leads = CLIENTES.map(([nombre, empresa, pais, estado], i) => {
    const items = pickItems(1 + Math.floor(Math.random() * 3));
    const total = items.reduce((n, it) => n + it.qty * it.price, 0);
    const diasAtras = Math.floor((i / CLIENTES.length) * 14);
    return {
      id: newId("lead"),
      fecha: now - diasAtras * DAY - Math.floor(Math.random() * DAY * 0.8),
      nombre,
      empresa,
      pais,
      email: `${nombre.split(" ")[0].toLowerCase()}@${empresa.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12)}.com`,
      telefono: "+52 55 " + (10000000 + Math.floor(Math.random() * 89999999)),
      mensaje: i % 3 === 0 ? "Necesito entrega en 2 semanas. ¿Manejan financiamiento?" : undefined,
      items,
      total,
      estado: estado as Lead["estado"],
      notas:
        estado !== "nuevo"
          ? [{ ts: now - (diasAtras - 1) * DAY, texto: "Primer contacto por teléfono." }]
          : [],
      demo: true,
    };
  });
  await writeAll("leads", leads);

  /* ── quotes: 4 from the builder ────────────────────────────── */
  const quotes = [0, 1, 2, 3].map((i) => {
    const items = pickItems(2 + Math.floor(Math.random() * 2)).map((it) => ({
      ...it,
      descuento: [0, 5, 8, 10][Math.floor(Math.random() * 4)],
    }));
    const subtotal = items.reduce((n, it) => n + it.qty * it.price, 0);
    return {
      id: newId("qt"),
      folio: `GA-${2026}-${String(1041 + i)}`,
      fecha: now - Math.floor(Math.random() * 12) * DAY,
      cliente: CLIENTES[(i + 1) % CLIENTES.length][1],
      contacto: CLIENTES[(i + 1) % CLIENTES.length][0],
      items,
      subtotal,
      descuentoGlobal: i === 0 ? 8 : 0,
      total: Math.round(subtotal * (i === 0 ? 0.92 : 1)),
      estado: (["borrador", "enviada", "enviada", "aceptada"] as const)[i],
      demo: true,
    };
  });
  await writeAll("quotes", quotes);

  /* ── activity feed ─────────────────────────────────────────── */
  const act = [
    { hace: 0.2, tipo: "lead", texto: `Nueva cotización web — ${CLIENTES[0][1]} (${CLIENTES[0][2]})` },
    { hace: 1, tipo: "ia", texto: "Consulta IA: «¿Qué horno combi soporta más charolas GN?»" },
    { hace: 2, tipo: "quote", texto: "Cotización GA-2026-1043 enviada a Cadena Sabor & Co." },
    { hace: 3, tipo: "lead", texto: `Lead actualizado a CONTACTADO — Hotel Vista Real` },
    { hace: 5, tipo: "win", texto: `🎉 Trato GANADO — Comedor Industrial Alimentos SA` },
    { hace: 7, tipo: "doc", texto: "Ficha técnica indexada: Rational iCOMBI PRO" },
  ].map((a, i) => ({
    id: newId("act"),
    ts: now - a.hace * DAY,
    tipo: a.tipo,
    texto: a.texto,
    demo: true,
  }));
  await writeAll("activity", act);

  await saveMetaFlag("seeded");
}

async function saveMetaFlag(key: string) {
  const meta = await list<{ id: string; key: string }>("meta");
  if (!meta.some((m) => m.key === key)) {
    await writeAll("meta", [...meta, { id: newId("m"), key }]);
  }
}

/** Removes only items flagged demo:true. Returns counts per collection. */
export async function purgeDemo(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const col of ["leads", "quotes", "activity"] as const) {
    const items = await list<any>(col);
    const kept = items.filter((x) => !x.demo);
    counts[col] = items.length - kept.length;
    await writeAll(col, kept);
  }
  return counts;
}
