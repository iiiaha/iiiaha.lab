"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface PendingBilling {
  plan: "monthly" | "annual";
  amount: number;
}

const STORAGE_KEY = "iiiaha_pending_billing";

function BillingSuccessInner() {
  const params = useSearchParams();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string>("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const authKey = params.get("authKey");
    const customerKey = params.get("customerKey");

    if (!authKey || !customerKey) {
      setError("멤버십 인증 정보가 올바르지 않습니다.");
      setState("error");
      return;
    }

    let pending: PendingBilling | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) pending = JSON.parse(raw);
    } catch {}

    if (!pending) {
      setError(
        "멤버십 세션을 찾을 수 없습니다. 결제는 진행되지 않았으니 멤버십 페이지로 돌아가 다시 시도해 주세요."
      );
      setState("error");
      return;
    }

    const run = async () => {
      try {
        const res = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authKey,
            customerKey,
            plan: pending!.plan,
            amount: pending!.amount,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "멤버십 결제에 실패했습니다.");
          setState("error");
          return;
        }
        setState("success");
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        setError("네트워크 오류로 멤버십 처리에 실패했습니다.");
        setState("error");
      }
    };
    run();
  }, [params]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Membership</h1>
      </div>
      <div className="border-b border-[#111] mb-8 sticky-divider" />

      {state === "loading" && (
        <div className="text-center py-20 text-[14px] text-[#999]">
          멤버십을 처리하고 있습니다...
        </div>
      )}

      {state === "error" && (
        <div className="text-center py-20">
          <p className="text-[14px] text-red-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/subscribe"
              className="text-[13px] border border-[#111] px-6 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors"
            >
              멤버십 페이지로
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
            <p className="text-[22px] font-bold mb-3">멤버십이 시작되었습니다</p>
            <p className="text-[12px] text-[#999] mt-6 leading-[1.8]">
              모든 익스텐션 라이선스가 발급되었습니다.
              <br />
              <strong className="text-[#111]">마이페이지</strong>에서 확인하실 수
              있습니다.
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
              익스텐션 둘러보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-[14px] text-[#999]">...</div>
      }
    >
      <BillingSuccessInner />
    </Suspense>
  );
}
