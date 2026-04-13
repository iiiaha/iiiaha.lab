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

// ─── 날짜 유틸 ──────────────────────────────────────────────

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

function bucketCount(mode: Mode): number {
  return mode === "day" ? 30 : mode === "week" ? 12 : 12;
}

function buildBuckets(
  events: { date: string; value: number }[],
  mode: Mode
): { label: string; value: number }[] {
  const now = new Date();
  const buckets: { key: string; label: string; value: number }[] = [];
  const n = bucketCount(mode);

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

// ─── 포맷 ──────────────────────────────────────────────────

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

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear().toString().slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
}

// ─── 차트 ──────────────────────────────────────────────────

function BarChart({
  data,
  formatValue,
  formatAxis,
  unit,
  height = 240,
}: {
  data: { label: string; value: number }[];
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
  unit: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rawMax = Math.max(0, ...data.map((d) => d.value));
  const max = niceMax(rawMax);
  const avg = data.reduce((s, d) => s + d.value, 0) / data.length;

  const isEmpty = rawMax === 0;

  const ticks = [max, Math.round(max / 2), 0];

  const labelIdxs = new Set<number>([
    0,
    Math.floor(data.length / 4),
    Math.floor(data.length / 2),
    Math.floor((data.length * 3) / 4),
    data.length - 1,
  ]);

  return (
    <div className="flex">
      <div
        className="flex flex-col justify-between text-[11px] text-[#999] text-right pr-3 w-[56px] shrink-0"
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
            >
              <span className="absolute right-0 -top-4 text-[11px] text-[#999] bg-white px-1.5">
                평균 {formatValue(Math.round(avg))}
              </span>
            </div>
          )}

          <div className="absolute inset-0 flex items-end gap-[2px]">
            {isEmpty ? (
              <div className="flex-1 flex items-center justify-center text-[12px] text-[#ccc]">
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
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-[#111] text-white text-[11px] px-2.5 py-1 whitespace-nowrap z-10 leading-tight">
                        <div className="font-bold">{formatValue(d.value)}</div>
                        <div className="text-[#999] text-[10px] mt-0.5">{d.label}</div>
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

        <div className="flex gap-[2px] mt-2">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex-1 text-[11px] text-[#999] text-center truncate"
            >
              {labelIdxs.has(i) ? d.label : ""}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 mt-5 text-[11px] text-[#999]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-[#111]" />
            {unit}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 border-t border-dashed border-[#bbb]" />
            평균
          </span>
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
    <div className="inline-flex border border-[#111]">
      {(["day", "week", "month"] as Mode[]).map((m) => {
        const label = m === "day" ? "일" : m === "week" ? "주" : "월";
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`text-[11px] px-3 py-1 border-0 cursor-pointer transition-colors ${
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

// ─── 카드 / 섹션 헤더 ───────────────────────────────────────

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
    <div className="border border-[#111] p-8">
      <p className="text-[11px] text-[#999] font-bold uppercase tracking-[0.08em] mb-4">
        {label}
      </p>
      <p className="text-[32px] font-bold leading-none tracking-[-0.01em]">
        {value}
      </p>
      {sublabel && (
        <div className="mt-5 pt-4 border-t border-[#eee] flex items-baseline justify-between">
          <span className="text-[12px] text-[#999]">{sublabel}</span>
          <span
            className={`text-[13px] font-bold ${
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

function SectionHeader({
  title,
  description,
  right,
}: {
  title: string;
  description: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.01em]">{title}</h2>
        <p className="text-[13px] text-[#999] mt-1.5">{description}</p>
      </div>
      {right}
    </div>
  );
}

function KpiRow({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 mb-6 py-4 border-y border-[#eee]">
      {items.map((kpi, i) => (
        <div key={i} className="flex items-baseline gap-2">
          <span className="text-[11px] text-[#999] uppercase tracking-[0.05em]">
            {kpi.label}
          </span>
          <span className="text-[15px] font-bold">{kpi.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── 스켈레톤 ───────────────────────────────────────────────

function Skeleton() {
  return (
    <div>
      <div className="h-10 w-48 bg-[#f5f5f5] mb-8" />
      <div className="border-t border-[#111] mb-10" />
      <div className="grid grid-cols-4 gap-5 mb-16 max-md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-[#ddd] p-8 h-[140px]">
            <div className="h-3 bg-[#f5f5f5] w-1/2 mb-5" />
            <div className="h-7 bg-[#f5f5f5] w-2/3" />
          </div>
        ))}
      </div>
      <div className="border border-[#ddd] p-8 h-[320px] mb-10 animate-pulse" />
      <div className="border border-[#ddd] p-8 h-[320px] animate-pulse" />
    </div>
  );
}

// ─── 메인 ──────────────────────────────────────────────────

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

  // ─── 파생 상태 ─────────────────────────────────────────

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

  // 단건 구매 주문 분리
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

  // 활성 구독
  const activeSubs = useMemo(
    () =>
      subs.filter((s) => s.status === "active" && !s.cancel_at_period_end),
    [subs]
  );
  const cancelingSubs = useMemo(
    () =>
      subs.filter((s) => s.status === "active" && s.cancel_at_period_end),
    [subs]
  );

  // ─── 상단 카드용 stats ────────────────────────────────

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

    const revenueThisMonth = [
      ...singlePaidOrders.filter(
        (o) => new Date(o.created_at).getTime() >= monthStart
      ),
      ...subs.filter(
        (s) =>
          s.amount &&
          s.amount > 0 &&
          new Date(s.started_at).getTime() >= monthStart
      ),
    ].reduce((s, item) => s + ((item as Order | Subscription).amount || 0), 0);

    // MRR: active subscriptions' monthly-normalized amount
    const mrr = activeSubs.reduce((s, sub) => {
      const amt = sub.amount || 0;
      return s + (sub.plan === "annual" ? Math.round(amt / 12) : amt);
    }, 0);

    // 이번 달 자동결제 예정: active subs whose expires_at is within current month
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
  }, [users, singlePaidOrders, subs, activeSubs, cancelingSubs, weekAgo, monthStart, nextMonthStart, now]);

  // ─── 사용자 차트 ────────────────────────────────────

  const userChart = useMemo(() => {
    const events = users.map((u) => ({ date: u.created_at, value: 1 }));
    return buildBuckets(events, userMode);
  }, [users, userMode]);

  // ─── 개별 구매 KPIs + 차트 ───────────────────────────

  const singleKpis = useMemo(() => {
    const total = singlePaidOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const thisMonth = singlePaidOrders
      .filter((o) => new Date(o.created_at).getTime() >= monthStart)
      .reduce((s, o) => s + (o.amount || 0), 0);
    const count = singlePaidOrders.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, thisMonth, count, avg };
  }, [singlePaidOrders, monthStart]);

  const singleRevenueChart = useMemo(() => {
    const events = singlePaidOrders.map((o) => ({
      date: o.created_at,
      value: o.amount,
    }));
    return buildBuckets(events, singleRevenueMode);
  }, [singlePaidOrders, singleRevenueMode]);

  // ─── 제품별 판매 순위 ────────────────────────────────

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

  // ─── 구독 KPIs ───────────────────────────────────────

  const subKpis = useMemo(() => {
    const monthlyCount = activeSubs.filter((s) => s.plan === "monthly").length;
    const annualCount = activeSubs.filter((s) => s.plan === "annual").length;
    const avgMRR =
      activeSubs.length > 0
        ? Math.round(topStats.mrr / activeSubs.length)
        : 0;
    return {
      monthlyCount,
      annualCount,
      avgMRR,
    };
  }, [activeSubs, topStats.mrr]);

  const planTotal = subKpis.monthlyCount + subKpis.annualCount;
  const monthlyRatio =
    planTotal > 0 ? Math.round((subKpis.monthlyCount / planTotal) * 100) : 0;
  const annualRatio = planTotal > 0 ? 100 - monthlyRatio : 0;

  // ─── 구독 증가 차트 ─────────────────────────────────

  const subGrowthChart = useMemo(() => {
    const events = subs.map((s) => ({ date: s.started_at, value: 1 }));
    return buildBuckets(events, subGrowthMode);
  }, [subs, subGrowthMode]);

  // ─── 활성 구독자 목록 (이메일 조인) ──────────────────

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

  // ─── 최근 활동 ──────────────────────────────────────

  const recentPaidOrders = useMemo(
    () => singlePaidOrders.slice(0, 5),
    [singlePaidOrders]
  );

  const recentUsers = useMemo(
    () =>
      [...users]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 5),
    [users]
  );

  if (loading) return <Skeleton />;

  const userChartTotal = userChart.reduce((s, d) => s + d.value, 0);
  const singleRevenueChartTotal = singleRevenueChart.reduce(
    (s, d) => s + d.value,
    0
  );
  const subGrowthChartTotal = subGrowthChart.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em]">대시보드</h1>
          <p className="text-[13px] text-[#999] mt-1.5">
            iiiaha.lab 운영 현황 한눈에
          </p>
        </div>
        <span className="text-[13px] text-[#999]">
          {new Date().toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
        </span>
      </div>
      <div className="border-t border-[#111] mb-10" />

      {/* 상단 카드 */}
      <div className="grid grid-cols-4 gap-5 mb-16 max-md:grid-cols-2 max-sm:grid-cols-1">
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

      {/* ──────────── 사용자 섹션 ──────────── */}
      <section className="mb-20">
        <SectionHeader
          title="사용자"
          description="가입 추이와 최근 가입자를 확인합니다"
          right={<ModeToggle value={userMode} onChange={setUserMode} />}
        />
        <p className="text-[12px] text-[#999] mb-4">
          {userMode === "day"
            ? "최근 30일"
            : userMode === "week"
              ? "최근 12주"
              : "최근 12개월"}{" "}
          · 기간 내 신규 가입{" "}
          <strong className="text-[#111]">
            {userChartTotal.toLocaleString("ko-KR")}명
          </strong>
        </p>
        <div className="border border-[#ddd] p-8">
          <BarChart
            data={userChart}
            formatValue={(n) => `${n}명`}
            formatAxis={(n) => `${n}`}
            unit="신규 가입"
          />
        </div>
      </section>

      {/* ──────────── 개별 구매 섹션 ──────────── */}
      <section className="mb-20">
        <SectionHeader
          title="개별 구매"
          description="단건 결제 매출, 제품별 판매 실적"
          right={
            <ModeToggle
              value={singleRevenueMode}
              onChange={setSingleRevenueMode}
            />
          }
        />

        <KpiRow
          items={[
            { label: "누적 매출", value: formatKRW(singleKpis.total) },
            { label: "이번 달", value: formatKRW(singleKpis.thisMonth) },
            { label: "결제 건수", value: singleKpis.count.toLocaleString("ko-KR") },
            { label: "평균 주문", value: formatKRW(singleKpis.avg) },
          ]}
        />

        <p className="text-[12px] text-[#999] mb-4">
          {singleRevenueMode === "day"
            ? "최근 30일"
            : singleRevenueMode === "week"
              ? "최근 12주"
              : "최근 12개월"}{" "}
          · 기간 내 매출{" "}
          <strong className="text-[#111]">
            {formatKRW(singleRevenueChartTotal)}
          </strong>
        </p>

        <div className="border border-[#ddd] p-8 mb-8">
          <BarChart
            data={singleRevenueChart}
            formatValue={(n) => formatKRW(n)}
            formatAxis={(n) => formatShortKRW(n)}
            unit="단건 매출"
          />
        </div>

        {/* 제품별 판매 순위 */}
        <div className="border border-[#ddd] p-8">
          <p className="text-[11px] text-[#999] font-bold uppercase tracking-[0.08em] mb-5">
            제품별 판매 순위
          </p>
          {productRanking.length === 0 ? (
            <p className="text-[13px] text-[#ccc] py-6 text-center">
              판매 이력 없음
            </p>
          ) : (
            <div>
              <div className="flex items-center gap-4 px-2 py-2 text-[11px] text-[#999] font-bold tracking-[0.08em] uppercase border-b border-[#111]">
                <span className="w-8 shrink-0 text-right">#</span>
                <span className="flex-1">상품</span>
                <span className="w-20 shrink-0 text-right">판매수</span>
                <span className="w-28 shrink-0 text-right">매출</span>
                <span className="w-[200px] shrink-0">비중</span>
                <span className="w-12 shrink-0 text-right">%</span>
              </div>
              {productRanking.map((p, i) => {
                const ratio =
                  productRankingTotalRevenue > 0
                    ? (p.revenue / productRankingTotalRevenue) * 100
                    : 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 px-2 py-3 text-[13px] border-b border-[#eee] last:border-0"
                  >
                    <span className="w-8 shrink-0 text-right text-[#999]">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-bold truncate">{p.name}</span>
                    <span className="w-20 shrink-0 text-right text-[#666]">
                      {p.count.toLocaleString("ko-KR")}건
                    </span>
                    <span className="w-28 shrink-0 text-right font-bold">
                      {formatKRW(p.revenue)}
                    </span>
                    <div className="w-[200px] shrink-0 h-1.5 bg-[#f0f0f0] relative">
                      <div
                        className="absolute inset-y-0 left-0 bg-[#111]"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-[11px] text-[#999]">
                      {ratio.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ──────────── 구독 섹션 ──────────── */}
      <section className="mb-20">
        <SectionHeader
          title="구독"
          description="반복 결제 매출과 구독자 추이"
          right={
            <ModeToggle value={subGrowthMode} onChange={setSubGrowthMode} />
          }
        />

        <KpiRow
          items={[
            {
              label: "활성 구독자",
              value: `${topStats.activeSubCount.toLocaleString("ko-KR")}명`,
            },
            { label: "월간 MRR", value: formatKRW(topStats.mrr) },
            {
              label: "이번 달 자동결제",
              value: formatKRW(topStats.upcomingCharges),
            },
            {
              label: "평균 구독 가치",
              value: formatKRW(subKpis.avgMRR),
            },
          ]}
        />

        {/* 플랜 분포 */}
        {planTotal > 0 && (
          <div className="border border-[#ddd] p-8 mb-8">
            <p className="text-[11px] text-[#999] font-bold uppercase tracking-[0.08em] mb-5">
              플랜 분포
            </p>
            <div className="flex h-2.5 mb-5 border border-[#eee]">
              <div
                className="bg-[#111]"
                style={{ width: `${monthlyRatio}%` }}
              />
              <div
                className="bg-[#888]"
                style={{ width: `${annualRatio}%` }}
              />
            </div>
            <div className="flex justify-between text-[13px]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 bg-[#111]" />
                <span className="text-[#111] font-bold">월간</span>
                <span className="text-[#999]">
                  {subKpis.monthlyCount}명 · {monthlyRatio}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 bg-[#888]" />
                <span className="text-[#111] font-bold">연간</span>
                <span className="text-[#999]">
                  {subKpis.annualCount}명 · {annualRatio}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 신규 구독 차트 */}
        <p className="text-[12px] text-[#999] mb-4">
          {subGrowthMode === "day"
            ? "최근 30일"
            : subGrowthMode === "week"
              ? "최근 12주"
              : "최근 12개월"}{" "}
          · 기간 내 신규 구독{" "}
          <strong className="text-[#111]">{subGrowthChartTotal}건</strong>
        </p>
        <div className="border border-[#ddd] p-8 mb-8">
          <BarChart
            data={subGrowthChart}
            formatValue={(n) => `${n}건`}
            formatAxis={(n) => `${n}`}
            unit="신규 구독"
          />
        </div>

        {/* 활성 구독자 목록 */}
        <div className="border border-[#ddd] p-8">
          <p className="text-[11px] text-[#999] font-bold uppercase tracking-[0.08em] mb-5">
            활성 구독자 목록 · 다음 결제일 순
          </p>
          {activeSubList.length === 0 ? (
            <p className="text-[13px] text-[#ccc] py-6 text-center">
              활성 구독자 없음
            </p>
          ) : (
            <div>
              <div className="flex items-center gap-4 px-2 py-2 text-[11px] text-[#999] font-bold tracking-[0.08em] uppercase border-b border-[#111]">
                <span className="flex-1">이메일</span>
                <span className="w-16 shrink-0 text-center">플랜</span>
                <span className="w-24 shrink-0 text-right">시작일</span>
                <span className="w-24 shrink-0 text-right">다음 결제</span>
                <span className="w-24 shrink-0 text-right">결제액</span>
                <span className="w-24 shrink-0 text-right">월 환산</span>
              </div>
              {activeSubList.map((s) => {
                const normalized =
                  s.plan === "annual" && s.amount
                    ? Math.round(s.amount / 12)
                    : s.amount || 0;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-4 px-2 py-3 text-[13px] border-b border-[#eee] last:border-0"
                  >
                    <span className="flex-1 font-bold truncate">{s.email}</span>
                    <span className="w-16 shrink-0 flex justify-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 border ${
                          s.plan === "annual"
                            ? "text-[#111] border-[#888] bg-[#f5f5f5]"
                            : "text-[#111] border-[#ddd]"
                        }`}
                      >
                        {s.plan === "annual" ? "연간" : "월간"}
                      </span>
                    </span>
                    <span className="w-24 shrink-0 text-right text-[11px] text-[#999]">
                      {shortDate(s.started_at)}
                    </span>
                    <span className="w-24 shrink-0 text-right text-[11px] text-[#666]">
                      {shortDate(s.expires_at)}
                    </span>
                    <span className="w-24 shrink-0 text-right font-bold">
                      {s.amount ? formatKRW(s.amount) : "무상"}
                    </span>
                    <span className="w-24 shrink-0 text-right text-[11px] text-[#999]">
                      {normalized > 0 ? formatKRW(normalized) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ──────────── 최근 활동 ──────────── */}
      <section className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="border border-[#ddd] p-8">
          <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-[0.08em] mb-5">
            최근 단건 결제
          </h3>
          {recentPaidOrders.length === 0 ? (
            <p className="text-[13px] text-[#ccc] py-6 text-center">
              결제 내역 없음
            </p>
          ) : (
            <div className="flex flex-col">
              {recentPaidOrders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between py-3 border-b border-[#eee] last:border-0 text-[13px]"
                >
                  <span className="truncate flex-1 font-bold">
                    {o.products?.name ?? "—"}
                  </span>
                  <span className="text-[#111] mx-4 shrink-0">
                    {formatKRW(o.amount)}
                  </span>
                  <span className="text-[11px] text-[#999] w-16 text-right shrink-0">
                    {relativeTime(o.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-[#ddd] p-8">
          <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-[0.08em] mb-5">
            최근 가입
          </h3>
          {recentUsers.length === 0 ? (
            <p className="text-[13px] text-[#ccc] py-6 text-center">
              가입 내역 없음
            </p>
          ) : (
            <div className="flex flex-col">
              {recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-3 border-b border-[#eee] last:border-0 text-[13px]"
                >
                  <span className="truncate flex-1 font-bold">{u.email}</span>
                  <span className="text-[11px] text-[#999] border border-[#eee] px-2 py-0.5 mx-4 shrink-0">
                    {u.provider}
                  </span>
                  <span className="text-[11px] text-[#999] w-16 text-right shrink-0">
                    {relativeTime(u.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
