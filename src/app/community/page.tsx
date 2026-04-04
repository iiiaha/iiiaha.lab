"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

interface Post {
  id: string;
  user_id: string;
  category: string;
  title: string;
  image_url: string | null;
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
  const [admin, setAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      setLoggedIn(!!user);
      if (user) {
        setCurrentUserId(user.id);
        const { isAdmin: checkAdmin } = await import("@/lib/admin");
        setAdmin(await checkAdmin());
      }

      const { data } = await supabase
        .from("posts")
        .select("id, user_id, category, title, image_url, status, created_at, products(display_name)")
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
            paged.map((post) => {
              const canEdit = currentUserId === post.user_id || admin;
              const canDelete = admin || currentUserId === post.user_id;

              return (
                <div key={post.id} className="flex items-center justify-between border-b border-[#ddd] py-3 group">
                  <Link
                    href={`/community/${post.id}`}
                    className="flex items-center gap-2 flex-1 min-w-0 no-underline"
                  >
                    <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 shrink-0 ${
                      post.category === "idea"
                        ? "bg-[#0096D7]"
                        : "bg-[#DC0A7D]"
                    }`}>
                      {post.category === "idea" ? "Idea" : "Q&A"}
                    </span>
                    <span className="text-[14px] font-bold truncate ml-1">
                      {post.title}
                    </span>
                    {post.comment_count > 0 && (
                      <span className="text-[12px] text-[#999] font-normal shrink-0">
                        ({post.comment_count})
                      </span>
                    )}
                    {post.image_url && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" className="shrink-0">
                        <rect x="3" y="3" width="18" height="18" rx="1" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    )}
                  </Link>
                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-[#999] ml-4">
                    {/* Edit/Delete — visible on hover */}
                    {canEdit && (
                      <Link
                        href={`/community/${post.id}`}
                        className="text-[10px] text-[#ccc] no-underline hover:text-[#111] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        edit
                      </Link>
                    )}
                    {canDelete && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          if (!confirm("Delete this post?")) return;
                          await supabase.from("comments").delete().eq("post_id", post.id);
                          await supabase.from("posts").delete().eq("id", post.id);
                          setPosts((prev) => prev.filter((p) => p.id !== post.id));
                        }}
                        className="text-[10px] text-[#ccc] bg-transparent border-0 cursor-pointer hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        delete
                      </button>
                    )}
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
                </div>
              );
            })
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
