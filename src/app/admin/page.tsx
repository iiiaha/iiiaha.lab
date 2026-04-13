"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

interface User {
  id: string;
  created_at: string;
}

interface Order {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  cancel_at_period_end: boolean;
}

type Mode = "day" | "week" | "month";

// 한국 시간대 기준으로 일 단위 키 생성 (YYYY-MM-DD)
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 주 시작 (일요일) 기준 키
function weekStart(d: Date): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 모드에 따라 마지막 N개 버킷 생성
function buildBuckets(
  events: { date: string; value: number }[],
  mode: Mode
): { label: string; value: number }[] {
  const now = new Date();
  const buckets: { key: string; label: string; value: number }[] = [];

  if (mode === "day") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      buckets.push({ key, label, value: 0 });
    }
    for (const e of events) {
      const key = dayKey(new Date(e.date));
      const b = buckets.find((b) => b.key === key);
      if (b) b.value += e.value;
    }
  } else if (mode === "week") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const ws = weekStart(d);
      const key = dayKey(ws);
      const label = `${ws.getMonth() + 1}/${ws.getDate()}`;
      buckets.push({ key, label, value: 0 });
    }
    for (const e of events) {
      const ws = weekStart(new Date(e.date));
      const key = dayKey(ws);
      const b = buckets.find((b) => b.key === key);
      if (b) b.value += e.value;
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const label = `${d.getFullYear().toString().slice(2)}.${d.getMonth() + 1}`;
      buckets.push({ key, label, value: 0 });
    }
    for (const e of events) {
      const d = new Date(e.date);
      const key = monthKey(d);
      const b = buckets.find((b) => b.key === key);
      if (b) b.value += e.value;
    }
  }

  return buckets.map(({ label, value }) => ({ label, value }));
}

function BarChart({
  data,
  formatValue,
  height = 160,
}: {
  data: { label: string; value: number }[];
  formatValue?: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [hover, setHover] = useState<number | null>(null);

  // 라벨은 처음/중간/마지막만 보이게
  const labelIdxs = new Set<number>([0, Math.floor(data.length / 2), data.length - 1]);

  return (
    <div>
      <div
        className="flex items-end gap-[2px] border-b border-[#111]"
        style={{ height: `${height}px` }}
      >
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 20);
          const isHover = hover === i;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full relative"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {isHover && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#111] text-white text-[10px] px-1.5 py-0.5 whitespace-nowrap z-10">
                  {d.label} · {formatValue ? formatValue(d.value) : d.value}
                </div>
              )}
              <div
                className={`w-full transition-colors ${
                  isHover ? "bg-[#333]" : "bg-[#111]"
                }`}
                style={{ height: `${Math.max(h, d.value > 0 ? 2 : 0)}px` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-[9px] text-[#999] text-center"
          >
            {labelIdxs.has(i) ? d.label : ""}
          </div>
        ))}
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
            className={`text-[11px] px-3 py-1 border-0 cursor-pointer ${
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
        supabase.from("orders").select("id, amount, status, created_at"),
        supabase.from("subscriptions").select("id, user_id, status, cancel_at_period_end"),
      ]);

      setUsers((usersRes.users as User[]) ?? []);
      setOrders((ordersRes.data as Order[]) ?? []);
      setSubs((subsRes.data as Subscription[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeSubs = subs.filter(
      (s) => s.status === "active" && !s.cancel_at_period_end
    ).length;
    const cancelingSubs = subs.filter(
      (s) => s.status === "active" && s.cancel_at_period_end
    ).length;
    const paidOrders = orders.filter((o) => o.status === "paid");
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const paidOrderCount = paidOrders.length;
    return { totalUsers, activeSubs, cancelingSubs, totalRevenue, paidOrderCount };
  }, [users, orders, subs]);

  const userChart = useMemo(() => {
    const events = users.map((u) => ({ date: u.created_at, value: 1 }));
    return buildBuckets(events, userMode);
  }, [users, userMode]);

  const revenueChart = useMemo(() => {
    const events = orders
      .filter((o) => o.status === "paid" && o.amount > 0)
      .map((o) => ({ date: o.created_at, value: o.amount }));
    return buildBuckets(events, revenueMode);
  }, [orders, revenueMode]);

  if (loading) {
    return <p className="text-[14px] text-[#999]">로딩 중...</p>;
  }

  const cards = [
    { label: "전체 사용자", value: stats.totalUsers.toLocaleString("ko-KR") },
    { label: "활성 구독자", value: stats.activeSubs.toLocaleString("ko-KR") },
    { label: "해지 예정", value: stats.cancelingSubs.toLocaleString("ko-KR") },
    {
      label: "총 매출",
      value: `₩${stats.totalRevenue.toLocaleString("ko-KR")}`,
    },
  ];

  return (
    <div>
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">대시보드</h1>
      <div className="border-t border-[#111] mb-8" />

      {/* 상단 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-10 max-md:grid-cols-2 max-sm:grid-cols-1">
        {cards.map(({ label, value }) => (
          <div key={label} className="border border-[#ddd] p-4">
            <p className="text-[10px] text-[#999] font-bold uppercase tracking-[0.05em] mb-2">
              {label}
            </p>
            <p className="text-[20px] font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* 사용자 증가 그래프 */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-bold">사용자 증가</h2>
          <ModeToggle value={userMode} onChange={setUserMode} />
        </div>
        <BarChart data={userChart} formatValue={(n) => `${n}명`} />
        <p className="text-[10px] text-[#999] mt-2">
          {userMode === "day"
            ? "최근 30일"
            : userMode === "week"
              ? "최근 12주"
              : "최근 12개월"}{" "}
          · 기간 내 신규 가입 {userChart.reduce((s, d) => s + d.value, 0)}명
        </p>
      </section>

      {/* 매출 그래프 */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-bold">결제 매출</h2>
          <ModeToggle value={revenueMode} onChange={setRevenueMode} />
        </div>
        <BarChart
          data={revenueChart}
          formatValue={(n) => `₩${n.toLocaleString("ko-KR")}`}
        />
        <p className="text-[10px] text-[#999] mt-2">
          {revenueMode === "day"
            ? "최근 30일"
            : revenueMode === "week"
              ? "최근 12주"
              : "최근 12개월"}{" "}
          · 기간 내 매출 ₩
          {revenueChart
            .reduce((s, d) => s + d.value, 0)
            .toLocaleString("ko-KR")}{" "}
          · 결제 {stats.paidOrderCount}건
        </p>
      </section>
    </div>
  );
}
