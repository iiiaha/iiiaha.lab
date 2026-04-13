"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

interface User {
  id: string;
  email: string;
  created_at: string;
  provider: string;
}

interface Order {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  payment_key: string | null;
  subscription_id: string | null;
  user_id: string;
  products: { id: string; name: string } | null;
}

interface Subscription {
  id: string;
  user_id: string;
  plan: "monthly" | "annual";
  status: string;
  started_at: string;
  expires_at: string;
  cancel_at_period_end: boolean;
  amount: number | null;
  billing_key: string | null;
}

type Mode = "day" | "week" | "month";

// ─── 날짜 / 포맷 ───────────────────────────────────────

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekStart(d: Date): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildBuckets(
  events: { date: string; value: number }[],
  mode: Mode
): { label: string; value: number }[] {
  const now = new Date();
  const buckets: { key: string; label: string; value: number }[] = [];
  const n = mode === "day" ? 30 : 12;

  if (mode === "day") {
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({
        key: dayKey(d),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        value: 0,
      });
    }
    for (const e of events) {
      const k = dayKey(new Date(e.date));
      const b = buckets.find((b) => b.key === k);
      if (b) b.value += e.value;
    }
  } else if (mode === "week") {
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const ws = weekStart(d);
      buckets.push({
        key: dayKey(ws),
        label: `${ws.getMonth() + 1}/${ws.getDate()}`,
        value: 0,
      });
    }
    for (const e of events) {
      const ws = weekStart(new Date(e.date));
      const k = dayKey(ws);
      const b = buckets.find((b) => b.key === k);
      if (b) b.value += e.value;
    }
  } else {
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: monthKey(d),
        label: `${d.getFullYear().toString().slice(2)}.${d.getMonth() + 1}`,
        value: 0,
      });
    }
    for (const e of events) {
      const k = monthKey(new Date(e.date));
      const b = buckets.find((b) => b.key === k);
      if (b) b.value += e.value;
    }
  }

  return buckets.map(({ label, value }) => ({ label, value }));
}

