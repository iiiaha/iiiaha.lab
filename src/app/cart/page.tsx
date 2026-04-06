"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/types";

interface Coupon {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_amount?: number;
}

export default function CartPage() {
  const { items, removeItem, total } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplying(true);
    setCouponError("");

    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCouponError(data.error);
        setCoupon(null);
      } else {
        if (data.min_amount && total < data.min_amount) {
          setCouponError(`Minimum order amount: ${formatPrice(data.min_amount)}`);
          setCoupon(null);
        } else {
          setCoupon(data);
          setCouponError("");
        }
      }
    } catch {
      setCouponError("Failed to verify coupon");
    }
    setApplying(false);
  };

  const discount = coupon
    ? coupon.discount_type === "percent"
      ? Math.round(total * (coupon.discount_value / 100))
      : coupon.discount_value
    : 0;

  const finalTotal = Math.max(0, total - discount);

  if (items.length === 0) {
    return (
      <div>
        <div className="flex items-baseline justify-between mb-[10px]">
          <h1 className="text-[16px] font-bold tracking-[0.03em]">Cart</h1>
        </div>
        <div className="border-b border-[#111] mb-[72px] sticky-divider" />
        <div className="text-center py-20">
          <p className="text-[14px] text-[#999] mb-6">Your cart is empty.</p>
          <Link
            href="/extensions"
            className="text-[13px] text-[#111] border border-[#111] px-6 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors"
          >
            Browse Extensions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Cart</h1>
        <span className="text-[12px] text-[#999]">{items.length} items</span>
      </div>
      <div className="border-b border-[#111] mb-8 sticky-divider" />

      {/* Items */}
      <div className="border-t border-[#ddd]">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-b border-[#ddd] py-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {item.thumbnail_url && (
                <img src={item.thumbnail_url} alt="" className="w-10 h-10 object-contain bg-[#f5f5f5] shrink-0" />
              )}
              <div className="min-w-0">
                <Link href={`/extensions/${item.slug}`} className="text-[13px] font-bold no-underline hover:underline truncate block">
                  {item.name}
                </Link>
                <div className="flex items-center gap-2">
                  {(item.discount_percent ?? 0) > 0 && item.original_price ? (
                    <>
                      <span className="text-[12px] text-[#999] line-through">{formatPrice(item.original_price)}</span>
                      <span className="text-[13px] font-bold">{formatPrice(item.price)}</span>
                    </>
                  ) : (
                    <span className="text-[13px]">{formatPrice(item.price)}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => removeItem(item.id)}
              className="text-[11px] text-[#999] bg-transparent border-0 cursor-pointer hover:text-[#111] shrink-0 ml-3"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Coupon */}
      <div className="mt-6 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
            className="flex-1 border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111]"
          />
          <button
            onClick={applyCoupon}
            disabled={applying}
            className="text-[12px] border border-[#111] bg-transparent px-4 py-2 cursor-pointer hover:bg-[#111] hover:text-white transition-colors disabled:opacity-50"
          >
            Apply
          </button>
        </div>
        {couponError && <p className="text-[11px] text-red-600 mt-1">{couponError}</p>}
        {coupon && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-[12px] text-green-600">
              Coupon applied: {coupon.code} ({coupon.discount_type === "percent" ? `${coupon.discount_value}%` : formatPrice(coupon.discount_value)} off)
            </span>
            <button
              onClick={() => { setCoupon(null); setCouponCode(""); }}
              className="text-[11px] text-[#999] bg-transparent border-0 cursor-pointer hover:text-[#111]"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="border-t border-[#111] pt-4">
        <div className="flex justify-between text-[13px] mb-1">
          <span>Subtotal</span>
          <span>{formatPrice(total)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-[13px] text-red-600 mb-1">
            <span>Discount</span>
            <span>-{formatPrice(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[15px] font-bold mt-3 mb-6">
          <span>Total</span>
          <span>{formatPrice(finalTotal)}</span>
        </div>

        <button
          className="w-full bg-[#111] text-white text-[14px] font-bold tracking-[0.05em] py-3 border-0 cursor-pointer hover:bg-[#333] transition-colors duration-200"
        >
          Checkout &mdash; {formatPrice(finalTotal)}
        </button>
        <p className="text-[11px] text-[#999] text-center mt-2">
          Payment will be available soon.
        </p>
      </div>
    </div>
  );
}
