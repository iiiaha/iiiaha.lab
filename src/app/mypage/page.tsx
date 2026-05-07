"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { getUser, signOut } from "@/lib/auth";
import { createClient } from "@/lib/supabase";
import { formatPrice } from "@/lib/types";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY!;
const PENDING_KEY = "iiiaha_pending_billing";

// cron/route.ts의 GRACE_DAYS와 일치해야 함
const GRACE_DAYS = 3;

interface Subscription {
  id: string;
  plan: "monthly" | "annual";
  status: "active" | "cancelled" | "expired" | "past_due";
  started_at: string;
  expires_at: string;
  cancel_at_period_end: boolean;
  last_charged_at: string | null;
  billing_key: string | null;
  card_company: string | null;
  card_number_masked: string | null;
}

function formatCardLabel(sub: Subscription): string | null {
  // 관리자 무상 발급은 billing_key가 없음
  if (!sub.billing_key) return "관리자 부여 (무상)";
  if (!sub.card_number_masked) return null;
  const digits = sub.card_number_masked.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  const company = sub.card_company ? `${sub.card_company} ` : "";
  return `${company}****${last4}`;
}

interface OrderWithProduct {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  product_id: string;
  subscription_id: string | null;
  payment_key: string | null;
  download_acknowledged_at: string | null;
  products: {
    slug: string;
    name: string;
    version: string | null;
    thumbnail_url: string | null;
  };
  licenses: { license_key: string; hwid: string | null; status: string }[];
}

const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// 환불 불가 사유. null이면 환불 가능.
function refundDisabledReason(order: OrderWithProduct): string | null {
  if (order.status !== "paid") return "결제 완료 상태 아님";
  if (order.subscription_id) return "멤버십으로 발급된 라이선스는 멤버십 해지를 통해서만 환불됩니다";
  if (order.payment_key?.startsWith("admin")) return "관리자 무상 발급은 환불 대상이 아닙니다";
  if ((order.amount || 0) <= 0) return "환불할 금액이 없습니다";
  const age = Date.now() - new Date(order.created_at).getTime();
  if (age > REFUND_WINDOW_MS) return "환불 가능 기간(7일)이 지났습니다";
  if (order.download_acknowledged_at) return "다운로드 후에는 환불할 수 없습니다";
  return null;
}

interface VersionInfo {
  latest: string | null;
  releasedAt: string | null;
  isNew: boolean;
  latestChangelog: string | null;
}

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function formatReleasedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function VersionDisplay({ ver }: { ver: VersionInfo }) {
  const [open, setOpen] = useState(false);
  if (!ver.latest) return null;
  return (
    <div className="flex flex-col gap-1 min-w-0 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[12px] ${ver.isNew ? "font-bold text-[#008a75]" : "text-[#999]"}`}>
          v{ver.latest}
          {ver.releasedAt && (
            <span className={ver.isNew ? "text-[#008a75]" : "text-[#999]"}>
              {" · "}
              {formatReleasedAt(ver.releasedAt)}
            </span>
          )}
        </span>
        {ver.isNew && (
          <span className="text-[10px] font-bold tracking-[0.05em] text-[#008a75] bg-[#00c9a7]/15 px-1.5 py-0.5">
            NEW
          </span>
        )}
        {ver.latestChangelog && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] text-[#666] bg-transparent border-0 p-0 cursor-pointer hover:text-[#111] underline"
          >
            {open ? "변경사항 접기" : "변경사항 보기"}
          </button>
        )}
      </div>
      {open && ver.latestChangelog && (
        <pre className="text-[11px] text-[#333] whitespace-pre-wrap font-mono leading-[1.6] mt-1 bg-[#fafafa] border border-[#eee] px-3 py-2 m-0">
          {ver.latestChangelog}
        </pre>
      )}
    </div>
  );
}

