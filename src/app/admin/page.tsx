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
  products: { name: string } | null;
}

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  cancel_at_period_end: boolean;
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

// ─── 포맷 유틸 ──────────────────────────────────────────────

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

// ─── 차트 컴포넌트 ──────────────────────────────────────────

function BarChart({
  data,
  formatValue,
  formatAxis,
  unit,
}: {
  data: { label: string; value: number }[];
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rawMax = Math.max(0, ...data.map((d) => d.value));
  const max = niceMax(rawMax);
  const avg = data.reduce((s, d) => s + d.value, 0) / data.length;

  const isEmpty = rawMax === 0;

  const height = 240;
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
      {/* Y축 */}
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
        {/* 차트 본체 */}
        <div className="relative" style={{ height: `${height}px` }}>
          {/* 가이드라인 */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="border-t border-[#f0f0f0]" />
            <div className="border-t border-[#f0f0f0]" />
            <div className="border-t border-[#111]" />
          </div>

          {/* 평균선 */}
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

          {/* 막대 */}
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

        {/* X축 라벨 */}
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

        {/* 범례 */}
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

// ─── 스탯 카드 ──────────────────────────────────────────────

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
    <div className="border border-[#111] p-8 relative">
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

// ─── 스켈레톤 ───────────────────────────────────────────────

function Skeleton() {
  return (
    <div>
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">대시보드</h1>
      <div className="border-t border-[#111] mb-8" />
      <div className="grid grid-cols-4 gap-3 mb-10 max-md:grid-cols-2 max-sm:grid-cols-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-[#ddd] p-5 h-[110px]">
            <div className="h-3 bg-[#f5f5f5] w-1/2 mb-4" />
            <div className="h-6 bg-[#f5f5f5] w-2/3" />
          </div>
        ))}
      </div>
      <div className="border border-[#ddd] p-5 h-[240px] mb-6 animate-pulse" />
      <div className="border border-[#ddd] p-5 h-[240px] animate-pulse" />
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
  const [revenueMode, setRevenueMode] = useState<Mode>("day");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [usersRes, ordersRes, subsRes] = await Promise.all([
        fetch("/api/admin/users").then((r) => r.json()),
        supabase
          .from("orders")
          .select(
            "id, amount, status, created_at, payment_key, subscription_id, user_id, products(name)"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("subscriptions")
          .select("id, user_id, status, cancel_at_period_end"),
      ]);

      setUsers((usersRes.users as User[]) ?? []);
      setOrders((ordersRes.data as unknown as Order[]) ?? []);
      setSubs((subsRes.data as Subscription[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  // ─── 파생 상태 ─────────────────────────────────────────

  const now = useMemo(() => Date.now(), []);
  const weekAgo = now - 7 * 86400 * 1000;
  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }, []);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const newUsersThisWeek = users.filter(
      (u) => new Date(u.created_at).getTime() >= weekAgo
    ).length;

    const activeSubs = subs.filter(
      (s) => s.status === "active" && !s.cancel_at_period_end
    ).length;
    const cancelingSubs = subs.filter(
      (s) => s.status === "active" && s.cancel_at_period_end
    ).length;

    const paidOrders = orders.filter((o) => o.status === "paid");
    const totalRevenue = paidOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const revenueThisMonth = paidOrders
      .filter((o) => new Date(o.created_at).getTime() >= monthStart)
      .reduce((s, o) => s + (o.amount || 0), 0);

    // 단건 vs 구독 매출 (payment_key로 구분)
    const indivRevenue = paidOrders
      .filter((o) => !o.subscription_id && (o.amount || 0) > 0)
      .reduce((s, o) => s + (o.amount || 0), 0);
    const subRevenue = paidOrders
      .filter(
        (o) =>
          o.payment_key?.startsWith("bill_") ||
          (o.subscription_id && (o.amount || 0) > 0)
      )
      .reduce((s, o) => s + (o.amount || 0), 0);

    const paidOrderCount = paidOrders.filter((o) => (o.amount || 0) > 0).length;
    const ordersThisMonth = paidOrders
      .filter(
        (o) =>
          new Date(o.created_at).getTime() >= monthStart && (o.amount || 0) > 0
      ).length;

    return {
      totalUsers,
      newUsersThisWeek,
      activeSubs,
      cancelingSubs,
      totalRevenue,
      revenueThisMonth,
      indivRevenue,
      subRevenue,
      paidOrderCount,
      ordersThisMonth,
    };
  }, [users, orders, subs, weekAgo, monthStart]);

  const userChart = useMemo(() => {
    const events = users.map((u) => ({ date: u.created_at, value: 1 }));
    return buildBuckets(events, userMode);
  }, [users, userMode]);

  const revenueChart = useMemo(() => {
    const events = orders
      .filter((o) => o.status === "paid" && (o.amount || 0) > 0)
      .map((o) => ({ date: o.created_at, value: o.amount }));
    return buildBuckets(events, revenueMode);
  }, [orders, revenueMode]);

  const recentPaidOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === "paid" && (o.amount || 0) > 0)
        .slice(0, 5),
    [orders]
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
  const revenueChartTotal = revenueChart.reduce((s, d) => s + d.value, 0);

  const subRatio =
    stats.totalRevenue > 0
      ? Math.round((stats.subRevenue / stats.totalRevenue) * 100)
      : 0;
  const indivRatio =
    stats.totalRevenue > 0
      ? Math.round((stats.indivRevenue / stats.totalRevenue) * 100)
      : 0;

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
          value={stats.totalUsers.toLocaleString("ko-KR")}
          sublabel="이번 주 신규"
          subvalue={`+${stats.newUsersThisWeek}`}
          accent={stats.newUsersThisWeek > 0 ? "up" : "neutral"}
        />
        <StatCard
          label="활성 구독자"
          value={stats.activeSubs.toLocaleString("ko-KR")}
          sublabel="해지 예정"
          subvalue={stats.cancelingSubs.toLocaleString("ko-KR")}
        />
        <StatCard
          label="누적 매출"
          value={formatKRW(stats.totalRevenue)}
          sublabel={`${new Date().getMonth() + 1}월`}
          subvalue={formatKRW(stats.revenueThisMonth)}
        />
        <StatCard
          label="결제 건수"
          value={stats.paidOrderCount.toLocaleString("ko-KR")}
          sublabel={`${new Date().getMonth() + 1}월`}
          subvalue={stats.ordersThisMonth.toLocaleString("ko-KR")}
        />
      </div>

      {/* 사용자 증가 */}
      <section className="mb-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-[16px] font-bold tracking-[-0.01em]">사용자 증가</h2>
            <p className="text-[12px] text-[#999] mt-1.5">
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
          </div>
          <ModeToggle value={userMode} onChange={setUserMode} />
        </div>
        <div className="border border-[#ddd] p-8">
          <BarChart
            data={userChart}
            formatValue={(n) => `${n}명`}
            formatAxis={(n) => `${n}`}
            unit="신규 가입"
          />
        </div>
      </section>

      {/* 결제 매출 */}
      <section className="mb-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-[16px] font-bold tracking-[-0.01em]">결제 매출</h2>
            <p className="text-[12px] text-[#999] mt-1.5">
              {revenueMode === "day"
                ? "최근 30일"
                : revenueMode === "week"
                  ? "최근 12주"
                  : "최근 12개월"}{" "}
              · 기간 내 매출{" "}
              <strong className="text-[#111]">
                {formatKRW(revenueChartTotal)}
              </strong>
            </p>
          </div>
          <ModeToggle value={revenueMode} onChange={setRevenueMode} />
        </div>
        <div className="border border-[#ddd] p-8">
          <BarChart
            data={revenueChart}
            formatValue={(n) => formatKRW(n)}
            formatAxis={(n) => formatShortKRW(n)}
            unit="결제 매출"
          />
        </div>

        {/* 매출 구성 */}
        {stats.totalRevenue > 0 && (
          <div className="mt-6 border border-[#ddd] p-6">
            <p className="text-[11px] text-[#999] font-bold uppercase tracking-[0.08em] mb-4">
              매출 구성 (누적)
            </p>
            <div className="flex h-2.5 mb-5 border border-[#eee]">
              <div
                className="bg-[#111]"
                style={{ width: `${indivRatio}%` }}
              />
              <div
                className="bg-[#888]"
                style={{ width: `${subRatio}%` }}
              />
            </div>
            <div className="flex justify-between text-[13px]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 bg-[#111]" />
                <span className="text-[#111] font-bold">단건 구매</span>
                <span className="text-[#999]">
                  {formatKRW(stats.indivRevenue)} · {indivRatio}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 bg-[#888]" />
                <span className="text-[#111] font-bold">구독</span>
                <span className="text-[#999]">
                  {formatKRW(stats.subRevenue)} · {subRatio}%
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 최근 활동 */}
      <section className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="border border-[#ddd] p-8">
          <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-[0.08em] mb-5">
            최근 결제
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