function formatKRW(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatShortKRW(n: number): string {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `₩${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
  return `₩${n.toLocaleString("ko-KR")}`;
}

function niceMax(n: number): number {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / pow;
  let factor: number;
  if (norm <= 1) factor = 1;
  else if (norm <= 2) factor = 2;
  else if (norm <= 5) factor = 5;
  else factor = 10;
  return factor * pow;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear().toString().slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
}

// ─── 컴팩트 BarChart ────────────────────────────────────

function BarChart({
  data,
  formatValue,
  formatAxis,
  height = 150,
}: {
  data: { label: string; value: number }[];
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rawMax = Math.max(0, ...data.map((d) => d.value));
  const max = niceMax(rawMax);
  const avg = data.reduce((s, d) => s + d.value, 0) / data.length;

  const isEmpty = rawMax === 0;
  const ticks = [max, Math.round(max / 2), 0];
  const labelIdxs = new Set<number>([0, Math.floor(data.length / 2), data.length - 1]);

  return (
    <div className="flex">
      <div
        className="flex flex-col justify-between text-[9px] text-[#999] text-right pr-2 w-[40px] shrink-0"
        style={{ height: `${height}px` }}
      >
        {ticks.map((t, i) => (
          <span key={i} className="leading-none">
            {formatAxis(t)}
          </span>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative" style={{ height: `${height}px` }}>
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="border-t border-[#f0f0f0]" />
            <div className="border-t border-[#f0f0f0]" />
            <div className="border-t border-[#111]" />
          </div>

          {!isEmpty && avg > 0 && (
            <div
              className="absolute left-0 right-0 border-t border-dashed border-[#bbb] pointer-events-none"
              style={{ bottom: `${(avg / max) * 100}%` }}
            />
          )}

          <div className="absolute inset-0 flex items-end gap-[2px]">
            {isEmpty ? (
              <div className="flex-1 flex items-center justify-center text-[11px] text-[#ccc]">
                데이터 없음
              </div>
            ) : (
              data.map((d, i) => {
                const h = (d.value / max) * height;
                const isHover = hover === i;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end h-full relative cursor-default"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {isHover && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#111] text-white text-[10px] px-2 py-0.5 whitespace-nowrap z-10 leading-tight">
                        <div className="font-bold">{formatValue(d.value)}</div>
                        <div className="text-[#999] text-[9px]">{d.label}</div>
                      </div>
                    )}
                    <div
                      className={`w-full transition-colors ${
                        isHover ? "bg-[#555]" : "bg-[#111]"
                      }`}
                      style={{
                        height: `${Math.max(h, d.value > 0 ? 2 : 0)}px`,
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex gap-[2px] mt-1.5">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex-1 text-[9px] text-[#999] text-center truncate"
            >
              {labelIdxs.has(i) ? d.label : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="inline-flex border border-[#ddd]">
      {(["day", "week", "month"] as Mode[]).map((m) => {
        const label = m === "day" ? "일" : m === "week" ? "주" : "월";
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`text-[10px] px-2 py-0.5 border-0 cursor-pointer ${
              value === m
                ? "bg-[#111] text-white font-bold"
                : "bg-white text-[#666] hover:bg-[#f5f5f5]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  subvalue,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  subvalue?: string;
  accent?: "up" | "neutral";
}) {
  return (
    <div className="border border-[#111] p-5">
      <p className="text-[10px] text-[#999] font-bold uppercase tracking-[0.08em] mb-3">
        {label}
      </p>
      <p className="text-[24px] font-bold leading-none tracking-[-0.01em]">
        {value}
      </p>
      {sublabel && (
        <div className="mt-3 pt-2 border-t border-[#eee] flex items-baseline justify-between">
          <span className="text-[11px] text-[#999]">{sublabel}</span>
          <span
            className={`text-[12px] font-bold ${
              accent === "up" ? "text-green-600" : "text-[#111]"
            }`}
          >
            {subvalue}
          </span>
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div>
      <div className="h-8 w-48 bg-[#f5f5f5] mb-4" />
      <div className="border-t border-[#111] mb-6" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-[#ddd] p-5 h-[110px] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-[#ddd] p-5 h-[260px] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ─── 메인 ──────────────────────────────────────────────

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [userMode, setUserMode] = useState<Mode>("day");
  const [singleRevenueMode, setSingleRevenueMode] = useState<Mode>("day");
  const [subGrowthMode, setSubGrowthMode] = useState<Mode>("month");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [usersRes, ordersRes, subsRes] = await Promise.all([
        fetch("/api/admin/users").then((r) => r.json()),
        supabase
          .from("orders")
          .select(
            "id, amount, status, created_at, payment_key, subscription_id, user_id, products(id, name)"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("subscriptions")
          .select("*")
          .order("started_at", { ascending: false }),
      ]);

      setUsers((usersRes.users as User[]) ?? []);
      setOrders((ordersRes.data as unknown as Order[]) ?? []);
      setSubs((subsRes.data as Subscription[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const now = Date.now();
  const weekAgo = now - 7 * 86400 * 1000;

  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }, []);
  const nextMonthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  }, []);

  const singlePaidOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === "paid" &&
        (o.amount || 0) > 0 &&
        !o.subscription_id &&
        !(o.payment_key || "").startsWith("admin") &&
        !(o.payment_key || "").startsWith("subscription:")
    );
  }, [orders]);

  const activeSubs = useMemo(
    () => subs.filter((s) => s.status === "active" && !s.cancel_at_period_end),
    [subs]
  );
  const cancelingSubs = useMemo(
    () => subs.filter((s) => s.status === "active" && s.cancel_at_period_end),
    [subs]
  );

  const topStats = useMemo(() => {
    const totalUsers = users.length;
    const newUsersThisWeek = users.filter(
      (u) => new Date(u.created_at).getTime() >= weekAgo
    ).length;

    const totalRevenue =
      singlePaidOrders.reduce((s, o) => s + (o.amount || 0), 0) +
      subs
        .filter((s) => s.amount && s.amount > 0)
        .reduce((s, sub) => s + (sub.amount || 0), 0);

    const revenueThisMonth =
      singlePaidOrders
        .filter((o) => new Date(o.created_at).getTime() >= monthStart)
        .reduce((s, o) => s + (o.amount || 0), 0) +
      subs
        .filter(
          (s) =>
            s.amount &&
            s.amount > 0 &&
            new Date(s.started_at).getTime() >= monthStart
        )
        .reduce((s, sub) => s + (sub.amount || 0), 0);

    const mrr = activeSubs.reduce((s, sub) => {
      const amt = sub.amount || 0;
      return s + (sub.plan === "annual" ? Math.round(amt / 12) : amt);
    }, 0);

    const upcomingCharges = activeSubs
      .filter((s) => {
        const ea = new Date(s.expires_at).getTime();
        return ea >= now && ea < nextMonthStart;
      })
      .reduce((s, sub) => s + (sub.amount || 0), 0);

    return {
      totalUsers,
      newUsersThisWeek,
      totalRevenue,
      revenueThisMonth,
      activeSubCount: activeSubs.length,
      cancelingSubCount: cancelingSubs.length,
      mrr,
      upcomingCharges,
    };
  }, [
    users,
    singlePaidOrders,
    subs,
    activeSubs,
    cancelingSubs,
    weekAgo,
    monthStart,
    nextMonthStart,
    now,
  ]);

  const userChart = useMemo(
    () => buildBuckets(users.map((u) => ({ date: u.created_at, value: 1 })), userMode),
    [users, userMode]
  );

  const singleRevenueChart = useMemo(
    () =>
      buildBuckets(
        singlePaidOrders.map((o) => ({ date: o.created_at, value: o.amount })),
        singleRevenueMode
      ),
    [singlePaidOrders, singleRevenueMode]
  );

  const subGrowthChart = useMemo(
    () => buildBuckets(subs.map((s) => ({ date: s.started_at, value: 1 })), subGrowthMode),
    [subs, subGrowthMode]
  );

  const singleKpis = useMemo(() => {
    const total = singlePaidOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const count = singlePaidOrders.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, avg };
  }, [singlePaidOrders]);

  const productRanking = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; count: number; revenue: number }
    >();
    for (const o of singlePaidOrders) {
      const pid = o.products?.id ?? "unknown";
      const name = o.products?.name ?? "—";
      if (!map.has(pid)) {
        map.set(pid, { id: pid, name, count: 0, revenue: 0 });
      }
      const entry = map.get(pid)!;
      entry.count += 1;
      entry.revenue += o.amount;
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [singlePaidOrders]);

  const productRankingTotalRevenue = productRanking.reduce(
    (s, p) => s + p.revenue,
    0
  );

  const subKpis = useMemo(() => {
    const monthlyCount = activeSubs.filter((s) => s.plan === "monthly").length;
    const annualCount = activeSubs.filter((s) => s.plan === "annual").length;
    return { monthlyCount, annualCount };
  }, [activeSubs]);

  const planTotal = subKpis.monthlyCount + subKpis.annualCount;
  const monthlyRatio =
    planTotal > 0 ? Math.round((subKpis.monthlyCount / planTotal) * 100) : 0;
  const annualRatio = planTotal > 0 ? 100 - monthlyRatio : 0;

  const userEmailById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.email);
    return m;
  }, [users]);

  const activeSubList = useMemo(() => {
    return activeSubs
      .map((s) => ({
        ...s,
        email: userEmailById.get(s.user_id) ?? s.user_id.slice(0, 8),
      }))
      .sort(
        (a, b) =>
          new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
      );
  }, [activeSubs, userEmailById]);

  if (loading) return <Skeleton />;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="text-[18px] font-bold tracking-[-0.01em]">대시보드</h1>
        </div>
        <span className="text-[11px] text-[#999]">
          {new Date().toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
        </span>
      </div>
      <div className="border-t border-[#111] mb-6" />

      {/* 상단 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6 max-md:grid-cols-2 max-sm:grid-cols-1">
        <StatCard
          label="전체 사용자"
          value={topStats.totalUsers.toLocaleString("ko-KR")}
          sublabel="이번 주 신규"
          subvalue={`+${topStats.newUsersThisWeek}`}
          accent={topStats.newUsersThisWeek > 0 ? "up" : "neutral"}
        />
        <StatCard
          label="활성 구독자"
          value={topStats.activeSubCount.toLocaleString("ko-KR")}
          sublabel="해지 예정"
          subvalue={topStats.cancelingSubCount.toLocaleString("ko-KR")}
        />
        <StatCard
          label="누적 매출"
          value={formatKRW(topStats.totalRevenue)}
          sublabel={`${new Date().getMonth() + 1}월`}
          subvalue={formatKRW(topStats.revenueThisMonth)}
        />
        <StatCard
          label="월간 MRR"
          value={formatKRW(topStats.mrr)}
          sublabel="이번 달 자동결제"
          subvalue={formatKRW(topStats.upcomingCharges)}
        />
      </div>

      {/* 3 차트 Row */}
      <div className="grid grid-cols-3 gap-4 mb-6 max-lg:grid-cols-1">
        {/* 사용자 증가 */}
        <div className="border border-[#ddd] p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[12px] font-bold">사용자 증가</h3>
              <p className="text-[10px] text-[#999] mt-0.5">
                신규 {userChart.reduce((s, d) => s + d.value, 0)}명
              </p>
            </div>
            <ModeToggle value={userMode} onChange={setUserMode} />
          </div>
          <BarChart
            data={userChart}
            formatValue={(n) => `${n}명`}
            formatAxis={(n) => `${n}`}
          />
        </div>

        {/* 개별 구매 매출 */}
        <div className="border border-[#ddd] p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[12px] font-bold">단건 매출</h3>
              <p className="text-[10px] text-[#999] mt-0.5">
                {singleKpis.count}건 · 평균 {formatShortKRW(singleKpis.avg)}
              </p>
            </div>
            <ModeToggle
              value={singleRevenueMode}
              onChange={setSingleRevenueMode}
            />
          </div>
          <BarChart
            data={singleRevenueChart}
            formatValue={(n) => formatKRW(n)}
            formatAxis={(n) => formatShortKRW(n)}
          />
        </div>

        {/* 신규 구독 */}
        <div className="border border-[#ddd] p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[12px] font-bold">신규 구독</h3>
              <p className="text-[10px] text-[#999] mt-0.5">
                월간 {subKpis.monthlyCount} · 연간 {subKpis.annualCount}
              </p>
            </div>
            <ModeToggle value={subGrowthMode} onChange={setSubGrowthMode} />
          </div>
          <BarChart
            data={subGrowthChart}
            formatValue={(n) => `${n}건`}
            formatAxis={(n) => `${n}`}
          />
        </div>
      </div>

      {/* 2 테이블 Row */}
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {/* 제품별 판매 순위 */}
        <div className="border border-[#ddd] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-bold">제품별 판매 순위</h3>
            <span className="text-[10px] text-[#999]">
              {productRanking.length}개 제품
            </span>
          </div>
          {productRanking.length === 0 ? (
            <p className="text-[12px] text-[#ccc] py-8 text-center">
              판매 이력 없음
            </p>
          ) : (
            <div className="max-h-[240px] overflow-y-auto">
              <div className="flex items-center gap-2 px-1 py-1.5 text-[9px] text-[#999] font-bold tracking-[0.08em] uppercase border-b border-[#111] sticky top-0 bg-white">
                <span className="w-5 text-right">#</span>
                <span className="flex-1">상품</span>
                <span className="w-10 text-right">건</span>
                <span className="w-20 text-right">매출</span>
                <span className="w-10 text-right">%</span>
              </div>
              {productRanking.map((p, i) => {
                const ratio =
                  productRankingTotalRevenue > 0
                    ? (p.revenue / productRankingTotalRevenue) * 100
                    : 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-1 py-1.5 text-[11px] border-b border-[#eee] last:border-0"
                  >
                    <span className="w-5 text-right text-[#999]">{i + 1}</span>
                    <span className="flex-1 font-bold truncate">{p.name}</span>
                    <span className="w-10 text-right text-[#666]">
                      {p.count}
                    </span>
                    <span className="w-20 text-right font-bold">
                      {formatShortKRW(p.revenue)}
                    </span>
                    <span className="w-10 text-right text-[10px] text-[#999]">
                      {ratio.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 활성 구독자 */}
        <div className="border border-[#ddd] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-bold">활성 구독자</h3>
            <div className="flex items-center gap-2 text-[10px] text-[#999]">
              {planTotal > 0 && (
                <div className="flex w-16 h-1.5 border border-[#eee]">
                  <div className="bg-[#111]" style={{ width: `${monthlyRatio}%` }} />
                  <div className="bg-[#888]" style={{ width: `${annualRatio}%` }} />
                </div>
              )}
              <span>{activeSubList.length}명</span>
            </div>
          </div>
          {activeSubList.length === 0 ? (
            <p className="text-[12px] text-[#ccc] py-8 text-center">
              활성 구독자 없음
            </p>
          ) : (
            <div className="max-h-[240px] overflow-y-auto">
              <div className="flex items-center gap-2 px-1 py-1.5 text-[9px] text-[#999] font-bold tracking-[0.08em] uppercase border-b border-[#111] sticky top-0 bg-white">
                <span className="flex-1">이메일</span>
                <span className="w-10 text-center">플랜</span>
                <span className="w-16 text-right">다음 결제</span>
                <span className="w-16 text-right">결제액</span>
              </div>
              {activeSubList.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-1 py-1.5 text-[11px] border-b border-[#eee] last:border-0"
                >
                  <span className="flex-1 font-bold truncate">{s.email}</span>
                  <span className="w-10 text-center">
                    <span
                      className={`text-[9px] font-bold px-1 py-0 border ${
                        s.plan === "annual"
                          ? "text-[#111] border-[#888] bg-[#f5f5f5]"
                          : "text-[#111] border-[#ddd]"
                      }`}
                    >
                      {s.plan === "annual" ? "연" : "월"}
                    </span>
                  </span>
                  <span className="w-16 text-right text-[10px] text-[#999]">
                    {shortDate(s.expires_at)}
                  </span>
                  <span className="w-16 text-right font-bold">
                    {s.amount ? formatShortKRW(s.amount) : "무상"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
