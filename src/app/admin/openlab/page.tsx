"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface Post {
  id: string;
  category: string;
  title: string;
  status: string;
  created_at: string;
  products: { name: string } | null;
}

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];

const STATUS_LABELS: Record<string, string> = {
  all: "전체",
  open: "접수 완료",
  in_progress: "해결 중",
  resolved: "해결 완료",
  closed: "답변 완료",
};

const statusStyle = (s: string) => {
  if (s === "open") return "text-red-600";
  if (s === "in_progress") return "text-yellow-600";
  if (s === "resolved") return "text-green-600";
  return "text-[#999]";
};

export default function AdminOpenLab() {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, category, title, status, created_at, products(name)")
      .order("created_at", { ascending: false });
    setPosts((data as unknown as Post[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("posts").update({ status }).eq("id", id);
    showMessage("Updated");
    load();
  };

  const filtered = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold tracking-[0.03em]">Open Lab</h1>
          {message && <span className="text-[11px] text-green-600">{message}</span>}
        </div>
        <span className="text-[12px] text-[#999]">
          접수 완료 {posts.filter((p) => p.status === "open").length}건
        </span>
      </div>
      <div className="border-t border-[#111] mb-6" />

      {/* Filter */}
      <div className="flex gap-4 mb-6">
        {["all", ...STATUS_OPTIONS].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[12px] bg-transparent border-0 cursor-pointer tracking-[0.05em] ${
              filter === f ? "font-bold text-[#111]" : "text-[#999]"
            }`}
          >
            {STATUS_LABELS[f] ?? f} ({f === "all" ? posts.length : posts.filter((p) => p.status === f).length})
          </button>
        ))}
      </div>

      <div className="border-t border-[#ddd]">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">No posts.</p>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-[#ddd] py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-bold ${statusStyle(p.status)}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                  <span className="text-[10px] text-[#999]">
                    {p.category === "idea" ? "Idea" : "Bug"}
                  </span>
                  {p.products && (
                    <span className="text-[10px] text-[#999]">{p.products.name}</span>
                  )}
                </div>
                <Link href={`/openlab/${p.id}`} className="text-[13px] font-bold hover:underline">
                  {p.title}
                </Link>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-[#999] mr-2">
                  {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(p.id, s)}
                    className={`text-[10px] px-1.5 py-0.5 border cursor-pointer whitespace-nowrap ${
                      p.status === s
                        ? "bg-[#111] text-white border-[#111]"
                        : "bg-white text-[#999] border-[#ddd] hover:border-[#111]"
                    }`}
                  >
                    {STATUS_LABELS[s] ?? s}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
