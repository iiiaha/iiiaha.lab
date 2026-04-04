"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

interface SystemItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  created_at: string;
}

export default function SystemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  const [item, setItem] = useState<SystemItem | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("systems").select("*").eq("id", id).single();
      if (!data) { router.push("/systems"); return; }
      setItem(data);
      setAdmin(await isAdmin());
      setLoading(false);
    };
    load();
  }, [id, router, supabase]);

  if (loading || !item) {
    return <div className="pt-20 text-center text-[14px] text-[#999]">Loading...</div>;
  }

  const info = [
    { label: "Title", value: item.title },
    { label: "Date", value: new Date(item.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
    { label: "Link", value: item.link_url ? (
      <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="text-[#111] underline flex items-center gap-1">
        {item.link_url.replace(/^https?:\/\//, "").split("/")[0]}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M4 2L10 2L10 8" /><path d="M10 2L2 10" /></svg>
      </a>
    ) : null },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Link href="/systems" className="flex items-center gap-1.5 text-[16px] font-bold tracking-[0.03em] no-underline hover:no-underline">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#111" strokeWidth="1.5"/></svg>
          Systems
        </Link>
        {admin && (
          <button onClick={async () => {
            if (!confirm("Delete this item?")) return;
            await supabase.from("systems").delete().eq("id", id);
            router.push("/systems");
          }} className="text-[11px] text-red-600 border border-[#ddd] bg-white px-3 py-1 cursor-pointer hover:bg-red-50">
            Delete
          </button>
        )}
      </div>

      {/* Image */}
      {item.image_url && (
        <div className="aspect-video bg-[#f5f5f5] border border-[#ddd] mb-5 flex items-center justify-center overflow-hidden">
          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="border-b border-[#111] mb-4" />

      <h1 className="text-[15px] font-bold tracking-[0.03em] mb-3">{item.title}</h1>

      {/* Info table */}
      <div className="border-t border-[#ddd]">
        {info.map(({ label, value }) =>
          value && (
            <div key={label} className="flex border-b border-[#ddd] py-2">
              <span className="w-[140px] shrink-0 text-[13px] text-[#666]">{label}</span>
              <span className="text-[13px]">{value}</span>
            </div>
          )
        )}
      </div>

      {/* Description */}
      {item.description && (
        <div className="border-b border-[#ddd] py-2.5">
          <div className="flex mb-2">
            <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Description</span>
          </div>
          <p className="text-[13px] text-[#666] leading-relaxed whitespace-pre-wrap">{item.description}</p>
        </div>
      )}
    </div>
  );
}
