export interface QuoteItem {
  slug: string;
  name: string;
  qty: number;
  final: number; // unit price
  brand: string;
  category: string;
  localImage?: string;
}

const KEY = "ga_quote_v1";
const EVT = "gaquote";

function read(): QuoteItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: QuoteItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function onQuoteChange(cb: () => void): () => void {
  const h = () => cb();
  window.addEventListener(EVT, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener("storage", h);
  };
}

export function getQuote(): QuoteItem[] {
  return read();
}

export function count(): number {
  return read().reduce((n, i) => n + i.qty, 0);
}

export function addItem(item: Omit<QuoteItem, "qty">, qty = 1) {
  const items = read();
  const found = items.find((i) => i.slug === item.slug);
  if (found) found.qty += qty;
  else items.push({ ...item, qty });
  write(items);
}

export function setQty(slug: string, qty: number) {
  let items = read();
  items = items
    .map((i) => (i.slug === slug ? { ...i, qty } : i))
    .filter((i) => i.qty > 0);
  write(items);
}

export function removeItem(slug: string) {
  write(read().filter((i) => i.slug !== slug));
}

export function clear() {
  write([]);
}
