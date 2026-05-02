"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/types";
import { getUser } from "@/lib/auth";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
const PENDING_KEY = "iiiaha_pending_payment";

interface Coupon {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_amount?: number;
}

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, total } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [agreedVersion, setAgreedVersion] = useState(false);
  const [agreedOs, setAgreedOs] = useState(false);
  const [shakeAgreement, setShakeAgreement] = useState(false);

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

  const handleCheckout = async () => {
    setCheckoutError("");
    if (items.length === 0) return;
    if (finalTotal <= 0) {
      setCheckoutError("결제 금액이 올바르지 않습니다.");
      return;
    }
    if (!agreedVersion || !agreedOs) {
      setShakeAgreement(true);
      setTimeout(() => setShakeAgreement(false), 500);
      return;
    }

    setProcessing(true);
    try {
      const user = await getUser();
      if (!user) {
        router.push("/login?redirect=/cart");
        return;
      }

      const orderId = `order_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const orderName =
        items.length === 1
          ? items[0].name
          : `${items[0].name} 외 ${items.length - 1}건`;

      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          orderId,
          items: items.map((i) => ({ productId: i.id })),
          couponCode: coupon?.code,
          amount: finalTotal,
        })
      );

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({
        customerKey: user.id || ANONYMOUS,
      });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: finalTotal },
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user.email,
        customerName: user.user_metadata?.full_name ?? user.email?.split("@")[0],
        card: {
          useEscrow: false,
          flowMode: "DEFAULT",
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "결제 요청에 실패했습니다.";
      setCheckoutError(message);
      setProcessing(false);
    }
  };

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

        <label
          className={`flex items-start gap-2 mb-2 cursor-pointer select-none ${shakeAgreement && !agreedVersion ? "animate-shake" : ""}`}
        >
          <input
            type="checkbox"
            checked={agreedVersion}
            onChange={(e) => setAgreedVersion(e.target.checked)}
            className="mt-0.5 cursor-pointer"
          />
          <span className={`text-[11px] leading-relaxed transition-colors ${shakeAgreement && !agreedVersion ? "text-red-500" : "text-[#666]"}`}>
            익스텐션은 <b>SketchUp</b> 또는 <b>AutoCAD</b>의 특정 버전에서만 동작합니다. 상품 상세의 호환 버전을 확인하셨습니까?
          </span>
        </label>

        <label
          className={`flex items-start gap-2 mb-4 cursor-pointer select-none ${shakeAgreement && !agreedOs ? "animate-shake" : ""}`}
        >
          <input
            type="checkbox"
            checked={agreedOs}
            onChange={(e) => setAgreedOs(e.target.checked)}
            className="mt-0.5 cursor-pointer"
          />
          <span className={`text-[11px] leading-relaxed transition-colors ${shakeAgreement && !agreedOs ? "text-red-500" : "text-[#666]"}`}>
            모든 익스텐션은 <b>Windows</b> 환경에서 개발·검증되었으며, <b>macOS</b>에서는 일부 또는 전체 기능이 동작하지 않을 수 있습니다.
          </span>
        </label>

        <button
          onClick={handleCheckout}
          disabled={processing}
          className="w-full bg-[#111] text-white text-[14px] font-bold tracking-[0.05em] py-3 rounded border-0 cursor-pointer hover:bg-[#333] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? "결제창을 여는 중..." : `결제하기 — ${formatPrice(finalTotal)}`}
        </button>
        {checkoutError && (
          <p className="text-[11px] text-red-600 text-center mt-2">{checkoutError}</p>
        )}
        <p className="text-[11px] text-[#999] text-center mt-3">
          또는
        </p>

        {/* Subscription CTA */}
        <Link
          href="/subscribe"
          className="sub-cta group block no-underline mt-4 rounded overflow-hidden relative"
        >
          <div className="sub-cta-bg absolute inset-0" />
          <div className="sub-cta-aurora absolute inset-0" />
          <div className="text-center px-5 py-4 relative">
            <p className="text-[13px] font-bold tracking-[0.03em] text-white mb-1">
              이아하랩 멤버십 가입하기
            </p>
            <div className="text-[11px] font-normal text-[rgba(255,255,255,0.65)] mb-1">
              모든 익스텐션을 자유롭게 사용
            </div>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-[12px] text-[rgba(255,255,255,0.4)] line-through">
                ₩29,000
              </span>
              <p className="text-[17px] font-bold text-white tracking-wide">
                ₩24,900<span className="text-[12px] font-normal text-[rgba(255,255,255,0.5)]"> /month</span>
              </p>
            </div>
            <p className="text-[10px] text-[rgba(255,255,255,0.5)] mt-1">
              디버깅 기간 내 특가 · ~ 2026.07.31
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
