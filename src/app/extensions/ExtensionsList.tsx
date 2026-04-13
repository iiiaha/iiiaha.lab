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
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-[10px]">Extensions</h1>
      <div className="border-b border-[#111] mb-4 sticky-divider" />
      <div className="flex items-center min-h-[32px] gap-6 text-[13px] tracking-[0.05em] mb-6">
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

      {/* 디버깅 기간 할인 배너 */}
      <div className="sub-cta relative overflow-hidden mb-6">
        <div className="sub-cta-bg absolute inset-0" />
        <div className="sub-cta-aurora absolute inset-0" />
        <div className="relative px-6 py-5 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-white">
                Debugging Period
              </span>
              <span className="text-[11px] text-[rgba(255,255,255,0.5)]">
                ~ 2026.07.31
              </span>
            </div>
            <p className="text-[13px] text-[rgba(255,255,255,0.85)] leading-[1.6]">
              서비스 초기 안정화 기간 동안{" "}
              <strong className="text-white">모든 익스텐션 20% 할인</strong>합니다.
              사용 중 버그나 불편을 발견하시면{" "}
              <a
                href="/openlab"
                className="text-white underline hover:no-underline"
              >
                Open Lab
              </a>
              에 알려주세요.
            </p>
          </div>
          <div className="shrink-0 flex items-baseline gap-1 max-sm:self-end">
            <span className="text-[32px] font-bold text-white leading-none tracking-[-0.02em]">
              20%
            </span>
            <span className="text-[13px] font-bold text-white">OFF</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-6 max-sm:gap-x-2 max-sm:gap-y-4">
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
