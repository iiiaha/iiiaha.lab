"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

interface Post {
  id: string;
  category: string;
  title: string;
  description: string;
  image_url: string | null;
  status: string;
  created_at: string;
  products: { display_name: string } | null;
  comment_count: number;
}

const statusDot = (s: string) => {
  if (s === "open") return "bg-[#111]";
  if (s === "in_progress") return "bg-yellow-500";
  if (s === "resolved") return "bg-green-500";
  return "bg-[#ccc]";
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
        .select("id, category, title, description, image_url, status, created_at, products(display_name)")
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

  return (
    <div>
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
      <div className="border-b border-[#111] mb-8" />

      {/* Posts */}
      {loading ? (
        <p className="text-[14px] text-[#999]">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-[14px] text-[#999] py-6">No posts yet.</p>
      ) : (
        <div className="flex flex-col gap-0">
          {filtered.map((post) => {
            const preview = post.description.length > 120
              ? post.description.slice(0, 120) + "..."
              : post.description;

            return (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="block no-underline border-b border-[#ddd] py-5 hover:bg-[#fafafa] transition-colors -mx-4 px-4"
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(post.status)}`} />
                      <h3 className="text-[14px] font-bold truncate">{post.title}</h3>
                    </div>
                    <p className="text-[13px] text-[#999] leading-relaxed mb-2">{preview}</p>

                    {/* Image thumbnail */}
                    {post.image_url && (
                      <div className="mb-2">
                        <img
                          src={post.image_url}
                          alt=""
                          className="h-16 object-cover border border-[#eee]"
                        />
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[11px] text-[#bbb]">
                      <span className="text-[#999]">
                        {post.category === "idea" ? "Idea" : "Q&A"}
                      </span>
                      {post.products && (
                        <>
                          <span>·</span>
                          <span>{post.products.display_name}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {new Date(post.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {post.comment_count > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[#666]">
                            {post.comment_count} {post.comment_count === 1 ? "reply" : "replies"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
