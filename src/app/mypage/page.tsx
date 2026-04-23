"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser, signOut } from "@/lib/auth";
import { createClient } from "@/lib/supabase";
import { formatPrice } from "@/lib/types";

interface Subscription {
  id: string;
  plan: "monthly" | "annual";
  status: "active" | "cancelled" | "expired" | "past_due";
  started_at: string;
  expires_at: string;
  cancel_at_period_end: boolean;
  last_charged_at: string | null;
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
  licenses: { license_key: string; hwid: string | null; status: string; last_downloaded_version: string | null }[];
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
  current: string | null;
  hasUpdate: boolean;
  notDownloaded: boolean;
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
          "id, amount, status, created_at, product_id, subscription_id, payment_key, download_acknowledged_at, products(slug, name, version, thumbnail_url), licenses(license_key, hwid, status, last_downloaded_version)"
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

      // 버전 비교: "유저가 마지막으로 다운로드한 버전(licenses.last_downloaded_version)" ↔ "제품 현재 버전(products.version)"
      const versionMap: Record<string, VersionInfo> = {};
      for (const order of orderList) {
        const slug = order.products?.slug;
        if (!slug) continue;
        const latest = order.products?.version ?? null;
        const current = order.licenses?.[0]?.last_downloaded_version ?? null;
        versionMap[order.id] = {
          latest,
          current,
          hasUpdate: !!(latest && current && latest !== current),
          notDownloaded: !current,
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
                  <button
                    onClick={handleCancelSubscription}
                    className="text-[11px] text-[#999] bg-transparent border-0 cursor-pointer hover:text-red-600 shrink-0"
                  >
                    멤버십 해지하기
                  </button>
                </div>
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
                  {new Date(subscription.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                </SubMetaRow>
                <p className="text-[11px] text-[#999] mt-3">
                  멤버십 기간 동안 모든 익스텐션을 자유롭게 이용하실 수 있습니다.
                </p>
              </>
            ) : subscription.status === "active" && subscription.cancel_at_period_end ? (
              <>
                <p className="text-[13px] text-[#333] mb-3">
                  iiiahalab 멤버십 · {subscription.plan === "annual" ? "연간" : "월간"}{" "}
                  <span className="text-[11px] text-[#999]">(해지 예정)</span>
                </p>
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
                  멤버십이 해지되었습니다. 기간 종료 후 자동으로 만료됩니다.
                </p>
              </>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] text-[#999]">
                    iiiahalab 멤버십 · 만료
                    {subscription.status === "past_due" && " (결제 실패)"}
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
                      {isRevoked && (
                        <span className="text-[10px] text-red-600 font-bold border border-red-200 px-1.5 py-0.5">취소됨</span>
                      )}
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
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#999] w-[60px]">버전</span>
                            {ver && (
                              ver.hasUpdate ? (
                                <span className="text-[12px] text-[#111] font-bold">
                                  v{ver.current} → v{ver.latest} 업데이트 가능
                                </span>
                              ) : ver.notDownloaded && ver.latest ? (
                                <span className="text-[12px] text-[#999]">
                                  v{ver.latest} — 설치 전
                                </span>
                              ) : ver.current ? (
                                <span className="text-[12px] text-[#999]">
                                  v{ver.current} — 최신 버전입니다.
                                </span>
                              ) : null
                            )}
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
                        {ver?.hasUpdate && (
                          <button
                            onClick={() => handleDownload(order)}
                            className="w-full text-[12px] text-white bg-[#111] border border-[#111] px-4 py-1.5 cursor-pointer hover:bg-[#333] transition-colors text-center"
                          >
                            v{ver.latest} 업데이트
                          </button>
                        )}
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
