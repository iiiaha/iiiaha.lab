"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/types";

interface PendingPayment {
  orderId: string;
  items: { productId: string }[];
  couponCode?: string;
  amount: number;
}

const STORAGE_KEY = "iiiaha_pending_payment";

function PaymentSuccessInner() {
  const params = useSearchParams();
  const { clear } = useCart();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [totalPaid, setTotalPaid] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amountStr = params.get("amount");

    if (!paymentKey || !orderId || !amountStr) {
      setError("결제 정보가 올바르지 않습니다.");
      setState("error");
      return;
    }
    const amount = Number(amountStr);

    let pending: PendingPayment | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) pending = JSON.parse(raw);
    } catch {}

    if (!pending || pending.orderId !== orderId) {
      setError(
        "결제 세션을 찾을 수 없습니다. 결제는 완료되었을 수 있으니 마이페이지에서 주문 내역을 확인해 주세요."
      );
      setState("error");
      return;
    }

    const run = async () => {
      try {
        const res = await fetch("/api/payment/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount,
            items: pending!.items,
            couponCode: pending!.couponCode,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "결제 승인에 실패했습니다.");
          setState("error");
          return;
        }
        setTotalPaid(data.total ?? amount);
        setState("success");
        localStorage.removeItem(STORAGE_KEY);
        clear();
      } catch {
        setError("네트워크 오류로 결제 승인에 실패했습니다.");
        setState("error");
      }
    };
    run();
  }, [params, clear]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Payment</h1>
      </div>
      <div className="border-b border-[#111] mb-8 sticky-divider" />

      {state === "loading" && (
        <div className="text-center py-20 text-[14px] text-[#999]">
          결제를 확인하고 있습니다...
        </div>
      )}

      {state === "error" && (
        <div className="text-center py-20">
          <p className="text-[14px] text-red-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/cart"
              className="text-[13px] border border-[#111] px-6 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors"
            >
              장바구니로
            </Link>
            <Link
              href="/mypage"
              className="text-[13px] border border-[#111] px-6 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors"
            >
              마이페이지
            </Link>
          </div>
        </div>
      )}

      {state === "success" && (
        <div>
          <div className="text-center py-16 mb-6">
            <p className="text-[22px] font-bold mb-3">결제가 완료되었습니다</p>
            <p className="text-[13px] text-[#666] mb-1">
              총 결제 금액: {formatPrice(totalPaid)}
            </p>
            <p className="text-[12px] text-[#999] mt-6 leading-[1.8]">
              발급된 라이선스 키는 <strong className="text-[#111]">마이페이지</strong>에서
              확인하실 수 있습니다.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/mypage"
              className="flex-1 text-center text-[13px] bg-[#111] text-white py-3 no-underline hover:bg-[#333] transition-colors"
            >
              마이페이지로
            </Link>
            <Link
              href="/extensions"
              className="flex-1 text-center text-[13px] border border-[#111] py-3 no-underline hover:bg-[#111] hover:text-white transition-colors"
            >
              쇼핑 계속하기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-[14px] text-[#999]">...</div>
      }
    >
      <PaymentSuccessInner />
    </Suspense>
  );
}
