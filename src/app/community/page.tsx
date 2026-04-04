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

const PER_PAGE = 10;

export default function CommunityPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<"all" | "idea" | "bug">("all");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      setLoggedIn(!!user);

      const { data } = await supabase
        .from("posts")
        .select("id, category, title, status, created_at, products(display_name)")
        .order("created_at", { ascending: false });

      if (data) {
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
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const header = (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-[16px] font-bold tracking-[0.03em]">Community</h1>
      {loggedIn && (
        <Link
          href="/community/new"
          className="text-[12px] text-[#111] border border-[#111] px-4 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors font-bold"
        >
          New Post
        </Link>
      )}
    </div>
  );

  return (
    <div>
      {header}

      {/* Filter tabs */}
      <div className="flex gap-6 text-[13px] tracking-[0.05em]">
        {([
          { key: "all", label: "All" },
          { key: "idea", label: "Ideas" },
          { key: "bug", label: "Questions / Bugs" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setPage(0); }}
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
          {paged.length === 0 ? (
            <p className="text-[14px] text-[#999] py-6">No posts yet.</p>
          ) : (
            paged.map((post) => (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="flex items-center justify-between border-b border-[#ddd] py-3 no-underline hover:bg-[#fafafa] transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10px] text-[#999] border border-[#ddd] px-1.5 py-0.5 shrink-0">
                    {post.category === "idea" ? "Idea" : "Q&A"}
                  </span>
                  <span className="text-[14px] font-bold truncate">
                    {post.title}
                    {post.comment_count > 0 && (
                      <span className="text-[12px] text-[#999] font-normal ml-1">
                        ({post.comment_count})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-[11px] text-[#999] ml-4">
                  {post.products && (
                    <span className="text-[11px] text-[#bbb]">
                      {post.products.display_name}
                    </span>
                  )}
                  <span className="w-[45px] text-right">
                    {new Date(post.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase border px-1.5 py-0.5 w-[55px] text-center ${statusStyle(post.status)}`}
                  >
                    {post.status === "in_progress" ? "WIP" : post.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`w-8 h-8 flex items-center justify-center text-[12px] border cursor-pointer ${
                page === i
                  ? "bg-[#111] text-white border-[#111]"
                  : "bg-white text-[#666] border-[#ddd] hover:border-[#111]"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
