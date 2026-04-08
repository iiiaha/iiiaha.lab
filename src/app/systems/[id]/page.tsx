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
  research_date: string | null;
  images: string[] | null;
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
    { label: "Date", value: item.research_date || null },
    { label: "Status", value: item.status ? (
      <span className={`text-[10px] font-bold px-2 py-[3px] ${STATUS_STYLE[item.status] || "text-[#666]"}`}>
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

      {/* Images */}
      <ImageSlider images={item.images && item.images.length > 0 ? item.images : item.image_url ? [item.image_url] : []} />

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

function getYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([\w-]+)/);
  return match ? match[1] : null;
}

function isYoutubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function ImageSlider({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) return null;

  const currentUrl = images[current];
  const isYt = isYoutubeUrl(currentUrl);
  const ytId = isYt ? getYoutubeId(currentUrl) : null;

  return (
    <div className="relative aspect-video bg-[#f5f5f5] border border-[#ddd] mb-5 overflow-hidden">
      {isYt && ytId ? (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <img src={currentUrl} alt="" className="w-full h-full object-cover" />
      )}
      {images.length > 1 && (
        <>
          <button
            onClick={() => setCurrent((prev) => (prev - 1 + images.length) % images.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white/80 border-0 cursor-pointer hover:bg-white transition-colors"
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><path d="M8 1L2 7L8 13" stroke="#111" strokeWidth="1.5"/></svg>
          </button>
          <button
            onClick={() => setCurrent((prev) => (prev + 1) % images.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white/80 border-0 cursor-pointer hover:bg-white transition-colors"
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><path d="M2 1L8 7L2 13" stroke="#111" strokeWidth="1.5"/></svg>
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full border-0 cursor-pointer ${i === current ? "bg-[#111]" : "bg-[#111]/30"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
