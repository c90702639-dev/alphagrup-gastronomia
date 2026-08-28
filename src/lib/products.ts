import raw from "../data/products.json";

export interface Product {
  id: string;
  slug: string;
  name: string;
  division: string;
  category: string;
  brand: string;
  specs: Record<string, string>;
  images: string[];
  localImage?: string;
  sourceUrl: string;
}

export interface ProductDB {
  scrapedAt: string;
  division: string;
  categories: string[];
  brands: string[];
  products: Product[];
}

const db = raw as unknown as ProductDB;

export const products: Product[] = db.products;
export const categories: string[] = db.categories;
export const brands: string[] = db.brands;

/** Deterministic demo pricing derived from product id — replaced by real price feed later. */
export function priceFor(p: Product): { base: number; discountPct: number } {
  let h = 0;
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) % 100000;
  const base = 8500 + (h % 420) * 250; // MXN-ish range
  const discountPct = [0, 0, 5, 8, 10, 12, 15][h % 7];
  return { base, discountPct };
}

export function finalPrice(p: Product): number {
  const { base, discountPct } = priceFor(p);
  return Math.round(base * (1 - discountPct / 100));
}

export function formatMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function getBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function related(p: Product, n = 4): Product[] {
  return products
    .filter((x) => x.slug !== p.slug)
    .sort((a, b) => {
      const score = (q: Product) =>
        (q.category === p.category ? 2 : 0) + (q.brand === p.brand ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, n);
}
