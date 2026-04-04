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
  products: {
    display_name: string;
    slug: string;
  };
  user_email?: string;
}

export default function AdminOrders() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, products(display_name, slug)")
      .order("created_at", { ascending: false });
    setOrders((data as unknown as Order[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const updateStatus = async (id: string, status: string) => {
    if (!confirm(`Change status to "${status}"?`)) return;
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) {
      showMessage(`Error: ${error.message}`);
      return;
    }
    showMessage("Updated");
    load();
  };

  const filtered =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const statusColor = (s: string) => {
    if (s === "paid") return "text-green-600";
    if (s === "refunded") return "text-red-600";
    return "text-[#999]";
  };

  return (
    <div>
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">Orders</h1>
      <div className="border-t border-[#111] mb-6" />

      {message && (
        <p className="text-[12px] text-green-600 mb-4">{message}</p>
      )}

      {/* Filter */}
      <div className="flex gap-4 mb-6 text-[12px]">
        {["all", "pending", "paid", "refunded"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`bg-transparent border-0 cursor-pointer text-[12px] uppercase tracking-[0.05em] ${
              filter === f ? "font-bold text-[#111]" : "text-[#999]"
            }`}
          >
            {f} ({f === "all" ? orders.length : orders.filter((o) => o.status === f).length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border-t border-[#ddd]">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">No orders.</p>
        ) : (
          filtered.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between border-b border-[#ddd] py-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-bold">
                    {order.products?.display_name}
                  </span>
                  <span
                    className={`text-[11px] font-bold uppercase ${statusColor(order.status)}`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="text-[11px] text-[#999]">
                  {order.id.slice(0, 8)}...
                  <span className="ml-2">
                    {new Date(order.created_at).toLocaleDateString("ko-KR")}
                  </span>
                  <span className="ml-2">
                    ₩{order.amount.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {order.status === "pending" && (
                  <button
                    onClick={() => updateStatus(order.id, "paid")}
                    className="text-[11px] text-green-600 bg-transparent border border-[#ddd] px-3 py-1 cursor-pointer hover:bg-green-50"
                  >
                    Mark Paid
                  </button>
                )}
                {order.status === "paid" && (
                  <button
                    onClick={() => updateStatus(order.id, "refunded")}
                    className="text-[11px] text-red-600 bg-transparent border border-[#ddd] px-3 py-1 cursor-pointer hover:bg-red-50"
                  >
                    Refund
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
