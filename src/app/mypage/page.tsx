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
  status: "active" | "cancelled" | "expired";
  started_at: string;
  expires_at: string;
}

interface OrderWithProduct {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  product_id: string;
  subscription_id: string | null;
  products: {
    slug: string;
    name: string;
    version: string | null;
    thumbnail_url: string | null;
  };
  licenses: { license_key: string; hwid: string | null; status: string }[];
}

interface VersionInfo {
  latest: string | null;
  current: string | null;
  hasUpdate: boolean;
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

      // 구독 조회
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (subData) setSubscription(subData as Subscription);

      const { data } = await supabase
        .from("orders")
        .select(
          "id, amount, status, created_at, product_id, subscription_id, products(slug, name, version, thumbnail_url), licenses(license_key, hwid, status)"
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

      const versionMap: Record<string, VersionInfo> = {};
      for (const order of orderList) {
        const slug = order.products?.slug;
        if (!slug || versionMap[slug]) continue;
        try {
          const res = await fetch(`/api/version?slug=${slug}`);
          if (res.ok) {
            const d = await res.json();
            const latest = d.version;
            const current = order.products?.version;
            versionMap[slug] = {
              latest,
              current,
              hasUpdate: latest && current ? latest !== current : false,
            };
          }
        } catch {
          // ignore
        }
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
          Logout
        </button>
      </div>
      <div className="border-b border-[#111] mb-4 sticky-divider" />
      <div className="flex items-center min-h-[32px] mb-6">
        <p className="text-[13px] text-[#666]">{email}</p>
      </div>

      {/* Subscription */}
      {subscription && (
        <div className="mb-10">
          <h2 className="text-[12px] font-bold text-[#999] tracking-[0.05em] uppercase mb-4">
            Subscription
          </h2>
          <div
            className="sub-cta relative overflow-hidden rounded-sm p-5 mb-2"
          >
            <div className="sub-cta-bg absolute inset-0" />
            <div className="sub-cta-aurora absolute inset-0" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[14px] font-bold text-white mb-1">
                  All Extensions — {subscription.plan === "annual" ? "Annual" : "Monthly"} Plan
                </p>
                <p className="text-[12px] text-[rgba(255,255,255,0.6)]">
                  {new Date(subscription.started_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  {" — "}
                  {new Date(subscription.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                </p>
              </div>
              <span className="text-[11px] font-bold tracking-[0.05em] text-white border border-[rgba(255,255,255,0.3)] px-3 py-1">
                Active
              </span>
            </div>
          </div>
          <p className="text-[11px] text-[#999]">
            All extensions are available for download during your subscription period.
          </p>
        </div>
      )}

      <h2 className="text-[12px] font-bold text-[#999] tracking-[0.05em] uppercase mb-4">
        Purchased
      </h2>
      <div className="border-t border-[#ddd]">
        {orders.length === 0 ? (
          <p className="text-[14px] text-[#999] py-4">No purchases yet.</p>
        ) : (
          orders.map((order) => {
            const slug = order.products?.slug;
            const ver = slug ? versions[slug] : null;

            const isRevoked = order.licenses?.some((l) => l.status === "revoked");

            return (
              <div key={order.id} className={`border-b border-[#ddd] py-5 ${isRevoked ? "opacity-60" : ""}`}>
                <div className="flex justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      {order.products?.thumbnail_url && (
                        <img src={order.products.thumbnail_url} alt=""
                          className="w-9 h-9 object-contain bg-[#f5f5f5] border border-[#ddd] p-0.5" />
                      )}
                      <Link href={`/extensions/${slug}`} className="text-[14px] font-bold hover:underline">
                        {order.products?.name}
                      </Link>
                      {isRevoked && (
                        <span className="text-[10px] text-red-600 font-bold border border-red-200 px-1.5 py-0.5">Revoked</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-12">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#999] w-[60px]">Expires</span>
                        {order.subscription_id && subscription ? (
                          <span className="text-[12px] text-[#666]">
                            {new Date(subscription.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#666]">Permanent</span>
                        )}
                      </div>

                      {isRevoked ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#999] w-[60px]">Status</span>
                          <span className="text-[12px] text-red-600">
                            License revoked. Please contact support.
                          </span>
                        </div>
                      ) : (
                        <>
                          {order.licenses?.map((lic) => (
                            <div key={lic.license_key}>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[#999] w-[60px]">License</span>
                                <LicenseKeyDisplay licenseKey={lic.license_key} />
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#999] w-[60px]">Version</span>
                            {ver && (
                              ver.hasUpdate ? (
                                <span className="text-[12px] text-[#111] font-bold">
                                  v{ver.current} → v{ver.latest} available
                                </span>
                              ) : (
                                <span className="text-[12px] text-[#999]">
                                  v{ver.current} — Latest
                                </span>
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0 w-[130px]">
                    {order.subscription_id ? (
                      <span className="text-[11px] font-bold tracking-[0.05em] text-[#00c9a7] border border-[#00c9a7] px-2.5 py-0.5">
                        Subscribed
                      </span>
                    ) : (
                      <span className="text-[13px] text-[#666]">{formatPrice(order.amount)}</span>
                    )}
                    {isRevoked ? (
                      <span className="w-full text-[12px] text-red-600 border border-red-200 px-4 py-1.5 text-center">
                        Revoked
                      </span>
                    ) : (
                      <>
                        <a href={`/api/download/${slug}`}
                          className="w-full text-[12px] text-[#111] border border-[#111] px-4 py-1.5 no-underline hover:bg-[#111] hover:text-white transition-colors text-center">
                          Download .rbz
                        </a>
                        {ver?.hasUpdate && (
                          <a href={`/api/download/${slug}`}
                            className="w-full text-[12px] text-white bg-[#111] border border-[#111] px-4 py-1.5 no-underline hover:bg-[#333] transition-colors text-center">
                            Update to v{ver.latest}
                          </a>
                        )}
                        <Link href={`/openlab/new?product=${slug}`}
                          className="w-full text-[12px] text-[#111] border border-[#111] px-4 py-1.5 no-underline hover:bg-[#111] hover:text-white transition-colors text-center">
                          Questions & Bugs
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete account */}
      <div className="mt-16 pt-8 border-t border-[#ddd]">
        <Link
          href="/mypage/delete"
          className="text-[12px] text-[#999] hover:text-red-600"
        >
          Delete account
        </Link>
      </div>
    </div>
  );
}
