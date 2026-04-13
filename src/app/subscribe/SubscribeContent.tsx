"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { Product, formatPrice } from "@/lib/types";
import PurchaseInfo from "@/components/PurchaseInfo";
import { getUser } from "@/lib/auth";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
const PENDING_KEY = "iiiaha_pending_billing";

const MONTHLY_REGULAR = 29000;
const MONTHLY_PRICE = 24900;
const ANNUAL_PRICE = 420000;
const ANNUAL_MONTHLY = Math.round(ANNUAL_PRICE / 12);

type Plan = "monthly" | "annual";

export default function SubscribeContent({
  extensions,
  totalPrice,
}: {
  extensions: Product[];
  totalPrice: number;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>("annual");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleSubscribe = async () => {
    setError("");
    setProcessing(true);
    try {
      const user = await getUser();
      if (!user) {
        router.push("/login?redirect=/subscribe");
        return;
      }

      const amount = plan === "annual" ? ANNUAL_PRICE : MONTHLY_PRICE;

      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ plan, amount })
      );

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({
        customerKey: user.id || ANONYMOUS,
      });

      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${window.location.origin}/billing/success`,
        failUrl: `${window.location.origin}/billing/fail`,
        customerEmail: user.email,
        customerName:
          (user.user_metadata as { full_name?: string } | null)?.full_name ??
          user.email?.split("@")[0],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "구독 요청에 실패했습니다.";
      setError(message);
      setProcessing(false);
    }
  };

  const savingsVsBuy = plan === "monthly"
    ? totalPrice - MONTHLY_PRICE
    : totalPrice - ANNUAL_PRICE;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Subscribe</h1>
      </div>
      <div className="border-b border-[#111] mb-8 sticky-divider" />

      {/* Hero */}
      <div className="text-center py-10 mb-8">
        <p className="text-[13px] text-[#999] tracking-[0.1em] uppercase mb-4">
          iiiaha.lab subscription
        </p>
        <h2 className="text-[22px] font-bold tracking-[-0.01em] mb-3">
          All {extensions.length} Extensions. One Plan.
        </h2>
        <p className="text-[14px] text-[#666] max-w-[400px] mx-auto">
          개별 구매 시 총 {formatPrice(totalPrice)}인 모든 익스텐션을<br />
          월 구독으로 자유롭게 이용하세요.
        </p>
      </div>

      {/* Plan Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex border border-[#ddd]">
          <button
            onClick={() => setPlan("monthly")}
            className={`text-[13px] tracking-[0.03em] px-6 py-2.5 border-0 cursor-pointer transition-colors ${
              plan === "monthly"
                ? "bg-[#111] text-white font-bold"
                : "bg-white text-[#666] hover:text-[#111]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPlan("annual")}
            className={`text-[13px] tracking-[0.03em] px-6 py-2.5 border-0 cursor-pointer transition-colors ${
              plan === "annual"
                ? "bg-[#111] text-white font-bold"
                : "bg-white text-[#666] hover:text-[#111]"
            }`}
          >
            Annual
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-2 gap-4 mb-10 max-sm:grid-cols-1">
        {/* Individual Purchase */}
        <div className="border border-[#ddd] p-6">
          <p className="text-[11px] text-[#999] tracking-[0.1em] uppercase mb-4">
            Individual
          </p>
          <p className="text-[22px] font-bold mb-1">
            {formatPrice(totalPrice)}
          </p>
          <p className="text-[12px] text-[#999] mb-6">
            {extensions.length}개 전체 개별 구매 시
          </p>
          <div className="border-t border-[#eee] pt-4 flex flex-col gap-2.5">
            <Row label="영구 소유" />
            <Row label="기기 1대" />
            <Row label="개별 업데이트" />
            <Row label="필요한 것만 구매 가능" />
          </div>
          <div className="mt-6">
            <Link
              href="/extensions"
              className="block w-full text-[13px] text-[#111] border border-[#111] py-3 text-center no-underline hover:bg-[#111] hover:text-white transition-colors"
            >
              Browse Extensions
            </Link>
          </div>
        </div>

        {/* Subscription */}
        <div className="border-2 border-[#111] p-6 relative">
          <p className="text-[11px] text-[#999] tracking-[0.1em] uppercase mb-4">
            Subscription
          </p>
          {plan === "annual" ? (
            <>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-[22px] font-bold">
                  {formatPrice(ANNUAL_PRICE)}
                </p>
                <span className="text-[12px] text-[#999]">/year</span>
              </div>
              <p className="text-[12px] text-[#999] mb-6">
                월 {formatPrice(ANNUAL_MONTHLY)}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[14px] text-[#ccc] line-through">
                  {formatPrice(MONTHLY_REGULAR)}
                </span>
                <p className="text-[22px] font-bold text-red-600">
                  {formatPrice(MONTHLY_PRICE)}
                </p>
                <span className="text-[12px] text-[#999]">/month</span>
              </div>
              <p className="text-[11px] text-red-600 font-bold mb-6">
                디버깅 시즌 {Math.round((1 - MONTHLY_PRICE / MONTHLY_REGULAR) * 100)}% 할인 · ~ 2026.07.31
              </p>
            </>
          )}
          <div className="border-t border-[#eee] pt-4 flex flex-col gap-2.5">
            <Row label="모든 익스텐션 이용" bold />
            <Row label="신규 익스텐션 자동 포함" bold />
            <Row label="기기 1대" />
            <Row label="구독 기간 중 업데이트 포함" />
          </div>
          <div className="mt-6">
            <button
              onClick={handleSubscribe}
              disabled={processing}
              className="w-full bg-[#111] text-white text-[13px] font-bold tracking-[0.05em] py-3 border-0 cursor-pointer hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing
                ? "결제창을 여는 중..."
                : `Subscribe — ${plan === "annual" ? formatPrice(ANNUAL_PRICE) : `${formatPrice(MONTHLY_PRICE)}/mo`}`}
            </button>
            {error && (
              <p className="text-[11px] text-red-600 text-center mt-2">{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Extension List */}
      <div className="mb-10">
        <p className="text-[11px] text-[#999] tracking-[0.1em] uppercase mb-4">
          Included Extensions
        </p>
        <div className="border-t border-[#ddd]">
          {extensions.map((ext) => (
            <Link
              key={ext.slug}
              href={`/extensions/${ext.slug}`}
              className="flex items-center justify-between border-b border-[#ddd] py-2.5 no-underline hover:bg-[#fafafa] transition-colors px-1"
            >
              <div className="flex items-center gap-3">
                {ext.thumbnail_url && (
                  <img
                    src={ext.thumbnail_url}
                    alt=""
                    className="w-7 h-7 object-contain bg-[#f5f5f5] shrink-0"
                  />
                )}
                <span className="text-[13px] font-bold">{ext.name}</span>
                {ext.subtitle && (
                  <span className="text-[11px] text-[#999] max-sm:hidden">{ext.subtitle}</span>
                )}
              </div>
              <span className="text-[12px] text-[#999] shrink-0">
                {formatPrice(ext.price)}
              </span>
            </Link>
          ))}
        </div>
        <div className="flex justify-between pt-3 px-1">
          <span className="text-[13px] font-bold">Total if purchased individually</span>
          <span className="text-[13px] font-bold">{formatPrice(totalPrice)}</span>
        </div>
      </div>

      <PurchaseInfo variant="subscription" />

      {/* FAQ */}
      <div className="mt-10 mb-10">
        <p className="text-[11px] text-[#999] tracking-[0.1em] uppercase mb-4">
          FAQ
        </p>
        <div className="border-t border-[#ddd]">
          <FaqItem
            q="구독을 해지하면 어떻게 되나요?"
            a="구독 기간이 끝나면 익스텐션 사용이 중지됩니다. 이미 작업한 파일에는 영향이 없습니다."
          />
          <FaqItem
            q="기기를 변경하고 싶으면 어떻게 하나요?"
            a="스케치업 익스텐션 내에서 기기 해제 후, 새 기기에서 다시 활성화하면 됩니다."
          />
          <FaqItem
            q="새로운 익스텐션이 추가되면요?"
            a="구독 기간 중 새로 출시되는 익스텐션도 추가 비용 없이 바로 사용할 수 있습니다."
          />
          <FaqItem
            q="개별 구매에서 구독으로 전환할 수 있나요?"
            a="네, 언제든 구독을 시작할 수 있습니다. 이미 구매한 익스텐션은 구독 여부와 관계없이 영구적으로 사용 가능합니다."
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, bold }: { label: string; bold?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] text-[#999] mt-0.5">—</span>
      <span className={`text-[13px] ${bold ? "font-bold text-[#111]" : "text-[#666]"}`}>
        {label}
      </span>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-b border-[#ddd] py-4">
      <p className="text-[13px] font-bold mb-1.5">{q}</p>
      <p className="text-[13px] text-[#666]">{a}</p>
    </div>
  );
}
