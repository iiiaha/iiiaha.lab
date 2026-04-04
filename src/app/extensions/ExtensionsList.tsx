"use client";

import { useState } from "react";
import { Product, Platform } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

const FILTERS: { key: string; label: string; value: Platform | undefined }[] = [
  { key: "all", label: "All", value: undefined },
  { key: "sketchup", label: "SketchUp", value: "sketchup" },
  { key: "autocad", label: "AutoCAD", value: "autocad" },
];

export default function ExtensionsList({
  products,
}: {
  products: Product[];
}) {
  const [filter, setFilter] = useState<Platform | undefined>(undefined);
  const filtered = filter
    ? products.filter((p) => p.platform === filter)
    : products;

  return (
    <div>
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-3">Extensions</h1>
      <div className="border-b border-[#111] mb-5" />
      <div className="flex gap-6 text-[13px] tracking-[0.05em] mb-6">
        {FILTERS.map(({ key, label, value }) => (
          <button
            key={key}
            onClick={() => setFilter(value)}
            className={`border-0 bg-transparent cursor-pointer text-[13px] tracking-[0.05em] hover:underline ${
              filter === value ? "font-bold" : "text-[#666]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-10 gap-y-12 max-md:grid-cols-2 max-sm:grid-cols-1">
        {filtered.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
          />
        ))}
      </div>
    </div>
  );
}
