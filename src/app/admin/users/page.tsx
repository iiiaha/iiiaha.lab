"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear().toString().slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
}

interface License {
  id: string;
  license_key: string;
  hwid: string | null;
  status: string;
  activated_at: string | null;
  created_at: string;
  user_id: string;
  subscription_id: string | null;
  products: { name: string; slug: string } | null;
}

interface Subscription {
  id: string;
  user_id: string;
  plan: "monthly" | "annual";
  status: string;
  started_at: string;
  expires_at: string;
  cancel_at_period_end: boolean;
  billing_key: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  slug: string;
}

type SubStatus = "none" | "active" | "canceling";
type Filter = "all" | "none" | "active" | "canceling";

const PER_PAGE = 50;

function getSubStatus(sub: Subscription | null): SubStatus {
  if (!sub) return "none";
  if (sub.status !== "active") return "none";
  return sub.cancel_at_period_end ? "canceling" : "active";
}

function SubBadge({ status }: { status: SubStatus }) {
  const label =
    status === "none" ? "미구독" : status === "active" ? "구독중" : "해지중";
  const cls =
    status === "none"
      ? "text-[#999] border-[#ddd]"
      : status === "active"
        ? "text-green-700 border-green-600 bg-green-50"
        : "text-amber-700 border-amber-500 bg-amber-50";
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 border ${cls}`}>
      {label}
    </span>
  );
}

export default function AdminAccounts() {
  const supabase = createClient();
  const [users, setUsers] = useState<User[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // 수동 발급 모달 상태
  const [showIssue, setShowIssue] = useState(false);
  const [issueProductId, setIssueProductId] = useState("");
  const [issueEmail, setIssueEmail] = useState("");
  const [issueMemo, setIssueMemo] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issuedKey, setIssuedKey] = useState("");

  const load = async () => {
    const [usersRes, licRes, subRes, prodRes] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      supabase
        .from("licenses")
        .select("*, products(name, slug)")
        .order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*"),
      supabase
        .from("products")
        .select("id, name, slug")
        .eq("type", "extension")
        .order("created_at", { ascending: true }),
    ]);

    setUsers((usersRes.users as User[]) ?? []);
    setLicenses((licRes.data as License[]) ?? []);
    setSubs((subRes.data as Subscription[]) ?? []);
    const prods = (prodRes.data as ProductOption[]) ?? [];
    setProducts(prods);
    if (prods.length > 0 && !issueProductId) {
      setIssueProductId(prods[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  // user_id로 서브·라이선스 매핑
  const subByUser = useMemo(() => {
    const m = new Map<string, Subscription>();
    for (const s of subs) {
      const existing = m.get(s.user_id);
      if (!existing) {
        m.set(s.user_id, s);
        continue;
      }
      if (s.status === "active" && existing.status !== "active") {
        m.set(s.user_id, s);
      } else if (
        s.status === existing.status &&
        new Date(s.started_at) > new Date(existing.started_at)
      ) {
        m.set(s.user_id, s);
      }
    }
    return m;
  }, [subs]);

  const licensesByUser = useMemo(() => {
    const m = new Map<string, License[]>();
    for (const l of licenses) {
      if (!m.has(l.user_id)) m.set(l.user_id, []);
      m.get(l.user_id)!.push(l);
    }
    return m;
  }, [licenses]);

  // 행 데이터
  const rows = useMemo(() => {
    return users.map((u) => ({
      user: u,
      subscription: subByUser.get(u.id) ?? null,
      licenses: licensesByUser.get(u.id) ?? [],
    }));
  }, [users, subByUser, licensesByUser]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      const subStatus = getSubStatus(r.subscription);
      if (filter !== "all" && subStatus !== filter) return false;

      if (q) {
        const emailMatch = r.user.email?.toLowerCase().includes(q);
        const licMatch = r.licenses.some(
          (l) =>
            l.license_key.toLowerCase().includes(q) ||
            l.products?.name.toLowerCase().includes(q)
        );
        if (!emailMatch && !licMatch) return false;
      }
      return true;
    });
  }, [rows, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = useMemo(() => {
    const active = rows.filter((r) => getSubStatus(r.subscription) === "active").length;
    const canceling = rows.filter((r) => getSubStatus(r.subscription) === "canceling").length;
    const totalLic = rows.reduce((s, r) => s + r.licenses.length, 0);
    return { total: rows.length, active, canceling, totalLic };
  }, [rows]);

  const revokeLicense = async (id: string) => {
    if (!confirm("이 라이선스를 해지하시겠습니까?")) return;
    await supabase.from("licenses").update({ status: "revoked" }).eq("id", id);
    showMessage("라이선스 해지됨");
    load();
  };

  const reactivateLicense = async (id: string) => {
    await supabase
      .from("licenses")
      .update({ status: "active", hwid: null, activated_at: null })
      .eq("id", id);
    showMessage("라이선스 재활성화됨");
    load();
  };

  const grantSubscription = async (
    userId: string,
    email: string,
    plan: "monthly" | "annual"
  ) => {
    if (
      !confirm(
        `${email} 계정에 ${plan === "annual" ? "연간" : "월간"} 구독을 무상으로 부여하시겠습니까?`
      )
    )
      return;
    const res = await fetch("/api/admin/subscriptions/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, plan }),
    });
    const data = await res.json();
    if (res.ok) {
      showMessage(`구독 부여 완료 (${data.licenses_granted}개)`);
      load();
    } else {
      showMessage(`오류: ${data.error}`);
    }
  };

  const cancelSubscription = async (subscriptionId: string) => {
    if (
      !confirm(
        "이 계정의 구독을 즉시 해지하시겠습니까? 구독으로 발급된 모든 라이선스가 바로 revoke됩니다."
      )
    )
      return;
    const res = await fetch("/api/admin/subscriptions/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_id: subscriptionId }),
    });
    const data = await res.json();
    if (res.ok) {
      showMessage(`구독 해지 (${data.revoked_licenses}개 revoke)`);
      load();
    } else {
      showMessage(`오류: ${data.error}`);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (
      !confirm(
        `${email} 계정을 완전히 삭제하시겠습니까?\n\n주문·라이선스·구독·쿠폰 사용 내역이 모두 함께 삭제되며, 되돌릴 수 없습니다.`
      )
    )
      return;
    const res = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    if (res.ok) {
      showMessage(`${email} 삭제됨`);
      if (expanded === userId) setExpanded(null);
      load();
    } else {
      showMessage(`오류: ${data.error}`);
    }
  };

  const issueLicense = async () => {
    if (!issueProductId) return;
    setIssuing(true);
    setIssuedKey("");
    try {
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: issueProductId,
          user_email: issueEmail || undefined,
          memo: issueMemo || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIssuedKey(data.license_key);
        showMessage(`발급 완료: ${data.license_key}`);
        load();
      } else {
        showMessage(`오류: ${data.error}`);
      }
    } catch {
      showMessage("발급 실패");
    } finally {
      setIssuing(false);
    }
  };

  if (loading) return <p className="text-[14px] text-[#999]">로딩 중...</p>;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em]">사용자 · 라이선스</h1>
          <p className="text-[13px] text-[#999] mt-1.5">
            계정 기반으로 구독·라이선스·주문을 통합 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-7 text-[12px] text-[#999]">
          <span>
            계정 <strong className="text-[#111] text-[14px]">{stats.total}</strong>
          </span>
          <span>
            라이선스 <strong className="text-[#111] text-[14px]">{stats.totalLic}</strong>
          </span>
          <span>
            구독중 <strong className="text-[#111] text-[14px]">{stats.active}</strong>
          </span>
          <span>
            해지중 <strong className="text-[#111] text-[14px]">{stats.canceling}</strong>
          </span>
        </div>
      </div>
      <div className="border-t border-[#111] mb-6" />
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="text-[12px] text-green-600 h-5">{message}</div>
        <button
          onClick={() => {
            setShowIssue(!showIssue);
            setIssuedKey("");
          }}
          className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333]"
        >
          + 라이선스 수동 발급
        </button>
      </div>

      {showIssue && (
        <div className="border border-[#111] p-4 mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="w-[60px] shrink-0 text-[11px] text-[#999] font-bold">제품</label>
              <select
                value={issueProductId}
                onChange={(e) => setIssueProductId(e.target.value)}
                className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="w-[60px] shrink-0 text-[11px] text-[#999] font-bold">이메일</label>
              <input
                type="email"
                value={issueEmail}
                onChange={(e) => setIssueEmail(e.target.value)}
                placeholder="유저 이메일 (선택)"
                className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-[60px] shrink-0 text-[11px] text-[#999] font-bold">메모</label>
              <input
                type="text"
                value={issueMemo}
                onChange={(e) => setIssueMemo(e.target.value)}
                placeholder="예: 베타테스트, 본인용 (선택)"
                className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              />
            </div>
          </div>
          {issuedKey && (
            <div className="mt-3 p-3 bg-[#f5f5f5] border border-[#ddd]">
              <span className="text-[11px] text-[#999]">발급된 키:</span>
              <code className="ml-2 text-[14px] font-bold select-all">{issuedKey}</code>
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={issueLicense}
              disabled={issuing || !issueProductId}
              className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333] disabled:opacity-40"
            >
              {issuing ? "..." : "발급"}
            </button>
            <button
              onClick={() => {
                setShowIssue(false);
                setIssuedKey("");
                setIssueEmail("");
                setIssueMemo("");
              }}
              className="bg-white text-[#111] text-[12px] font-bold px-4 py-2 border border-[#ddd] cursor-pointer hover:bg-[#f5f5f5]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex border border-[#ddd]">
          {(["all", "none", "active", "canceling"] as Filter[]).map((f) => {
            const label =
              f === "all" ? "전체" : f === "none" ? "미구독" : f === "active" ? "구독중" : "해지중";
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[12px] px-4 py-2 border-0 cursor-pointer ${
                  filter === f
                    ? "bg-[#111] text-white font-bold"
                    : "bg-white text-[#666] hover:bg-[#f5f5f5]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="이메일, 라이선스 키, 제품명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111]"
        />
      </div>

      {/* Column header */}
      <div className="flex items-center gap-4 px-4 py-3 text-[11px] text-[#999] font-bold tracking-[0.08em] uppercase border-b border-[#111]">
        <span className="flex-1">이메일</span>
        <span className="w-20 shrink-0">Provider</span>
        <span className="w-20 shrink-0 text-center">구독</span>
        <span className="w-14 shrink-0 text-right">라이선스</span>
        <span className="w-24 shrink-0 text-right">가입일</span>
        <span className="w-24 shrink-0 text-right">최근 로그인</span>
        <span className="w-[220px] shrink-0 text-right">작업</span>
        <span className="w-5 shrink-0" />
      </div>

      <div>
        {paginated.length === 0 ? (
          <p className="text-[12px] text-[#999] py-4 text-center">결과 없음</p>
        ) : (
          paginated.map((row) => {
            const { user, subscription, licenses: userLics } = row;
            const subStatus = getSubStatus(subscription);
            const subLicenses = userLics.filter((l) => l.subscription_id);
            const indivLicenses = userLics.filter((l) => !l.subscription_id);
            const isExpanded = expanded === user.id;

            return (
              <div key={user.id} className="border-b border-[#eee]">
                <div className="flex items-center gap-4 px-4 py-3 text-[13px] hover:bg-[#fafafa]">
                  <span
                    onClick={() => setExpanded(isExpanded ? null : user.id)}
                    className="flex-1 font-bold truncate cursor-pointer"
                  >
                    {user.email}
                  </span>
                  <span className="w-20 shrink-0 text-[11px] text-[#999] border border-[#eee] px-2 py-0.5 text-center">
                    {user.provider}
                  </span>
                  <span className="w-20 shrink-0 flex justify-center">
                    <SubBadge status={subStatus} />
                  </span>
                  <span className="w-14 shrink-0 text-right text-[#666]">
                    {userLics.length}
                  </span>
                  <span className="w-24 shrink-0 text-right text-[11px] text-[#999]">
                    {shortDate(user.created_at)}
                  </span>
                  <span className="w-24 shrink-0 text-right text-[11px] text-[#999]">
                    {shortDate(user.last_sign_in_at)}
                  </span>
                  <div className="w-[220px] shrink-0 flex gap-1.5 justify-end">
                    {subStatus === "none" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            grantSubscription(user.id, user.email, "monthly");
                          }}
                          className="text-[11px] text-[#111] bg-white border border-[#ddd] px-2.5 py-1 cursor-pointer hover:bg-[#f5f5f5]"
                        >
                          + 월간
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            grantSubscription(user.id, user.email, "annual");
                          }}
                          className="text-[11px] text-[#111] bg-white border border-[#ddd] px-2.5 py-1 cursor-pointer hover:bg-[#f5f5f5]"
                        >
                          + 연간
                        </button>
                      </>
                    )}
                    {subscription && subscription.status === "active" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelSubscription(subscription.id);
                        }}
                        className="text-[11px] text-red-600 bg-white border border-red-300 px-2.5 py-1 cursor-pointer hover:bg-red-50"
                      >
                        구독 해지
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteUser(user.id, user.email);
                      }}
                      className="text-[11px] text-red-600 bg-white border border-[#ddd] px-2.5 py-1 cursor-pointer hover:bg-red-50"
                    >
                      탈퇴
                    </button>
                  </div>
                  <span
                    onClick={() => setExpanded(isExpanded ? null : user.id)}
                    className="w-5 shrink-0 text-center text-[16px] text-[#ccc] cursor-pointer leading-none"
                  >
                    {isExpanded ? "−" : "+"}
                  </span>
                </div>

                {isExpanded && (
                  <div className="bg-[#fafafa] px-6 py-5 border-t border-[#eee]">
                    {userLics.length === 0 ? (
                      <p className="text-[13px] text-[#999]">발급된 라이선스 없음</p>
                    ) : (
                      <div className="flex flex-col gap-5">
                        {subscription && subLicenses.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-[#999] tracking-[0.08em] uppercase mb-3">
                              구독 · {subscription.plan === "annual" ? "연간" : "월간"}
                              <span className="ml-2 text-[#999] normal-case tracking-normal">
                                {new Date(subscription.started_at).toLocaleDateString("ko-KR")}
                                {" → "}
                                {new Date(subscription.expires_at).toLocaleDateString("ko-KR")}
                              </span>
                              {!subscription.billing_key && (
                                <span className="ml-2 text-[#999] normal-case tracking-normal">(무상)</span>
                              )}
                            </p>
                            <div className="flex flex-col">
                              {subLicenses.map((lic) => (
                                <div
                                  key={lic.id}
                                  className="flex items-center gap-3 py-1.5 text-[12px] border-b border-[#eee] last:border-0"
                                >
                                  <span className="flex-1 truncate font-bold">
                                    {lic.products?.name}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold ${
                                      lic.status === "active"
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {lic.status === "active" ? "활성" : "해지"}
                                  </span>
                                  <code className="text-[11px] bg-white px-1.5 py-0.5 border border-[#eee] text-[#999]">
                                    {lic.license_key}
                                  </code>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {indivLicenses.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-[#999] tracking-[0.08em] uppercase mb-3">
                              개별 구매
                            </p>
                            <div className="flex flex-col">
                              {indivLicenses.map((lic) => (
                                <div
                                  key={lic.id}
                                  className="flex items-center gap-3 py-1.5 text-[12px] border-b border-[#eee] last:border-0"
                                >
                                  <span className="flex-1 truncate font-bold">
                                    {lic.products?.name}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold ${
                                      lic.status === "active"
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {lic.status === "active" ? "활성" : "해지"}
                                  </span>
                                  <code className="text-[11px] bg-white px-1.5 py-0.5 border border-[#eee] text-[#999]">
                                    {lic.license_key}
                                  </code>
                                  {lic.status === "active" ? (
                                    <button
                                      onClick={() => revokeLicense(lic.id)}
                                      className="text-[10px] text-red-600 border border-[#ddd] bg-white px-2 py-0.5 cursor-pointer hover:bg-red-50"
                                    >
                                      해지
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => reactivateLicense(lic.id)}
                                      className="text-[10px] text-green-600 border border-[#ddd] bg-white px-2 py-0.5 cursor-pointer hover:bg-green-50"
                                    >
                                      재활성
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-8">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="text-[12px] px-3 py-1.5 border border-[#ddd] bg-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f5f5f5]"
          >
            ≪
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-[12px] px-3 py-1.5 border border-[#ddd] bg-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f5f5f5]"
          >
            ‹
          </button>
          <span className="text-[12px] px-4 text-[#666]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-[12px] px-3 py-1.5 border border-[#ddd] bg-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f5f5f5]"
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="text-[12px] px-3 py-1.5 border border-[#ddd] bg-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f5f5f5]"
          >
            ≫
          </button>
        </div>
      )}
    </div>
  );
}
