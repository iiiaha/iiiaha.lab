"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

interface SystemItem {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  status: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "Researching": { bg: "bg-[#0096D7]", text: "text-white" },
  "Completed": { bg: "bg-[#111]", text: "text-white" },
  "Released": { bg: "bg-[#00c9a7]", text: "text-white" },
};

export default function SystemsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<SystemItem[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("systems")
      .select("*")
      .order("sort_order", { ascending: false });
    setItems(data ?? []);
  };

  useEffect(() => {
    const init = async () => {
      await load();
      setAdmin(await isAdmin());
      setLoading(false);
    };
    init();
  }, []);

  const handleDrop = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setItems(reordered);
    await Promise.all(
      reordered.map((item, i) =>
        supabase.from("systems").update({ sort_order: i }).eq("id", item.id)
      )
    );
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">R&D</h1>
        {admin && (
          <Link href="/systems/new" className="text-[12px] text-[#999] no-underline hover:underline">+ Add</Link>
        )}
      </div>
      <div className="border-b border-[#111] mb-4 sticky-divider" />
      <div className="min-h-[32px] mb-6" />

      {loading ? (
        <p className="text-[14px] text-[#999]">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-[14px] text-[#999]">Coming soon.</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 max-sm:gap-x-2 max-sm:gap-y-4">
          {items.map((item, i) => (
            <div
              key={item.id}
              draggable={admin}
              onDragStart={() => admin && setDragIdx(i)}
              onDragOver={(e) => { if (admin) { e.preventDefault(); setDragOverIdx(i); } }}
              onDragLeave={() => admin && setDragOverIdx(null)}
              onDrop={() => { if (admin && dragIdx !== null) handleDrop(dragIdx, i); setDragIdx(null); setDragOverIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={`${dragIdx === i ? "opacity-40" : ""} ${dragOverIdx === i ? "ring-2 ring-[#111]" : ""}`}
            >
            <Link
              href={`/systems/${item.id}`}
              className="group no-underline"
            >
              <div className="aspect-square bg-[#f5f5f5] border border-[#ddd] mb-3 overflow-hidden flex items-center justify-center relative">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:opacity-85 transition-opacity duration-200"
                  />
                ) : (
                  <span className="text-[#999] text-[13px]">{item.title}</span>
                )}
                {item.status && STATUS_STYLE[item.status] && (
                  <span className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-1 ${STATUS_STYLE[item.status].bg} ${STATUS_STYLE[item.status].text}`}>
                    {item.status}
                  </span>
                )}
              </div>
              <h3 className="text-[14px] font-bold group-hover:underline">
                {item.title}
              </h3>
              {item.subtitle && (
                <p className="text-[12px] text-[#999] mt-0.5">{item.subtitle}</p>
              )}
            </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
