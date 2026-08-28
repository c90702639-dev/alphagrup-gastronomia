import { useEffect, useMemo, useState } from "react";
import {
  getCompare,
  toggleCompare,
  onCompareChange,
  MAX_COMPARE,
} from "./compareStore";

export interface P {
  slug: string;
  name: string;
  category: string;
  brand: string;
  specs: Record<string, string>;
  localImage?: string;
  base: number;
  final: number;
  discountPct: number;
}

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

export default function Catalog({
  products,
  categories,
  brands,
  initialCat,
}: {
  products: P[];
  categories: string[];
  brands: string[];
  initialCat?: string;
}) {
  const [cat, setCat] = useState(initialCat ?? "Todas");
  const [brand, setBrand] = useState("Todas");
  const [q, setQ] = useState("");
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [sort, setSort] = useState<"destacados" | "precio-asc" | "precio-desc" | "descuento">("destacados");
  const [compare, setCompare] = useState<string[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setCompare(getCompare());
    return onCompareChange(() => setCompare(getCompare()));
  }, []);

  const volts = useMemo(
    () => [...new Set(products.map((p) => p.specs["Voltaje"]).filter(Boolean))].sort(),
    [products],
  );
  const [volt, setVolt] = useState("Todos");

  const filtered = useMemo(() => {
    let out = products.filter((p) => {
      if (cat !== "Todas" && p.category !== cat) return false;
      if (brand !== "Todas" && p.brand !== brand) return false;
      if (volt !== "Todos" && p.specs["Voltaje"] !== volt) return false;
      if (onlyOffers && p.discountPct <= 0) return false;
      if (q) {
        const hay = `${p.name} ${p.brand} ${p.category} ${Object.values(p.specs).join(" ")}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    if (sort === "precio-asc") out = [...out].sort((a, b) => a.final - b.final);
    if (sort === "precio-desc") out = [...out].sort((a, b) => b.final - a.final);
    if (sort === "descuento") out = [...out].sort((a, b) => b.discountPct - a.discountPct);
    return out;
  }, [products, cat, brand, volt, onlyOffers, q, sort]);

  const active =
    (cat !== "Todas" ? 1 : 0) +
    (brand !== "Todas" ? 1 : 0) +
    (volt !== "Todos" ? 1 : 0) +
    (onlyOffers ? 1 : 0) +
    (q ? 1 : 0);

  const reset = () => {
    setCat("Todas");
    setBrand("Todas");
    setVolt("Todos");
    setOnlyOffers(false);
    setQ("");
  };

  const selectCls =
    "w-full border border-linea bg-white px-3 py-2 text-sm focus:border-cobre focus:outline-none";

  return (
    <div className="container-x py-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Catálogo Gastronomía</p>
          <h1 className="mt-1 font-display text-4xl font-semibold">
            {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
          </h1>
        </div>
        <label className="relative block max-w-md flex-1">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar equipo, marca, capacidad…"
            className="w-full border border-linea bg-white px-4 py-2.5 pr-10 text-sm focus:border-cobre focus:outline-none"
          />
          <svg
            className="absolute right-3 top-3.5 text-tinta-3"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
          </svg>
        </label>
      </div>

      {/* Filtros */}
      <div className="mt-6 grid grid-cols-2 gap-3 border-y border-linea py-4 md:grid-cols-5">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={selectCls} aria-label="Categoría">
          <option>Todas</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <select value={brand} onChange={(e) => setBrand(e.target.value)} className={selectCls} aria-label="Marca">
          <option>Todas</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>

        <select value={volt} onChange={(e) => setVolt(e.target.value)} className={selectCls} aria-label="Voltaje">
          <option>Todos</option>
          {volts.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>

        <button
          onClick={() => setOnlyOffers(!onlyOffers)}
          className={`border px-3 py-2 text-sm font-medium transition-colors ${
            onlyOffers
              ? "border-terracota bg-terracota text-white"
              : "border-linea bg-white hover:bg-papel-2"
          }`}
        >
          % Solo ofertas
        </button>

        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={selectCls} aria-label="Ordenar">
          <option value="destacados">Destacados</option>
          <option value="precio-asc">Precio ↑</option>
          <option value="precio-desc">Precio ↓</option>
          <option value="descuento">Mayor descuento</option>
        </select>
      </div>

      {active > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <p className="text-tinta-3">{active} filtro(s) activo(s)</p>
          <button onClick={reset} className="font-semibold text-cobre hover:underline">
            Limpiar filtros ×
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-display text-2xl font-semibold">Sin resultados</p>
          <p className="mt-2 text-tinta-3">Prueba con otros filtros o limpiar la búsqueda.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((p) => {
            const inCompare = compare.includes(p.slug);
            return (
            <article key={p.slug} className="card group relative flex flex-col">
              {p.discountPct > 0 && (
                <span className="absolute top-3 left-3 z-10 bg-terracota px-2 py-1 text-[0.7rem] font-bold tracking-wide text-white">
                  −{p.discountPct}%
                </span>
              )}
              <a href={`/productos/${p.slug}/`} className="block overflow-hidden bg-papel-2">
                {p.localImage ? (
                  <img
                    src={p.localImage}
                    alt={p.name}
                    width="400"
                    height="300"
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/3] w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center text-tinta-3">Sin imagen</div>
                )}
              </a>
              <div className="flex flex-1 flex-col border-t border-linea p-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-tinta-3">
                  {p.brand} · {p.category}
                </p>
                <h3 className="mt-1 line-clamp-2 leading-snug">
                  <a href={`/productos/${p.slug}/`} className="hover:text-cobre">
                    {p.name}
                  </a>
                </h3>
                <div className="mt-auto pt-3">
                  {p.discountPct > 0 && (
                    <span className="mr-2 text-sm text-tinta-3 line-through">{money(p.base)}</span>
                  )}
                  <span className="font-display text-lg font-semibold text-cobre">{money(p.final)}</span>
                </div>
                <label className={`mt-3 flex cursor-pointer items-center gap-2 border-t border-linea pt-3 text-xs font-medium ${inCompare ? "text-cobre" : "text-tinta-3"}`}>
                  <input
                    type="checkbox"
                    checked={inCompare}
                    onChange={() => {
                      const r = toggleCompare(p.slug);
                      if (r.full) setToast(`Máximo ${MAX_COMPARE} productos para comparar`);
                    }}
                    className="size-4 accent-[#b4642d]"
                  />
                  Comparar
                </label>
              </div>
            </article>
            );
          })}
        </div>
      )}

      {/* Compare bar */}
      {compare.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 border border-tinta bg-tinta px-5 py-3 text-papel shadow-xl">
          <span className="text-sm">
            {compare.length}/{MAX_COMPARE} para comparar
          </span>
          <a
            href="/comparar"
            className={`btn px-4 py-1.5 text-sm ${
              compare.length >= 2 ? "btn-primary" : "pointer-events-none opacity-40"
            }`}
          >
            Comparar →
          </a>
          <button
            onClick={() => {
              import("./compareStore").then((m) => m.clearCompare());
            }}
            className="text-sm text-papel/60 hover:text-papel"
            aria-label="Limpiar comparación"
          >
            ×
          </button>
        </div>
      )}

      {toast && (
        <div
          role="status"
          onAnimationEnd={() => setToast("")}
          className="fixed top-20 left-1/2 z-50 -translate-x-1/2 border border-alerta bg-white px-4 py-2 text-sm font-medium text-alerta shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
