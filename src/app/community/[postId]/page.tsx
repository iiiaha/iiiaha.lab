"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

interface Post {
  id: string;
  user_id: string;
  category: string;
  title: string;
  description: string;
  image_url: string | null;
  status: string;
  created_at: string;
  products: { display_name: string } | null;
}

interface Comment {
  id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
}

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;
  const supabase = createClient();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [newComment, setNewComment] = useState("");
  const [userId, setUserId] = useState("");
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(false);

  const load = async () => {
    const { data: p } = await supabase
      .from("posts")
      .select("*, products(display_name)")
      .eq("id", postId)
      .single();

    if (!p) { router.push("/community"); return; }
    setPost(p as unknown as Post);

    // 작성자 이름
    const res = await fetch(`/api/user-email?id=${p.user_id}`);
    if (res.ok) {
      const d = await res.json();
      if (d.name) setAuthorName(d.name);
    }

    const { data: c } = await supabase
      .from("comments")
      .select("id, content, is_admin, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments(c ?? []);

    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const user = await getUser();
      if (user) {
        setUserId(user.id);
        setAdmin(await isAdmin());
      }
      load();
    };
    init();
  }, [postId]);

  const addComment = async () => {
    if (!newComment.trim() || !userId) return;
    setCommenting(true);
    await supabase.from("comments").insert({
      post_id: postId,
      user_id: userId,
      content: newComment.trim(),
      is_admin: admin,
    });
    setNewComment("");
    setCommenting(false);
    load();
  };

  const updateStatus = async (status: string) => {
    await supabase.from("posts").update({ status }).eq("id", postId);
    load();
  };

  if (loading || !post) {
    return <div className="pt-20 text-center text-[14px] text-[#999]">Loading...</div>;
  }

  const isAuthor = userId === post.user_id;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/community" className="flex items-center gap-1.5 text-[16px] font-bold tracking-[0.03em] no-underline hover:no-underline">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#111" strokeWidth="1.5"/></svg>
          Community
        </Link>
        {userId && (
          <Link href="/community/new"
            className="text-[12px] text-[#111] border border-[#111] px-4 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors font-bold">
            New Post
          </Link>
        )}
      </div>
      <div className="border-b border-[#111] mb-4" />

      {/* Title + actions */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <h1 className="text-[15px] font-bold tracking-[0.03em] truncate">{post.title}</h1>
        <div className="flex items-center gap-2 shrink-0">
          {admin && (
            <div className="flex gap-1">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} onClick={() => updateStatus(s)}
                  className={`text-[9px] px-1.5 py-0.5 border cursor-pointer ${
                    post.status === s
                      ? "bg-[#111] text-white border-[#111]"
                      : "bg-white text-[#ccc] border-[#ddd] hover:border-[#111] hover:text-[#111]"
                  }`}>
                  {s === "in_progress" ? "Working" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
          {(isAuthor || admin) && (
            <div className="flex gap-1">
              <Link href={`/community/new?edit=${post.id}`}
                className="text-[11px] text-[#111] border border-[#ddd] bg-white px-3 py-1 no-underline hover:bg-[#f5f5f5]">
                Edit
              </Link>
              <button onClick={async () => {
                if (!confirm("Delete this post?")) return;
                await supabase.from("comments").delete().eq("post_id", postId);
                await supabase.from("posts").delete().eq("id", postId);
                router.push("/community");
              }} className="text-[11px] text-red-600 border border-[#ddd] bg-white px-3 py-1 cursor-pointer hover:bg-red-50">
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info table */}
      <div className="border-t border-[#ddd]">
        <div className="flex border-b border-[#ddd] py-2">
          <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Category</span>
          <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 ${
            post.category === "notice" ? "bg-[#00C864]" : post.category === "idea" ? "bg-[#0096D7]" : "bg-[#DC0A7D]"
          }`}>
            {post.category === "notice" ? "Notice" : post.category === "idea" ? "Idea" : "Q&A"}
          </span>
        </div>
        {post.products && (
          <div className="flex border-b border-[#ddd] py-2">
            <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Extension</span>
            <span className="text-[13px]">{post.products.display_name}</span>
          </div>
        )}
        <div className="flex border-b border-[#ddd] py-2">
          <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Author</span>
          <span className="text-[13px]">{authorName || "—"}</span>
        </div>
        <div className="flex border-b border-[#ddd] py-2">
          <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Date</span>
          <span className="text-[13px]">{new Date(post.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
        </div>
        <div className="flex border-b border-[#ddd] py-2">
          <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Status</span>
          <span className={`text-[13px] ${post.status === "resolved" ? "text-green-600" : post.status === "closed" ? "text-[#ccc]" : ""}`}>{post.status.charAt(0).toUpperCase() + post.status.slice(1)}</span>
        </div>
      </div>

      {/* Description */}
      <div className="border-b border-[#ddd] py-2.5">
        <div className="flex mb-2">
          <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Description</span>
        </div>
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{post.description}</p>
        {post.image_url && (
          <div className="mt-3">
            <a href={post.image_url} target="_blank" rel="noopener noreferrer">
              <img src={post.image_url} alt="attachment" className="max-w-full max-h-[400px] object-contain border border-[#eee]" />
            </a>
          </div>
        )}
      </div>

      {/* Comments */}
      <h2 className="text-[12px] font-bold text-[#999] tracking-[0.05em] uppercase mb-4">
        Replies ({comments.length})
      </h2>

      <div className="border-t border-[#ddd]">
        {comments.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">No replies yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className={`border-b border-[#ddd] py-4 ${c.is_admin ? "bg-[#fafafa] px-4" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                {c.is_admin && (
                  <span className="text-[10px] font-bold text-white bg-[#111] px-1.5 py-0.5">iiiaha</span>
                )}
                <span className="text-[11px] text-[#999]">
                  {new Date(c.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{c.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Add comment */}
      {userId ? (
        <div className="mt-6">
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a reply..." rows={3}
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors resize-y font-[inherit] mb-3" />
          <div className="flex justify-end">
            <button onClick={addComment} disabled={commenting || !newComment.trim()}
              className="bg-[#111] text-white text-[13px] font-bold px-6 py-2.5 border-0 cursor-pointer hover:bg-[#333] transition-colors disabled:opacity-40">
              {commenting ? "Posting..." : "Reply"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-[13px] text-[#999]">
          <Link href="/login" className="text-[#111] underline">Log in</Link> to reply.
        </p>
      )}
    </div>
  );
}
