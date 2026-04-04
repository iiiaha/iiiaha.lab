"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

interface SystemItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
}

export default function SystemsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<SystemItem[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("systems")
        .select("*")
        .order("sort_order", { ascending: true });
      setItems(data ?? []);

      const a = await isAdmin();
      setAdmin(a);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Systems</h1>
        {admin && (
          <Link
            href="/systems/new"
            className="text-[12px] text-[#111] border border-[#111] px-4 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors font-bold"
          >
            + Add
          </Link>
        )}
      </div>
      <div className="border-b border-[#111] mb-4" />

      {loading ? (
        <p className="text-[14px] text-[#999]">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-[14px] text-[#999]">Coming soon.</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-6 gap-y-8 max-md:grid-cols-2 max-sm:grid-cols-1">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/systems/${item.id}`}
              className="group no-underline"
            >
              <div className="aspect-square bg-[#f5f5f5] border border-[#ddd] mb-3 overflow-hidden flex items-center justify-center">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:opacity-85 transition-opacity duration-200"
                  />
                ) : (
                  <span className="text-[#999] text-[13px]">{item.title}</span>
                )}
              </div>
              <h3 className="text-[14px] font-bold group-hover:underline">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-[13px] text-[#666] mt-0.5 line-clamp-2">
                  {item.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
