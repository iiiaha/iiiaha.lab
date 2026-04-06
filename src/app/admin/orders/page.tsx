"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface Order {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_key: string | null;
  created_at: string;
  products: { display_name: string; slug: string };
  user_email?: string;
}

export default function AdminOrders() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, products(display_name, slug)")
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // 유저 이메일 조회
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

  useEffect(() => { load(); }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const updateStatus = async (id: string, status: string) => {
    const label = status === "paid" ? "결제 확인" : "환불 처리";
    if (!confirm(`${label}하시겠습니까?`)) return;
    await supabase.from("orders").update({ status }).eq("id", id);
    showMessage(`${label} 완료`);
    load();
  };

  const statusLabel = (s: string) => {
    if (s === "paid") return "결제완료";
    if (s === "refunded") return "환불됨";
    return "대기중";
  };

  const statusColor = (s: string) => {
    if (s === "paid") return "text-green-600";
    if (s === "refunded") return "text-red-600";
    return "text-[#999]";
  };

  const filtered = orders
    .filter((o) => filter === "all" || o.status === filter)
    .filter((o) =>
      !search ||
      o.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      o.products?.display_name.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase())
    );

  if (loading) return <p className="text-[14px] text-[#999]">로딩 중...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold">주문 관리</h1>
          {message && <span className="text-[11px] text-green-600">{message}</span>}
        </div>
        <span className="text-[12px] text-[#999]">총 {orders.length}건</span>
      </div>

      <input
        type="text"
        placeholder="계정, 제품명, 주문ID 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111] mb-4"
      />

      <div className="flex gap-4 mb-6 text-[12px]">
        {[
          { key: "all", label: "전체" },
          { key: "pending", label: "대기중" },
          { key: "paid", label: "결제완료" },
          { key: "refunded", label: "환불됨" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`bg-transparent border-0 cursor-pointer text-[12px] ${
              filter === f.key ? "font-bold text-[#111]" : "text-[#999]"
            }`}
          >
            {f.label} ({f.key === "all" ? orders.length : orders.filter((o) => o.status === f.key).length})
          </button>
        ))}
      </div>

      <div className="border-t border-[#ddd]">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">주문 없음</p>
        ) : (
          filtered.map((order) => (
            <div key={order.id} className="flex items-center justify-between border-b border-[#ddd] py-2.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[12px] font-bold">{order.products?.display_name}</span>
                  <span className={`text-[10px] font-bold ${statusColor(order.status)}`}>
                    {statusLabel(order.status)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#999]">
                  <span>{order.user_email}</span>
                  <span>₩{order.amount.toLocaleString()}</span>
                  <span>{new Date(order.created_at).toLocaleDateString("ko-KR")}</span>
                  <span className="text-[10px]">{order.id.slice(0, 8)}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {order.status === "pending" && (
                  <button onClick={() => updateStatus(order.id, "paid")}
                    className="text-[10px] text-green-600 bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer hover:bg-green-50">
                    결제확인
                  </button>
                )}
                {order.status === "paid" && (
                  <button onClick={() => updateStatus(order.id, "refunded")}
                    className="text-[10px] text-red-600 bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer hover:bg-red-50">
                    환불
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
