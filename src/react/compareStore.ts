const KEY = "ga_compare_v1";
const EVT = "gacompare";
export const MAX_COMPARE = 4;

export function getCompare(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(slugs: string[]) {
  localStorage.setItem(KEY, JSON.stringify(slugs));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function toggleCompare(slug: string): { added: boolean; full: boolean } {
  const cur = getCompare();
  if (cur.includes(slug)) {
    write(cur.filter((s) => s !== slug));
    return { added: false, full: false };
  }
  if (cur.length >= MAX_COMPARE) return { added: false, full: true };
  write([...cur, slug]);
  return { added: true, full: false };
}

export function clearCompare() {
  write([]);
}

export function onCompareChange(cb: () => void): () => void {
  const h = () => cb();
  window.addEventListener(EVT, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener("storage", h);
  };
}
