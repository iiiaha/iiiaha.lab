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
  products: { name: string } | null;
  comment_count: number;
}

const statusStyle = (s: string) => {
  if (s === "open") return "text-[#111] border-[#111]";
  if (s === "in_progress") return "text-yellow-600 border-yellow-400";
  if (s === "resolved") return "text-green-600 border-green-400";
  return "text-[#999] border-[#ddd]";
};

const PER_PAGE = 10;

export default function OpenLabPage() {
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
        .select("id, user_id, category, title, image_url, status, created_at, products(name)")
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

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.size} post(s)?`)) return;
    for (const id of selected) {
      await supabase.from("comments").delete().eq("post_id", id);
      await supabase.from("posts").delete().eq("id", id);
    }
    setPosts((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
  };

  const filteredRaw = filter === "all" ? posts : posts.filter((p) => p.category === filter);
  // notice를 항상 최상단에 고정
  const notices = posts.filter((p) => p.category === "notice");
  const nonNotice = filteredRaw.filter((p) => p.category !== "notice");
  const filtered = filter === "all" ? [...notices, ...nonNotice] : filteredRaw;
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">Open Lab</h1>
        <div className="flex items-center gap-3">
          {admin && selected.size > 0 && (
            <button onClick={deleteSelected}
              className="text-[12px] text-red-600 cursor-pointer hover:underline bg-transparent border-0">
              Delete ({selected.size})
            </button>
          )}
          {loggedIn && (
            <Link href={`/openlab/new${filter === "bug" ? "?category=bug" : "?category=idea"}`}
              className="text-[12px] text-[#999] no-underline hover:underline">
              + New Post
            </Link>
          )}
        </div>
      </div>
      <div className="border-b border-[#111] mb-6 sticky-divider" />

      {/* Intro */}
      <div className="text-[13px] text-[#666] leading-[1.85] mb-8">
        <p className="text-[#111] font-bold mb-3">
          안녕하세요. iiiaha.lab의 이상훈입니다.
        </p>
        <p>
          Open Lab은 사용자 여러분의 의견과 제보를 바탕으로 iiiaha.lab의 익스텐션을
          함께 발전시켜 나가기 위한 공개 게시판입니다. 두 개의 카테고리로 구분되어
          운영됩니다.
        </p>
        <div className="mt-5">
          <p className="text-[#111] font-bold mb-1">아이디어 (Ideas)</p>
          <p>
            실무에서 해결되었으면 하는 문제, 혹은 새로운 익스텐션에 대한 참신한
            아이디어를 자유롭게 남겨주시기 바랍니다. 검토 후 가치 있다고 판단되는
            아이디어는 실제 익스텐션 개발에 반영되며, 멤버십 구독자에게는 신규
            출시 익스텐션 이용권이 자동으로 제공됩니다.
          </p>
        </div>
        <div className="mt-4">
          <p className="text-[#111] font-bold mb-1">버그 (Bug Reports)</p>
          <p>
            익스텐션 사용 중 발생하는 버그를 제보해 주시면 최대한 신속하게
            수정하여 배포하겠습니다. 2026년 7월까지는 서비스 안정화를 위한
            집중 디버깅 기간으로, 모든 익스텐션을 20% 할인된 가격으로 제공하고
            있습니다.
          </p>
        </div>
      </div>

      <div className="border-t border-[#ddd] mb-6" />

      {/* Filter tabs */}
      <div className="flex items-center min-h-[32px] gap-6 text-[13px] tracking-[0.05em] mb-6">
        {([
          { key: "all", label: "All" },
          { key: "idea", label: "Ideas" },
          { key: "bug", label: "Questions / Bugs" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setPage(0); }}
            className={`border-0 bg-transparent cursor-pointer text-[13px] tracking-[0.05em] hover:underline ${
              filter === key ? "font-bold" : "text-[#666]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <p className="text-[14px] text-[#999]">Loading...</p>
      ) : (
        <div className="border-t border-[#ddd]">
          {admin && paged.length > 0 && (
            <div className="flex items-center border-b border-[#ddd] py-2">
              <input
                type="checkbox"
                checked={paged.length > 0 && paged.every((p) => selected.has(p.id))}
                onChange={() => {
                  const allSelected = paged.every((p) => selected.has(p.id));
                  setSelected((prev) => {
                    const next = new Set(prev);
                    paged.forEach((p) => {
                      if (allSelected) next.delete(p.id);
                      else next.add(p.id);
                    });
                    return next;
                  });
                }}
                className="mr-3 cursor-pointer"
              />
              <span className="text-[11px] text-[#999]">Select all</span>
            </div>
          )}
          {paged.length === 0 ? (
            <p className="text-[14px] text-[#999] py-6">No posts yet.</p>
          ) : (
            paged.map((post) => (
                <div key={post.id} className={`flex items-center border-b border-[#ddd] py-3 ${post.category === "notice" ? "bg-[#f5f5f5]" : ""}`}>
                  {admin && (
                    <input
                      type="checkbox"
                      checked={selected.has(post.id)}
                      onChange={() => toggleSelect(post.id)}
                      className="mr-3 shrink-0 cursor-pointer"
                    />
                  )}
                  <Link
                    href={`/openlab/${post.id}`}
                    className="flex items-center gap-2 flex-1 min-w-0 no-underline group/link"
                  >
                    <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 shrink-0 w-[46px] text-center ${
                      post.category === "notice"
                        ? "bg-[#00c9a7]"
                        : post.category === "idea"
                        ? "bg-[#0096D7]"
                        : "bg-[#DC0A7D]"
                    }`}>
                      {post.category === "notice" ? "Notice" : post.category === "idea" ? "Idea" : "Q&A"}
                    </span>
                    <span className="text-[14px] font-bold truncate ml-1 group-hover/link:underline">
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
                  {post.category !== "notice" && (
                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-[#999] ml-4">
                      {post.products && (
                        <span className="text-[11px] text-[#bbb]">
                          {post.products.name}
                        </span>
                      )}
                      <span className="w-[45px] text-right">
                        {new Date(post.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span
                        className={`text-[10px] font-bold border px-1.5 py-0.5 w-[80px] text-center ${statusStyle(post.status)}`}
                      >
                        {post.status === "in_progress" ? "Working" : post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                      </span>
                    </div>
                  )}
                </div>
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
