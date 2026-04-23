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
const ANNUAL_PRICE = 300000;
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
  const [plan, setPlan] = useState<Plan>("monthly");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

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
      const message = err instanceof Error ? err.message : "멤버십 요청에 실패했습니다.";
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
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Membership</h1>
      </div>
      <div className="border-b border-[#111] mb-8 sticky-divider" />

      {/* Hero */}
      <div className="text-center py-10 mb-8">
        <p className="text-[13px] text-[#999] tracking-[0.1em] uppercase mb-4">
          iiiahalab membership
        </p>
        <h2 className="text-[22px] font-bold tracking-[-0.01em] mb-3">
          All Extensions. One Plan.
        </h2>
        <p className="text-[14px] text-[#666] max-w-[400px] mx-auto">
          개별 구매 시 총 {formatPrice(totalPrice)}인 모든 익스텐션을<br />
          멤버십으로 자유롭게 이용하세요.
        </p>
      </div>

      {/* Plan Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-[#f5f5f5] rounded-full p-1">
          <button
            onClick={() => setPlan("monthly")}
            className={`text-[12px] font-bold tracking-[0.05em] px-6 py-1.5 rounded-full border-0 cursor-pointer transition-colors ${
              plan === "monthly"
                ? "bg-[#111] text-white"
                : "bg-transparent text-[#999] hover:text-[#666]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPlan("annual")}
            className={`text-[12px] font-bold tracking-[0.05em] px-6 py-1.5 rounded-full border-0 cursor-pointer transition-colors ${
              plan === "annual"
                ? "bg-[#111] text-white"
                : "bg-transparent text-[#999] hover:text-[#666]"
            }`}
          >
            Annual
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-2 gap-4 mb-10 max-sm:grid-cols-1">
        {/* Individual Purchase */}
        <div className="border border-[#ddd] p-6 flex flex-col">
          <div className="min-h-[120px]">
            <p className="text-[11px] text-[#999] tracking-[0.1em] uppercase mb-4">
              Individual
            </p>
            <p className="text-[22px] font-bold mb-1">
              {formatPrice(totalPrice)}
            </p>
            <p className="text-[12px] text-[#999]">
              {extensions.length}개 전체 개별 구매 시
            </p>
          </div>
          <div className="border-t border-[#eee] pt-4 mt-4 flex flex-col gap-2.5 flex-1">
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
        <div className="sub-cta relative overflow-hidden flex flex-col border border-transparent">
          <div className="sub-cta-bg absolute inset-0" />
          <div className="sub-cta-aurora absolute inset-0" />
          <div className="relative p-6 flex flex-col flex-1">
            <div className="min-h-[120px]">
              <p className="text-[11px] text-[rgba(255,255,255,0.5)] tracking-[0.1em] uppercase mb-4">
                Membership
              </p>
              {plan === "annual" ? (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <p className="text-[22px] font-bold text-white">
                      {formatPrice(ANNUAL_PRICE)}
                    </p>
                    <span className="text-[12px] text-[rgba(255,255,255,0.5)]">/year</span>
                  </div>
                  <p className="text-[12px] text-[rgba(255,255,255,0.6)]">
                    월 {formatPrice(ANNUAL_MONTHLY)}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[14px] text-[rgba(255,255,255,0.4)] line-through">
                      {formatPrice(MONTHLY_REGULAR)}
                    </span>
                    <p className="text-[22px] font-bold text-white">
                      {formatPrice(MONTHLY_PRICE)}
                    </p>
                    <span className="text-[12px] text-[rgba(255,255,255,0.5)]">/month</span>
                  </div>
                  <p className="text-[11px] text-white font-bold mb-1">
                    디버깅 기간 내 {Math.round((1 - MONTHLY_PRICE / MONTHLY_REGULAR) * 100)}% 할인 · ~ 2026.07.31
                  </p>
                  <p className="text-[11px] text-[rgba(255,255,255,0.55)]">
                    디버깅 기간 이후에도 해지 전까지는 같은 가격으로 결제됩니다.
                  </p>
                </>
              )}
            </div>
            <div className="border-t border-[rgba(255,255,255,0.18)] pt-4 mt-4 flex flex-col gap-2.5 flex-1">
              <Row label="모든 익스텐션 이용" bold dark />
              <Row label="신규 익스텐션 자동 포함" bold dark />
              <Row label="기기 1대" dark />
              <Row label="멤버십 기간 중 업데이트 포함" dark />
            </div>
            <div className="mt-6">
              <label className="flex items-start gap-2 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <span className="text-[10px] text-[rgba(255,255,255,0.6)] leading-relaxed">
                  본 익스텐션은 <b>SketchUp 2021 이상</b>에서만 동작합니다. 사용 중인 스케치업 버전을 확인하셨습니까?
                </span>
              </label>
              <button
                onClick={handleSubscribe}
                disabled={processing || !agreed}
                className="w-full bg-white text-[#111] text-[13px] font-bold tracking-[0.05em] py-3 border-0 cursor-pointer hover:bg-[rgba(255,255,255,0.85)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing
                  ? "결제창을 여는 중..."
                  : `Subscribe — ${plan === "annual" ? formatPrice(ANNUAL_PRICE) : `${formatPrice(MONTHLY_PRICE)}/mo`}`}
              </button>
              {error && (
                <p className="text-[11px] text-red-300 text-center mt-2">{error}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Extension Grid */}
      <div className="mb-10">
        <p className="text-[11px] text-[#999] tracking-[0.1em] uppercase mb-4">
          Included Extensions
          <span className="ml-2 text-[#ccc] font-normal normal-case tracking-normal">
            {extensions.length}개
          </span>
        </p>
        <div className="grid grid-cols-5 gap-3 max-sm:grid-cols-3">
          {extensions.map((ext) => (
            <Link
              key={ext.slug}
              href={`/extensions/${ext.slug}`}
              title={ext.name}
              className="group no-underline"
            >
              <div className="aspect-square bg-[#f5f5f5] border border-[#ddd] flex items-center justify-center p-[20%]">
                {ext.thumbnail_url ? (
                  <img
                    src={ext.thumbnail_url}
                    alt={ext.name}
                    className="w-full h-full object-contain group-hover:opacity-85 transition-opacity duration-200"
                  />
                ) : (
                  <span className="text-[10px] text-[#999] text-center">
                    {ext.name}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#666] text-center mt-1.5 truncate group-hover:text-[#111]">
                {ext.name}
              </p>
            </Link>
          ))}
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
            q="디버깅 기간이 끝나면 멤버십 가격도 오르나요?"
            a="아니요. 가입 시점의 가격이 해지 전까지 그대로 유지됩니다. 8월 1일 이후 신규 가입자에게만 정상가가 적용됩니다."
          />
          <FaqItem
            q="멤버십을 해지하면 어떻게 되나요?"
            a="멤버십 기간이 끝나면 익스텐션 사용이 중지됩니다. 이미 작업한 파일에는 영향이 없습니다."
          />
          <FaqItem
            q="기기를 변경하고 싶으면 어떻게 하나요?"
            a="contact@iiiahalab.com으로 문의해 주시면 이전 기기 바인딩을 해제해 드립니다."
          />
          <FaqItem
            q="새로운 익스텐션이 추가되면요?"
            a="멤버십 기간 중 새로 출시되는 익스텐션도 추가 비용 없이 바로 사용할 수 있습니다."
          />
          <FaqItem
            q="개별 구매에서 멤버십으로 전환할 수 있나요?"
            a="네, 언제든 멤버십을 시작할 수 있습니다. 이미 구매한 익스텐션은 멤버십 여부와 관계없이 영구적으로 사용 가능합니다."
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, bold, dark }: { label: string; bold?: boolean; dark?: boolean }) {
  if (dark) {
    return (
      <div className="flex items-start gap-2">
        <span className="text-[11px] text-[rgba(255,255,255,0.4)] mt-0.5">—</span>
        <span
          className={`text-[13px] ${
            bold
              ? "font-bold text-white"
              : "text-[rgba(255,255,255,0.75)]"
          }`}
        >
          {label}
        </span>
      </div>
    );
  }
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
