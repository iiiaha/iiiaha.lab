"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PaymentFailInner() {
  const params = useSearchParams();
  const code = params.get("code");
  const message = params.get("message");

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Payment</h1>
      </div>
      <div className="border-b border-[#111] mb-8 sticky-divider" />

      <div className="text-center py-20">
        <p className="text-[16px] font-bold mb-3">결제에 실패했습니다</p>
        {message && <p className="text-[13px] text-red-600 mb-1">{message}</p>}
        {code && <p className="text-[11px] text-[#999] mb-6">오류 코드: {code}</p>}
        <p className="text-[12px] text-[#999] mb-6 leading-[1.7]">
          결제가 승인되지 않았습니다.
          <br />
          다른 카드로 시도해 주시거나 카드 정보를 다시 확인해 주세요.
          <br />
          문제가 지속되면 contact@iiiahalab.com으로 문의해 주세요.
        </p>
        <div className="flex gap-2 justify-center">
          <Link
            href="/cart"
            className="text-[13px] bg-[#111] text-white px-6 py-2 no-underline hover:bg-[#333] transition-colors"
          >
            장바구니로
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-[14px] text-[#999]">...</div>
      }
    >
      <PaymentFailInner />
    </Suspense>
  );
}
