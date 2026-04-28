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
  images: string[] | null;
  link_url: string | null;
  sort_order: number;
  status: string | null;
}

function getThumbnail(item: SystemItem): string | null {
  if (item.image_url) return item.image_url;
  const first = item.images?.[0];
  if (!first) return null;
  if (first.includes("youtube.com") || first.includes("youtu.be")) {
    const id = first.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([\w-]+)/)?.[1];
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  }
  return first;
}

export default function SystemsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<SystemItem[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("systems")
      .select("*")
      .order("sort_order", { ascending: false });
    setItems(data ?? []);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const init = async () => {
      await load();
      setAdmin(await isAdmin());
      setLoading(false);
    };
    init();
  }, []);

  const handleDrop = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setItems(reordered);
  };

  const applyOrder = async () => {
    const len = items.length;
    await Promise.all(
      items.map((item, i) =>
        supabase.from("systems").update({ sort_order: len - 1 - i }).eq("id", item.id)
      )
    );
    setReordering(false);
  };

  const cancelReorder = () => {
    setReordering(false);
    load();
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">R&D</h1>
        {admin && (
          <div className="flex items-center gap-3">
            {reordering ? (
              <>
                <button onClick={cancelReorder} className="text-[12px] text-[#999] bg-transparent border-0 cursor-pointer hover:underline">Cancel</button>
                <button onClick={applyOrder} className="text-[12px] text-white bg-[#111] border-0 px-3 py-1 cursor-pointer hover:bg-[#333]">Apply</button>
              </>
            ) : (
              <>
                <button onClick={() => setReordering(true)} className="text-[12px] text-[#999] bg-transparent border-0 cursor-pointer hover:underline">Reorder</button>
                <Link href="/systems/new" className="text-[12px] text-[#999] no-underline hover:underline">+ Add</Link>
              </>
            )}
          </div>
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
              draggable={reordering}
              onDragStart={() => reordering && setDragIdx(i)}
              onDragOver={(e) => { if (reordering) { e.preventDefault(); setDragOverIdx(i); } }}
              onDragLeave={() => reordering && setDragOverIdx(null)}
              onDrop={() => { if (reordering && dragIdx !== null) handleDrop(dragIdx, i); setDragIdx(null); setDragOverIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={`${dragIdx === i ? "opacity-40" : ""} ${dragOverIdx === i ? "ring-2 ring-[#111]" : ""}`}
            >
            <Link
              href={`/systems/${item.id}`}
              className="group no-underline"
            >
              <div className="aspect-square bg-[#f5f5f5] border border-[#ddd] mb-3 overflow-hidden flex items-center justify-center relative">
                {getThumbnail(item) ? (
                  <img
                    src={getThumbnail(item)!}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:opacity-85 transition-opacity duration-200"
                  />
                ) : (
                  <span className="text-[#999] text-[13px]">{item.title}</span>
                )}
                {item.status === "Released" && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-[3px] bg-[#00c9a7] text-white">
                    Released
                  </span>
                )}
              </div>
              <h3 className="text-[14px] font-bold group-hover:underline truncate">
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
