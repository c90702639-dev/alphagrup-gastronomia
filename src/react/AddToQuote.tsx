import { useEffect, useState } from "react";
import { addItem, onQuoteChange, count } from "./quoteStore";

export default function AddToQuote({
  slug,
  name,
  final,
  brand,
  category,
  localImage,
}: {
  slug: string;
  name: string;
  final: number;
  brand: string;
  category: string;
  localImage?: string;
}) {
  const [added, setAdded] = useState(false);
  const [, force] = useState(0);

  useEffect(() => onQuoteChange(() => force((n) => n + 1)), []);

  return (
    <button
      className="btn btn-primary w-full py-3.5"
      onClick={() => {
        addItem({ slug, name, final, brand, category, localImage });
        setAdded(true);
        setTimeout(() => setAdded(false), 1800);
      }}
      data-count={count()}
    >
      {added ? "✓ Agregado — ver cotización" : "Agregar a cotización"}
    </button>
  );
}
