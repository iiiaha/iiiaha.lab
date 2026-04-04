"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string;
}

interface UserOrder {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  products: {
    display_name: string;
  };
}

export default function AdminUsers() {
  const supabase = createClient();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const toggleUser = async (userId: string) => {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    const { data } = await supabase
      .from("orders")
      .select("id, amount, status, created_at, products(display_name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setOrders((data as unknown as UserOrder[]) ?? []);
  };

  const filtered = search
    ? users.filter((u) =>
        u.email?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  if (loading) {
    return <p className="text-[14px] text-[#999]">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">
        Users
      </h1>
      <div className="border-t border-[#111] mb-6" />

      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111]"
        />
        <span className="text-[12px] text-[#999]">{users.length} users</span>
      </div>

      <div className="border-t border-[#ddd]">
        {filtered.map((user) => (
          <div key={user.id}>
            <div
              onClick={() => toggleUser(user.id)}
              className="flex items-center justify-between border-b border-[#ddd] py-3 cursor-pointer hover:bg-[#fafafa]"
            >
              <div>
                <span className="text-[13px] font-bold">{user.email}</span>
                <span className="text-[11px] text-[#999] ml-2 border border-[#ddd] px-1.5 py-0.5">
                  {user.provider}
                </span>
              </div>
              <div className="text-[11px] text-[#999] flex gap-4">
                <span>
                  Joined:{" "}
                  {new Date(user.created_at).toLocaleDateString("ko-KR")}
                </span>
                {user.last_sign_in_at && (
                  <span>
                    Last login:{" "}
                    {new Date(user.last_sign_in_at).toLocaleDateString(
                      "ko-KR"
                    )}
                  </span>
                )}
                <span className="text-[13px]">
                  {expanded === user.id ? "−" : "+"}
                </span>
              </div>
            </div>

            {/* Expanded: user's orders */}
            {expanded === user.id && (
              <div className="bg-[#fafafa] border-b border-[#ddd] px-6 py-3">
                {orders.length === 0 ? (
                  <p className="text-[12px] text-[#999]">No orders.</p>
                ) : (
                  orders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-[12px]">
                        {o.products?.display_name}
                      </span>
                      <div className="flex gap-3 text-[11px] text-[#999]">
                        <span>₩{o.amount.toLocaleString()}</span>
                        <span
                          className={
                            o.status === "paid"
                              ? "text-green-600"
                              : o.status === "refunded"
                              ? "text-red-600"
                              : ""
                          }
                        >
                          {o.status}
                        </span>
                        <span>
                          {new Date(o.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
