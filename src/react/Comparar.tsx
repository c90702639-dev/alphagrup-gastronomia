import { useEffect, useState } from "react";
import { getCompare, clearCompare } from "./compareStore";

export interface P {
  slug: string;
  name: string;
  brand: string;
  category: string;
  specs: Record<string, string>;
  localImage?: string;
  final: number;
  discountPct: number;
}

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

export default function Comparar({ all }: { all: P[] }) {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => setSlugs(getCompare()), []);

  const items = slugs.map((s) => all.find((p) => p.slug === s)).filter(Boolean) as P[];

  if (!items.length)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">Nada para comparar aún</h1>
        <p className="mt-3 text-tinta-2">
          Marca «Comparar» en hasta 4 productos del catálogo.
        </p>
        <a href="/productos" className="btn btn-primary mt-7">
          Ir al catálogo
        </a>
      </div>
    );

  const specKeys = [...new Set(items.flatMap((p) => Object.keys(p.specs)))];

  return (
    <div className="container-x py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Comparador técnico</p>
          <h1 className="mt-1 font-display text-4xl font-semibold">
            {items.length} equipos lado a lado
          </h1>
        </div>
        <button onClick={() => clearCompare()} className="text-sm font-medium text-tinta-3 hover:text-alerta">
          Limpiar selección ×
        </button>
      </div>

      <div className="mt-8 overflow-x-auto border border-linea bg-white">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-44 border-b border-r border-linea bg-papel-2 p-3"></th>
              {items.map((p) => (
                <th key={p.slug} className="border-b border-linea p-4 align-bottom">
                  <a href={`/productos/${p.slug}/`} className="block">
                    {p.localImage && (
                      <img
                        src={p.localImage}
                        alt={p.name}
                        width="140"
                        height="105"
                        loading="lazy"
                        className="mx-auto mb-2 aspect-[4/3] object-contain"
                      />
                    )}
                    <span className="font-medium leading-snug hover:text-cobre">{p.name}</span>
                  </a>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-tinta-3">
                    {p.brand}
                  </p>
                </th>
              ))}
            </tr>
            <tr>
              <th className="border-b border-r border-linea bg-papel-2 p-3 text-left text-xs uppercase tracking-wide text-tinta-3">
                Precio estimado
              </th>
              {items.map((p) => (
                <td key={p.slug} className="border-b border-linea p-3 text-center">
                  {p.discountPct > 0 && (
                    <span className="mr-1.5 text-xs text-alerta font-semibold">−{p.discountPct}%</span>
                  )}
                  <span className="font-display text-lg font-semibold text-cobre">
                    {money(p.final)}
                  </span>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {specKeys.map((k) => (
              <tr key={k} className="hover:bg-papel-2/60">
                <th scope="row" className="border-b border-r border-linea bg-papel-2 p-3 text-left text-xs font-medium uppercase tracking-wide text-tinta-3">
                  {k}
                </th>
                {items.map((p) => (
                  <td key={p.slug} className="border-b border-linea p-3 text-center">
                    {p.specs[k] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <a href="/cotizacion" className="btn btn-primary mt-8 px-7 py-3">
        Solicitar cotización de estos equipos
      </a>
    </div>
  );
}
