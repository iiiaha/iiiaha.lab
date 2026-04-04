"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

interface Post {
  id: string;
  category: string;
  title: string;
  status: string;
  created_at: string;
  products: { display_name: string } | null;
  comment_count: number;
}

const statusStyle = (s: string) => {
  if (s === "open") return "text-[#111] border-[#111]";
  if (s === "in_progress") return "text-yellow-600 border-yellow-400";
  if (s === "resolved") return "text-green-600 border-green-400";
  return "text-[#999] border-[#ddd]";
};

export default function CommunityPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<"all" | "idea" | "bug">("all");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      setLoggedIn(!!user);

      const { data } = await supabase
        .from("posts")
        .select("id, category, title, status, created_at, products(display_name)")
        .order("created_at", { ascending: false });

      if (data) {
        // 댓글 수 조회
        const withCounts = await Promise.all(
          data.map(async (p) => {
            const { count } = await supabase
              .from("comments")
              .select("id", { count: "exact", head: true })
              .eq("post_id", p.id);
            return { ...p, comment_count: count ?? 0 } as unknown as Post;
          })
        );
        setPosts(withCounts);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.category === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Community</h1>
        {loggedIn && (
          <Link
            href="/community/new"
            className="text-[12px] text-white bg-[#111] border border-[#111] px-4 py-2 no-underline hover:bg-[#333] transition-colors font-bold"
          >
            New Post
          </Link>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-6 text-[13px] tracking-[0.05em]">
        {([
          { key: "all", label: "All" },
          { key: "idea", label: "Ideas" },
          { key: "bug", label: "Questions / Bugs" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`pb-3 border-0 bg-transparent cursor-pointer text-[13px] tracking-[0.05em] hover:underline ${
              filter === key ? "font-bold" : "text-[#666]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="border-b border-[#111] mb-6" />

      {/* Posts */}
      {loading ? (
        <p className="text-[14px] text-[#999]">Loading...</p>
      ) : (
        <div className="border-t border-[#ddd]">
          {filtered.length === 0 ? (
            <p className="text-[14px] text-[#999] py-6">No posts yet.</p>
          ) : (
            filtered.map((post) => (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="flex items-center justify-between border-b border-[#ddd] py-3 no-underline hover:bg-[#fafafa] transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase border px-1.5 py-0.5 ${statusStyle(post.status)}`}
                    >
                      {post.status}
                    </span>
                    <span className="text-[10px] text-[#999] border border-[#ddd] px-1.5 py-0.5">
                      {post.category === "idea" ? "Idea" : "Q&A / Bug"}
                    </span>
                    {post.products && (
                      <span className="text-[10px] text-[#999]">
                        {post.products.display_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] font-bold">{post.title}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-[11px] text-[#999]">
                  {post.comment_count > 0 && (
                    <span>{post.comment_count} replies</span>
                  )}
                  <span>
                    {new Date(post.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
