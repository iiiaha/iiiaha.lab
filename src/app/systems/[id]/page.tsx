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
  status: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  "Researching": "text-white bg-[#0096D7]",
  "Completed": "text-white bg-[#111]",
  "Released": "text-white bg-[#00c9a7]",
};

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
    { label: "Date", value: new Date(item.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }) },
    { label: "Status", value: item.status ? (
      <span className={`text-[10px] font-bold px-2 py-0.5 ${STATUS_STYLE[item.status] || "text-[#666]"}`}>
        {item.status}
      </span>
    ) : null },
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
      <div className="flex items-baseline justify-between mb-[10px]">
        <Link href="/systems" className="flex items-center gap-1.5 text-[16px] font-bold tracking-[0.03em] no-underline hover:underline">
          R&D
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#111" strokeWidth="1.5"/></svg>
        </Link>
        {admin && (
          <div className="flex items-center gap-3">
            <Link href={`/systems/new?edit=${id}`} className="text-[12px] text-[#999] no-underline hover:underline">Edit</Link>
            <button onClick={async () => {
              if (!confirm("Delete this item?")) return;
              await supabase.from("systems").delete().eq("id", id);
              router.push("/systems");
            }} className="text-[12px] text-[#999] bg-transparent border-0 cursor-pointer hover:underline hover:text-red-600">
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="border-b border-[#111] mb-[72px] sticky-divider" />

      {/* Image */}
      <div className="aspect-video bg-[#f5f5f5] border border-[#ddd] mb-5 flex items-center justify-center overflow-hidden">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[#999] text-[13px]">{item.title}</span>
        )}
      </div>

      <h1 className="text-[15px] font-bold tracking-[0.03em] mb-3">{item.title}</h1>

      {/* Info table */}
      <div className="border-t border-[#ddd]">
        {info.map(({ label, value }) =>
          value && (
            <div key={label} className="flex border-b border-[#ddd] py-1">
              <span className="w-[140px] shrink-0 text-[13px] text-[#666]">{label}</span>
              <span className="text-[13px]">{value}</span>
            </div>
          )
        )}
      </div>

      {/* Description */}
      {item.description && (
        <div className="pt-1.5 pb-4">
          <div className="flex mb-2">
            <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Description</span>
          </div>
          <p className="text-[13px] text-[#666] leading-relaxed whitespace-pre-wrap">{item.description}</p>
        </div>
      )}
    </div>
  );
}
