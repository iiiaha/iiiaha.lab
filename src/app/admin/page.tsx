"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface Stats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalUsers: number;
  totalLicenses: number;
  activeLicenses: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [products, orders, licenses] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id, amount, status"),
        supabase.from("licenses").select("id, status"),
      ]);

      const paidOrders =
        orders.data?.filter((o) => o.status === "paid") ?? [];
      const totalRevenue = paidOrders.reduce(
        (sum, o) => sum + (o.amount || 0),
        0
      );
      const activeLicenses =
        licenses.data?.filter((l) => l.status === "active").length ?? 0;

      setStats({
        totalProducts: products.count ?? 0,
        totalOrders: paidOrders.length,
        totalRevenue,
        totalUsers: 0, // auth.users는 클라이언트에서 접근 불가 → API로 처리
        totalLicenses: licenses.data?.length ?? 0,
        activeLicenses,
      });
    };
    load();
  }, []);

  if (!stats) {
    return <p className="text-[14px] text-[#999]">Loading...</p>;
  }

  const cards = [
    { label: "Products", value: stats.totalProducts },
    { label: "Paid Orders", value: stats.totalOrders },
    {
      label: "Revenue",
      value: `₩${stats.totalRevenue.toLocaleString("ko-KR")}`,
    },
    { label: "Licenses", value: `${stats.activeLicenses} / ${stats.totalLicenses}` },
  ];

  return (
    <div>
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">
        Dashboard
      </h1>
      <div className="border-t border-[#111] mb-8" />
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {cards.map(({ label, value }) => (
          <div
            key={label}
            className="border border-[#ddd] p-5"
          >
            <p className="text-[11px] text-[#999] font-bold uppercase tracking-[0.05em] mb-2">
              {label}
            </p>
            <p className="text-[20px] font-bold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
