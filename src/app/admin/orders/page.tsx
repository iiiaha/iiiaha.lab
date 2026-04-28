"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

interface Order {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_key: string | null;
  subscription_id: string | null;
  created_at: string;
  products: { name: string; slug: string } | null;
  user_email?: string;
}

type Filter = "all" | "paid" | "refunded";
type TypeFilter = "all" | "single" | "subscription" | "admin";

const PER_PAGE = 50;

function shortDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear().toString().slice(2)}.${d.getMonth() + 1}.${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function orderType(o: Order): "single" | "subscription" | "admin" {
  if (o.payment_key?.startsWith("admin")) return "admin";
  if (o.subscription_id) return "subscription";
  return "single";
}

export default function AdminOrders() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, products(name, slug)")
      .order("created_at", { ascending: false });

    if (!data) {
      setLoading(false);
      return;
    }

    const userIds = [...new Set(data.map((o) => o.user_id))];
    const emailMap: Record<string, string> = {};
    for (const uid of userIds) {
      const res = await fetch(`/api/user-email?id=${uid}&full=true`);
      const d = await res.json();
      emailMap[uid] = d.name || uid.slice(0, 8);
    }

    const enriched = data.map((o) => ({
      ...o,
      user_email: emailMap[o.user_id] || o.user_id.slice(0, 8),
    })) as Order[];

    setOrders(enriched);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filter, typeFilter]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const refundOrder = async (orderId: string, amount: number, productName: string) => {
    if (
      !confirm(
        `${productName} 주문을 환불 처리하시겠습니까?\n\n` +
          `· ₩${amount.toLocaleString("ko-KR")}이 고객 카드로 환불됩니다\n` +
          `· 해당 주문의 라이선스가 즉시 revoke됩니다\n` +
          `· 되돌릴 수 없습니다`
      )
    )
      return;

    const res = await fetch("/api/admin/orders/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
    const data = await res.json();
    if (res.ok) {
      showMessage(
        `환불 완료 (₩${data.refunded_amount.toLocaleString("ko-KR")} · 라이선스 ${data.revoked_licenses}개 revoke)`
      );
      load();
    } else {
      showMessage(`오류: ${data.error}`);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (typeFilter !== "all" && orderType(o) !== typeFilter) return false;
      if (q) {
        const match =
          o.user_email?.toLowerCase().includes(q) ||
          o.products?.name.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [orders, filter, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid");
    const totalRevenue = paid.reduce((s, o) => s + (o.amount || 0), 0);
    const refundedCount = orders.filter((o) => o.status === "refunded").length;
    return {
      total: orders.length,
      paid: paid.length,
      refunded: refundedCount,
      revenue: totalRevenue,
    };
  }, [orders]);

  if (loading) return <p className="text-[14px] text-[#999]">로딩 중...</p>;

  const statusLabel = (s: string) =>
    s === "paid" ? "결제완료" : s === "refunded" ? "환불됨" : s;
  const statusColor = (s: string) =>
    s === "paid"
      ? "text-green-700 border-green-600 bg-green-50"
      : s === "refunded"
        ? "text-red-700 border-red-500 bg-red-50"
        : "text-[#999] border-[#ddd]";

  const typeLabel = (t: "single" | "subscription" | "admin") =>
    t === "single" ? "단건" : t === "subscription" ? "구독" : "관리자";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em]">주문 관리</h1>
          <p className="text-[13px] text-[#999] mt-1.5">
            결제·환불·구독 자동 결제 이력을 한 곳에서 확인합니다
          </p>
        </div>
        <div className="flex items-center gap-7 text-[12px] text-[#999]">
          <span>
            전체 <strong className="text-[#111] text-[14px]">{stats.total}</strong>
          </span>
          <span>
            결제완료 <strong className="text-[#111] text-[14px]">{stats.paid}</strong>
          </span>
          <span>
            환불 <strong className="text-[#111] text-[14px]">{stats.refunded}</strong>
          </span>
          <span>
            매출{" "}
            <strong className="text-[#111] text-[14px]">
              ₩{stats.revenue.toLocaleString("ko-KR")}
            </strong>
          </span>
        </div>
      </div>
      <div className="border-t border-[#111] mb-6" />
      <div className="text-[12px] text-green-600 mb-5 h-5">{message}</div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex border border-[#ddd]">
          {(["all", "paid", "refunded"] as Filter[]).map((f) => {
            const label =
              f === "all"
                ? "전체"
                : f === "paid"
                  ? "결제완료"
                  : "환불됨";
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
        <div className="flex border border-[#ddd]">
          {(["all", "single", "subscription", "admin"] as TypeFilter[]).map((f) => {
            const label =
              f === "all"
                ? "전체"
                : f === "single"
                  ? "단건"
                  : f === "subscription"
                    ? "구독"
                    : "관리자";
            return (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`text-[12px] px-4 py-2 border-0 cursor-pointer ${
                  typeFilter === f
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
          placeholder="계정, 제품명, 주문 ID 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111]"
        />
      </div>

      {/* Column header */}
      <div className="flex items-center gap-4 px-4 py-3 text-[11px] text-[#999] font-bold tracking-[0.08em] uppercase border-b border-[#111]">
        <span className="flex-1">상품</span>
        <span className="w-64 shrink-0">이메일</span>
        <span className="w-24 shrink-0 text-right">금액</span>
        <span className="w-20 shrink-0 text-center">유형</span>
        <span className="w-24 shrink-0 text-center">상태</span>
        <span className="w-32 shrink-0 text-right">일시</span>
        <span className="w-[110px] shrink-0 text-right">작업</span>
      </div>

      <div>
        {paginated.length === 0 ? (
          <p className="text-[13px] text-[#999] py-6 text-center">결과 없음</p>
        ) : (
          paginated.map((order) => {
            const t = orderType(order);
            return (
              <div
                key={order.id}
                className="flex items-center gap-4 px-4 py-3 text-[13px] border-b border-[#eee] hover:bg-[#fafafa]"
              >
                <span className="flex-1 font-bold truncate">
                  {order.products?.name ?? "—"}
                </span>
                <span className="w-64 shrink-0 text-[#666] truncate">
                  {order.user_email}
                </span>
                <span className="w-24 shrink-0 text-right font-bold">
                  ₩{order.amount.toLocaleString("ko-KR")}
                </span>
                <span className="w-20 shrink-0 flex justify-center">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 border ${
                      t === "single"
                        ? "text-[#111] border-[#ddd]"
                        : t === "subscription"
                          ? "text-[#111] border-[#888] bg-[#f5f5f5]"
                          : "text-[#666] border-[#ddd] bg-[#fafafa]"
                    }`}
                  >
                    {typeLabel(t)}
                  </span>
                </span>
                <span className="w-24 shrink-0 flex justify-center">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 border ${statusColor(order.status)}`}
                  >
                    {statusLabel(order.status)}
                  </span>
                </span>
                <span className="w-32 shrink-0 text-right text-[11px] text-[#999]">
                  {shortDateTime(order.created_at)}
                </span>
                <div className="w-[110px] shrink-0 flex gap-1 justify-end">
                  {order.status === "paid" && t === "single" && (
                    <button
                      onClick={() =>
                        refundOrder(
                          order.id,
                          order.amount,
                          order.products?.name ?? "—"
                        )
                      }
                      className="text-[11px] text-red-600 bg-white border border-red-300 px-2.5 py-1 cursor-pointer hover:bg-red-50"
                    >
                      환불
                    </button>
                  )}
                </div>
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
