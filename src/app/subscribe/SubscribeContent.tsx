"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { Product, formatPrice } from "@/lib/types";
import PurchaseInfo from "@/components/PurchaseInfo";
import { getUser } from "@/lib/auth";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY!;
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
  const [shakeAgreement, setShakeAgreement] = useState(false);

  const handleSubscribe = async () => {
    setError("");
    if (!agreed) {
      setShakeAgreement(true);
      setTimeout(() => setShakeAgreement(false), 500);
      return;
    }
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

  const sketchupCount = extensions.filter((e) => e.platform === "sketchup").length;
  const autocadCount = extensions.filter((e) => e.platform === "autocad").length;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Membership</h1>
      </div>
      <div className="border-b border-[#111] mb-8 sticky-divider" />

      {/* Hero */}
      <div className="text-center py-10 mb-6">
        <h2 className="text-[23px] font-bold tracking-[-0.01em] text-[#111] leading-[1.45] mb-1">
          똑똑하게 일하고,<br />
          당신의 시간을 되찾으세요.
        </h2>
        <p className="text-[11px] text-[#bbb] italic tracking-[0.03em] mb-10">
          Work Smart. Save Your Youth.
        </p>

        <p className="text-[15px] text-[#333] leading-[1.9] mb-6">
          이아하랩은 실무경험을 바탕으로 디자이너를 위한 플러그인을 개발합니다.<br />
          그 어디서도 경험해보지 못한 이아하랩만의 깊은 인사이트를 느껴보세요.<br />
          여러분의 생산성에 날개를 달아드리겠습니다.
        </p>
        <p className="text-[15px] text-[#333] leading-[1.9]">
          상위 1% 생산성 도구와 함께 당신의 가치를 올리세요.
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
              개별 구매 시
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
              제품 페이지로 이동
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
                멤버십 이용 시
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
              <label
                className={`flex items-start gap-2 mb-3 cursor-pointer select-none ${shakeAgreement ? "animate-shake" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <span className={`text-[10px] leading-relaxed transition-colors ${shakeAgreement ? "text-red-300" : "text-[rgba(255,255,255,0.6)]"}`}>
                  익스텐션은 <b>SketchUp</b> 또는 <b>AutoCAD</b>의 특정 버전에서만 동작합니다. 상품 상세의 호환 버전을 확인하셨습니까?
                </span>
              </label>
              <button
                onClick={handleSubscribe}
                disabled={processing}
                className="w-full bg-white text-[#111] text-[13px] font-bold tracking-[0.05em] py-3 border-0 cursor-pointer hover:bg-[rgba(255,255,255,0.85)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing
                  ? "결제창을 여는 중..."
                  : `멤버십 가입하기 — ${plan === "annual" ? `${formatPrice(ANNUAL_PRICE)}/yr` : `${formatPrice(MONTHLY_PRICE)}/mo`}`}
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
          멤버십에 포함된 익스텐션
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
            q="앞으로도 새로운 익스텐션이 계속 추가되나요?"
            a="네, 계속해서 추가될 예정입니다. 아이디어가 있으시면 언제든 Open Lab에 남겨주세요. 좋은 아이디어가 있다면 직접 개발해보겠습니다."
          />
          <FaqItem
            q="새로운 익스텐션이 추가되면 멤버십 비용이 오르나요?"
            a="그럴 확률이 높습니다. 다만, 가격이 오르더라도 신규 가입자에 한해 적용되며, 기존 사용자는 가입 시점의 멤버십 가격이 해지 전까지 그대로 유지됩니다."
          />
          <FaqItem
            q="새로운 익스텐션이 추가되면 기존 멤버십 사용자들도 사용할 수 있나요?"
            a="네, 멤버십 기간 중 새로 출시되는 익스텐션도 추가 비용 없이 바로 사용할 수 있습니다."
          />
          <FaqItem
            q="이미 몇 가지 익스텐션을 개별 구매했는데, 멤버십에 가입해도 되나요?"
            a="네, 언제든 멤버십을 시작할 수 있습니다. 이미 구매한 익스텐션은 멤버십 여부와 관계없이 영구적으로 사용 가능합니다. 다만, 구매한 익스텐션이 있다고 해서 멤버십 가격이 변동되지는 않습니다."
          />
          <FaqItem
            q="멤버십을 해지하면 어떻게 되나요?"
            a="해지하셔도 멤버십 기간이 끝날 때까지는 라이선스가 유지되어 익스텐션을 계속 사용할 수 있습니다. 기간이 끝나는 시점에 모든 익스텐션 접근이 차단됩니다."
          />
          <FaqItem
            q="이미 라이선스 키를 등록했는데, 다른 컴퓨터에서도 익스텐션을 사용하고 싶어요."
            a="익스텐션은 기기당 1대에만 라이선스를 등록할 수 있습니다. 기기를 바꾸고 싶으시면 contact@iiiahalab.com으로 연락 주세요. 이전 기기의 바인딩을 해제해 드리며, 그 후 새 기기에 라이선스 키를 다시 등록하시면 됩니다."
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