function LicenseKeyDisplay({ licenseKey }: { licenseKey: string }) {
  const [visible, setVisible] = useState(false);
  const masked = licenseKey.replace(/[A-Z0-9]/g, "•");

  return (
    <div className="flex items-center gap-2">
      <code className="text-[12px] bg-[#f5f5f5] px-2 py-0.5 select-all tracking-wider">
        {visible ? licenseKey : masked}
      </code>
      <button
        onClick={() => setVisible(!visible)}
        className="bg-transparent border-0 p-0.5 cursor-pointer text-[#999] hover:text-[#111]"
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}

export default function MyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [versions, setVersions] = useState<Record<string, VersionInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? "");
      const supabase = createClient();

      // 구독 조회 (active, past_due, expired 모두)
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "past_due", "expired"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subData) setSubscription(subData as Subscription);

      const { data } = await supabase
        .from("orders")
        .select(
          "id, amount, status, created_at, product_id, subscription_id, payment_key, download_acknowledged_at, products(slug, name, version, thumbnail_url), licenses(license_key, hwid, status)"
        )
        .eq("user_id", user.id)
        .eq("status", "paid")
        .order("created_at", { ascending: false });

      const allOrders = (data as unknown as OrderWithProduct[]) ?? [];
      // 같은 제품이 구매+구독 둘 다 있으면 구매 건만 표시
      const seen = new Map<string, OrderWithProduct>();
      for (const order of allOrders) {
        const pid = order.product_id;
        const existing = seen.get(pid);
        if (!existing) {
          seen.set(pid, order);
        } else if (order.subscription_id && !existing.subscription_id) {
          // 기존이 개별구매, 새로운게 구독 → 개별구매 유지
        } else if (!order.subscription_id && existing.subscription_id) {
          // 기존이 구독, 새로운게 개별구매 → 개별구매로 교체
          seen.set(pid, order);
        }
      }
      const orderList = Array.from(seen.values());
      setOrders(orderList);

      // 가장 최신 버전의 changelog + released_at 한 번에 조회 (제품당 1행).
      // 사용자 설치 여부는 다운로더가 관리하므로 마이페이지는 "내가 릴리즈한 최신 버전"만 표시.
      const productIds = Array.from(new Set(orderList.map((o) => o.product_id)));
      const latestPvByProduct = new Map<string, { changelog: string | null; releasedAt: string | null }>();
      if (productIds.length > 0) {
        const { data: pvRows } = await supabase
          .from("product_versions")
          .select("product_id, changelog, released_at")
          .in("product_id", productIds)
          .order("released_at", { ascending: false });
        for (const row of pvRows ?? []) {
          if (!latestPvByProduct.has(row.product_id)) {
            latestPvByProduct.set(row.product_id, {
              changelog: row.changelog ?? null,
              releasedAt: row.released_at ?? null,
            });
          }
        }
      }

      const now = Date.now();
      const versionMap: Record<string, VersionInfo> = {};
      for (const order of orderList) {
        const slug = order.products?.slug;
        if (!slug) continue;
        const latest = order.products?.version ?? null;
        const pv = latestPvByProduct.get(order.product_id);
        const releasedAt = pv?.releasedAt ?? null;
        const isNew = !!(releasedAt && now - new Date(releasedAt).getTime() <= NEW_WINDOW_MS);
        versionMap[order.id] = {
          latest,
          releasedAt,
          isNew,
          latestChangelog: pv?.changelog ?? null,
        };
      }
      setVersions(versionMap);
      setLoading(false);
    };
    load();
  }, [router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleDownload = async (order: OrderWithProduct) => {
    const slug = order.products?.slug;
    if (!slug) return;

    // 구독/관리자 발급은 바로 다운로드 (환불 대상 아님)
    const skipConfirm =
      !!order.subscription_id ||
      order.payment_key?.startsWith("admin") ||
      !!order.download_acknowledged_at;

    if (!skipConfirm) {
      const ok = confirm(
        "설치파일을 다운로드하면 이 주문의 환불이 더 이상 불가합니다.\n\n" +
          "다운로드를 진행하시겠습니까?"
      );
      if (!ok) return;

      try {
        await fetch("/api/orders/acknowledge-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: order.id }),
        });
      } catch {
        // 실패해도 다운로드는 진행 (서버에서 다음 번에 다시 시도 가능)
      }
    }

    window.location.href = `/api/download/${slug}`;
    // UI 상태 갱신 (다운로드가 브라우저에서 진행되는 동안)
    setTimeout(() => {
      router.refresh();
    }, 1500);
  };

  const handleRefund = async (order: OrderWithProduct) => {
    const name = order.products?.name ?? "상품";
    if (
      !confirm(
        `${name} 주문을 환불 요청하시겠습니까?\n\n` +
          `· ₩${order.amount.toLocaleString("ko-KR")}이 결제 수단으로 환불됩니다\n` +
          `· 라이선스가 즉시 revoke됩니다\n` +
          `· 되돌릴 수 없습니다`
      )
    )
      return;

    try {
      const res = await fetch("/api/orders/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`환불이 완료되었습니다. (₩${data.refunded_amount.toLocaleString("ko-KR")})`);
        window.location.reload();
      } else {
        alert(data.error || "환불 처리에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    if (
      !confirm(
        "구독을 해지하시겠습니까? 현재 결제 기간이 끝나는 날까지는 계속 이용하실 수 있습니다."
      )
    )
      return;
    try {
      const res = await fetch("/api/subscribe/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "해지에 실패했습니다.");
        return;
      }
      setSubscription({ ...subscription, cancel_at_period_end: true });
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleResumeSubscription = async () => {
    if (!subscription) return;
    if (
      !confirm(
        "멤버십 해지를 취소하시겠습니까? 다음 결제일에 자동결제가 다시 진행됩니다."
      )
    )
      return;
    try {
      const res = await fetch("/api/subscribe/resume", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "해지 취소에 실패했습니다.");
        return;
      }
      setSubscription({ ...subscription, cancel_at_period_end: false });
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleUpdatePaymentMethod = async () => {
    try {
      const user = await getUser();
      if (!user) {
        router.push("/login?redirect=/mypage");
        return;
      }
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ mode: "update_method" })
      );
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: user.id });
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
      const message =
        err instanceof Error ? err.message : "결제수단 변경 창을 여는 데 실패했습니다.";
      alert(message);
    }
  };

  if (loading)
    return (
      <div className="pt-20 text-center text-[14px] text-[#999]">
        Loading...
      </div>
    );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">My Page</h1>
        <button
          onClick={handleSignOut}
          className="text-[12px] text-[#999] bg-transparent border-0 cursor-pointer hover:underline"
        >
          로그아웃
        </button>
      </div>
      <div className="border-b border-[#111] mb-5 sticky-divider" />

      {/* Account info — 이메일 + 멤버십 상태 통합 */}
      <div className="border border-[#ddd] p-5 mb-10">
        <h2 className="text-[13px] font-bold tracking-[0.03em] mb-4">계정 정보</h2>

        <div className="flex items-baseline py-2 border-b border-[#eee] gap-3">
          <span className="w-[70px] shrink-0 text-[12px] text-[#999]">이메일</span>
          <span className="flex-1 text-[13px] text-[#333]">{email}</span>
          <Link
            href="/mypage/delete"
            className="text-[11px] text-[#999] no-underline hover:text-red-600 shrink-0"
          >
            회원 탈퇴
          </Link>
        </div>

        <div className="flex items-baseline py-2 gap-3">
          <span className="w-[70px] shrink-0 text-[12px] text-[#999]">멤버십</span>
          <div className="flex-1">
            {!subscription ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-[#999]">가입 전</span>
                <Link
                  href="/subscribe"
                  className="text-[11px] text-[#111] border border-[#111] px-3 py-1 no-underline hover:bg-[#111] hover:text-white transition-colors shrink-0"
                >
                  가입하기
                </Link>
              </div>
            ) : subscription.status === "active" && !subscription.cancel_at_period_end ? (
              <>
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <p className="text-[13px] text-[#333]">
                    iiiahalab 멤버십 · {subscription.plan === "annual" ? "연간" : "월간"}
                  </p>
                  <div className="flex items-center gap-2 shrink-0 text-[11px]">
                    {subscription.billing_key && (
                      <>
                        <button
                          onClick={handleUpdatePaymentMethod}
                          className="text-[#999] bg-transparent border-0 cursor-pointer hover:text-[#111]"
                        >
                          결제수단 변경
                        </button>
                        <span className="text-[#ddd]">·</span>
                      </>
                    )}
                    <button
                      onClick={handleCancelSubscription}
                      className="text-[#999] bg-transparent border-0 cursor-pointer hover:text-red-600"
                    >
                      멤버십 해지하기
                    </button>
                  </div>
                </div>
                {formatCardLabel(subscription) && (
                  <SubMetaRow label="결제수단">{formatCardLabel(subscription)}</SubMetaRow>
                )}
                <SubMetaRow label="이용 기간">
                  {new Date(subscription.started_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  {" — "}
                  {new Date(subscription.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })} 까지
                </SubMetaRow>
                {subscription.last_charged_at && (
                  <SubMetaRow label="마지막 결제">
                    {new Date(subscription.last_charged_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </SubMetaRow>
                )}
                <SubMetaRow label="다음 결제 예상">
                  {subscription.billing_key ? (
                    new Date(subscription.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
                  ) : (
                    <span className="text-[#999]">없음 (만료 후 자동 종료)</span>
                  )}
                </SubMetaRow>
                <p className="text-[11px] text-[#999] mt-3">
                  멤버십 기간 동안 모든 익스텐션을 자유롭게 이용하실 수 있습니다.
                </p>
              </>
            ) : subscription.status === "past_due" ? (
              (() => {
                const graceEnd = new Date(subscription.expires_at);
                graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);
                return (
                  <>
                    <div className="flex items-baseline justify-between gap-3 mb-3">
                      <p className="text-[13px] text-[#333]">
                        iiiahalab 멤버십 · {subscription.plan === "annual" ? "연간" : "월간"}{" "}
                        <span className="text-[11px] text-red-600 font-bold">(결제 실패)</span>
                      </p>
                      <button
                        onClick={handleCancelSubscription}
                        className="text-[11px] text-[#999] bg-transparent border-0 cursor-pointer hover:text-red-600 shrink-0"
                      >
                        멤버십 해지하기
                      </button>
                    </div>
                    <div className="bg-[#fff8e1] border-l-[3px] border-[#f0a800] p-3 mb-3">
                      <p className="text-[12px] text-[#7a5a00] leading-[1.7]">
                        자동결제가 카드사에서 거절되었습니다. 앞으로 <b>{GRACE_DAYS}일간</b> 매일 자동 재시도되며, 그 사이 결제수단을 변경하시면 즉시 재시도되어 멤버십이 유지됩니다. 기간 내 결제가 성공하지 않으면 멤버십이 자동 만료됩니다.
                      </p>
                      <button
                        onClick={handleUpdatePaymentMethod}
                        className="mt-3 text-[12px] bg-[#111] text-white border-0 px-4 py-2 cursor-pointer hover:bg-[#333] transition-colors"
                      >
                        결제수단 변경
                      </button>
                    </div>
                    {formatCardLabel(subscription) && (
                      <SubMetaRow label="결제수단">{formatCardLabel(subscription)}</SubMetaRow>
                    )}
                    <SubMetaRow label="이용 기간">
                      {new Date(subscription.started_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                      {" — "}
                      {new Date(subscription.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })} 까지
                    </SubMetaRow>
                    {subscription.last_charged_at && (
                      <SubMetaRow label="마지막 결제">
                        {new Date(subscription.last_charged_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                      </SubMetaRow>
                    )}
                    <SubMetaRow label="자동 만료 예정">
                      <span className="text-red-600">
                        {graceEnd.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                      </span>
                    </SubMetaRow>
                  </>
                );
              })()
            ) : subscription.status === "active" && subscription.cancel_at_period_end ? (
              <>
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <p className="text-[13px] text-[#333]">
                    iiiahalab 멤버십 · {subscription.plan === "annual" ? "연간" : "월간"}{" "}
                    <span className="text-[11px] text-[#999]">(해지 예정)</span>
                  </p>
                  <button
                    onClick={handleResumeSubscription}
                    className="text-[11px] text-[#111] bg-transparent border-0 cursor-pointer hover:underline shrink-0"
                  >
                    해지 취소
                  </button>
                </div>
                {formatCardLabel(subscription) && (
                  <SubMetaRow label="결제수단">{formatCardLabel(subscription)}</SubMetaRow>
                )}
                <SubMetaRow label="이용 기간">
                  {new Date(subscription.started_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  {" — "}
                  {new Date(subscription.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })} 까지
                </SubMetaRow>
                {subscription.last_charged_at && (
                  <SubMetaRow label="마지막 결제">
                    {new Date(subscription.last_charged_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </SubMetaRow>
                )}
                <SubMetaRow label="다음 결제 예상">
                  <span className="text-[#999]">없음 (해지 예정)</span>
                </SubMetaRow>
                <p className="text-[11px] text-[#999] mt-3">
                  멤버십이 해지되었습니다. 기간 종료 후 자동으로 만료됩니다. 마음이 바뀌셨다면 만료 전까지 <b>해지 취소</b>로 자동결제를 재개하실 수 있습니다.
                </p>
              </>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] text-[#999]">
                    iiiahalab 멤버십 · 만료
                  </p>
                  <p className="text-[12px] text-[#999] mt-0.5">
                    {new Date(subscription.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </p>
                </div>
                <Link
                  href="/subscribe"
                  className="text-[11px] text-[#111] border border-[#111] px-3 py-1 no-underline hover:bg-[#111] hover:text-white transition-colors shrink-0"
                >
                  재구독
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="sub-cta relative overflow-hidden mb-10">
          <div className="sub-cta-bg absolute inset-0" />
          <div className="sub-cta-aurora absolute inset-0" />
          <div className="relative px-6 py-5">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-white">
                iiiahalab Downloader
              </span>
              <span className="text-[11px] text-[rgba(255,255,255,0.5)]">
                Win · Mac
              </span>
            </div>
            <p className="text-[13px] text-[rgba(255,255,255,0.85)] leading-[1.6] mb-4">
              보유 중인 모든 iiiaha 익스텐션을 PC 앱에서{" "}
              <strong className="text-white">한 번에 설치/업데이트</strong>합니다. 인터넷 연결이 필요합니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <a
                  href="https://github.com/iiiaha/iiiahalabdownloader/releases/latest/download/iiiahalab-downloader.exe"
                  className="block w-full text-[12px] text-white border border-white/70 px-4 py-2 no-underline hover:bg-white hover:text-[#080810] transition-colors text-center"
                >
                  Windows 다운로드
                </a>
                <p className="text-[11px] text-[rgba(255,255,255,0.55)] mt-1.5 leading-[1.6]">
                  처음 실행 시 SmartScreen 차단 → ‘추가 정보’ → ‘실행’.
                </p>
              </div>
              <div className="flex-1">
                <a
                  href="https://github.com/iiiaha/iiiahalabdownloader/releases/latest/download/iiiahalab-downloader.dmg"
                  className="block w-full text-[12px] text-white border border-white/70 px-4 py-2 no-underline hover:bg-white hover:text-[#080810] transition-colors text-center"
                >
                  macOS 다운로드
                </a>
                <p className="text-[11px] text-[rgba(255,255,255,0.55)] mt-1.5 leading-[1.6]">
                  처음 실행 시 우클릭 → ‘열기’로 한 번 띄우면 끝.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-[12px] font-bold text-[#999] tracking-[0.05em] uppercase mb-4">
        구매내역
      </h2>
      <div className="border-t border-[#ddd]">
        {orders.length === 0 ? (
          <p className="text-[14px] text-[#999] py-4">구매내역이 없습니다.</p>
        ) : (
          orders.map((order) => {
            const slug = order.products?.slug;
            const ver = versions[order.id] ?? null;

            const isRevoked = order.licenses?.some((l) => l.status === "revoked");

            return (
              <div key={order.id} className={`border-b border-[#ddd] py-3 ${isRevoked ? "opacity-60" : ""}`}>
                <div className="flex justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {order.products?.thumbnail_url && (
                        <img src={order.products.thumbnail_url} alt=""
                          className="w-8 h-8 object-contain bg-[#f5f5f5] border border-[#ddd] p-0.5" />
                      )}
                      <Link href={`/extensions/${slug}`} className="text-[14px] font-bold hover:underline">
                        {order.products?.name}
                      </Link>
                    </div>

                    <div className="flex flex-col gap-1 ml-11">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#999] w-[60px]">유효기간</span>
                        {order.subscription_id && subscription ? (
                          <span className="text-[12px] text-[#666]">
                            <span className="font-bold text-[#008a75] bg-[#00c9a7]/15 px-1.5 py-0.5">
                              멤버십 이용 중
                            </span>{" "}
                            {new Date(subscription.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })} 까지
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#666]">영구 구매</span>
                        )}
                      </div>

                      {isRevoked ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#999] w-[60px]">상태</span>
                          <span className="text-[12px] text-red-600">
                            라이선스가 취소되었습니다. contact@iiiahalab.com으로 문의 주세요.
                          </span>
                        </div>
                      ) : (
                        <>
                          {order.licenses?.map((lic) => (
                            <div key={lic.license_key}>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[#999] w-[60px]">라이선스</span>
                                <LicenseKeyDisplay licenseKey={lic.license_key} />
                              </div>
                            </div>
                          ))}
                          <div className="flex items-start gap-2">
                            <span className="text-[11px] text-[#999] w-[60px] mt-[2px]">버전</span>
                            {ver && <VersionDisplay ver={ver} />}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0 w-[130px]">
                    {!order.subscription_id && (
                      <span className="text-[13px] text-[#666]">{formatPrice(order.amount)}</span>
                    )}
                    {isRevoked ? (
                      <span className="w-full text-[12px] text-red-600 border border-red-200 px-4 py-1.5 text-center">
                        취소됨
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleDownload(order)}
                          className="w-full text-[12px] text-[#111] border border-[#111] bg-white px-4 py-1.5 cursor-pointer hover:bg-[#111] hover:text-white transition-colors text-center"
                        >
                          설치파일 다운받기
                        </button>
                        <Link href={`/openlab/new?product=${slug}`}
                          className="w-full text-[12px] text-[#111] border border-[#111] px-4 py-1.5 no-underline hover:bg-[#111] hover:text-white transition-colors text-center">
                          버그 신고 & 제안
                        </Link>
                        {(() => {
                          const disabledReason = refundDisabledReason(order);
                          return (
                            <button
                              onClick={() => handleRefund(order)}
                              disabled={!!disabledReason}
                              title={disabledReason ?? "환불 요청"}
                              className="w-full text-[12px] text-[#111] border border-[#111] bg-white px-4 py-1.5 cursor-pointer hover:bg-[#111] hover:text-white transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[#111]"
                            >
                              환불하기
                            </button>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}

function SubMetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex text-[12px] leading-[1.7]">
      <span className="w-[100px] shrink-0 text-[#999]">{label}</span>
      <span className="text-[#666]">{children}</span>
    </div>
  );
}
