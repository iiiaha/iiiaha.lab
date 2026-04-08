"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Product, formatPrice } from "@/lib/types";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase";
import { useCart } from "@/lib/cart";

export default function ExtensionDetail({ product }: { product: Product }) {
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const { addItem, items } = useCart();

  useEffect(() => {
    const check = async () => {
      const user = await getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .eq("status", "paid")
        .limit(1)
        .single();

      if (order) {
        setPurchased(true);
      }
      setLoading(false);
    };
    check();
  }, [product.id]);

  const info = [
    { label: "Version", value: product.version },
    { label: "Compatible", value: product.compatibility },
    { label: "Price", value: null },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <Link href="/extensions" className="flex items-center gap-1.5 text-[16px] font-bold tracking-[0.03em] no-underline hover:underline">
          Extensions
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#111" strokeWidth="1.5"/></svg>
        </Link>
      </div>
      <div className="border-b border-[#111] mb-[72px] sticky-divider" />

      <div className="aspect-video bg-[#f5f5f5] border border-[#ddd] mb-5 flex items-center justify-center text-[#999]">
        {product.thumbnail_url ? (
          <img
            src={product.thumbnail_url}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          product.name
        )}
      </div>

      <h1 className="text-[15px] font-bold tracking-[0.03em] mb-3">
        {product.name}
      </h1>

      <div className="border-t border-[#ddd]">
        {info.map(
          ({ label, value }) =>
            value && (
              <div key={label} className="flex border-b border-[#ddd] py-1">
                <span className="w-[140px] shrink-0 text-[13px] text-[#666]">
                  {label}
                </span>
                <span className="text-[14px]">{value}</span>
              </div>
            )
        )}
        {/* Price */}
        <div className="flex border-b border-[#ddd] py-1">
          <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Price</span>
          <div className="flex items-center gap-2">
            {(product.discount_percent ?? 0) > 0 && product.original_price ? (
              <>
                <span className="text-[13px] text-[#999] line-through">{formatPrice(product.original_price)}</span>
                <span className="text-[14px] font-bold text-red-600">{formatPrice(product.price)}</span>
                <span className="text-[11px] text-red-600 font-bold">-{product.discount_percent}%</span>
              </>
            ) : (
              <span className="text-[14px]">{formatPrice(product.price)}</span>
            )}
          </div>
        </div>
        {/* Description */}
        {product.description && (
          <div className="pt-1.5 pb-4">
            <div className="flex mb-3">
              <span className="w-[140px] shrink-0 text-[13px] text-[#666]">
                Description
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {product.description.split("\n").map((line, i) => {
                const match = line.match(/^[•]\s*(.+?)\s*[—]\s*(.+)$/);
                if (match) {
                  return (
                    <div key={i} className="flex gap-2">
                      <span className="text-[13px] text-[#999] mt-px">•</span>
                      <div>
                        <p className="text-[13px] font-bold mb-0.5">
                          {match[1]}
                        </p>
                        <p className="text-[13px] text-[#666]">{match[2]}</p>
                      </div>
                    </div>
                  );
                }
                return line.trim() ? (
                  <p key={i} className="text-[13px]">
                    {line}
                  </p>
                ) : null;
              })}
            </div>
            {product.description_ko && (
              <>
                <div className="border-t border-[#eee] my-1.5" />
                <div className="flex flex-col gap-1">
                  {product.description_ko.split("\n").map((line, i) => {
                    const match = line.match(/^[•]\s*(.+?)\s*[—]\s*(.+)$/);
                    if (match) {
                      return (
                        <div key={i} className="flex gap-2">
                          <span className="text-[13px] text-[#ccc] mt-px">
                            •
                          </span>
                          <div>
                            <p className="text-[13px] font-bold text-[#666] mb-0.5">
                              {match[1]}
                            </p>
                            <p className="text-[12px] text-[#999]">
                              {match[2]}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return line.trim() ? (
                      <p key={i} className="text-[13px] text-[#666]">
                        {line}
                      </p>
                    ) : null;
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Purchase / Purchased */}
      <div className="mt-6">
        {loading ? (
          <div className="w-full py-4 text-center text-[14px] text-[#999]">
            ...
          </div>
        ) : purchased ? (
          <div className="border border-[#ddd] p-5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold">Purchased</span>
              <a
                href={`/api/download/${product.slug}`}
                className="text-[12px] text-[#111] border border-[#111] px-4 py-1.5 no-underline hover:bg-[#111] hover:text-white transition-colors"
              >
                Download .rbz
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.some((i) => i.id === product.id) || added ? (
              <Link
                href="/cart"
                className="w-full bg-[#111] text-white text-[14px] font-bold tracking-[0.05em] py-3 border-0 text-center no-underline hover:bg-[#333] transition-colors duration-200"
              >
                Go to Cart
              </Link>
            ) : (
              <button
                onClick={() => {
                  addItem({
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    price: product.price,
                    original_price: product.original_price,
                    discount_percent: product.discount_percent,
                    thumbnail_url: product.thumbnail_url,
                  });
                  setAdded(true);
                }}
                className="w-full bg-[#111] text-white text-[14px] font-bold tracking-[0.05em] py-3 border-0 cursor-pointer hover:bg-[#333] transition-colors duration-200"
              >
                Add to Cart &mdash; {formatPrice(product.price)}
              </button>
            )}

            {/* Subscription CTA */}
            <Link
              href="/subscribe"
              className="sub-cta group block no-underline mt-2 rounded-sm overflow-hidden relative"
            >
              <div className="sub-cta-bg absolute inset-0" />
              <div className="sub-cta-aurora absolute inset-0" />
              <div className="text-center px-5 py-5 relative">
                <p className="text-[13px] text-[rgba(255,255,255,0.8)] mb-1.5">
                  Or get <span className="font-bold text-white">all 17 extensions</span> with a subscription
                </p>
                <p className="text-[17px] font-bold text-white tracking-wide">
                  ₩39,000<span className="text-[12px] font-normal text-[rgba(255,255,255,0.5)]"> /month</span>
                </p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
