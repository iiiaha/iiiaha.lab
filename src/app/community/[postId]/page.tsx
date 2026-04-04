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

const statusStyle = (s: string) => {
  if (s === "open") return "text-[#111] border-[#111]";
  if (s === "in_progress") return "text-yellow-600 border-yellow-400";
  if (s === "resolved") return "text-green-600 border-green-400";
  return "text-[#999] border-[#ddd]";
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;
  const supabase = createClient();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
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

  return (
    <div className="pt-10">
      <Link href="/community" className="text-[12px] text-[#999] hover:underline mb-6 inline-block">
        Back to Community
      </Link>

      {/* Header */}
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-3">{post.title}</h1>
      <div className="flex items-center gap-3 text-[11px] text-[#999] mb-6">
        <span>{post.category === "idea" ? "Idea" : "Q&A / Bug"}</span>
        {post.products && (
          <>
            <span>·</span>
            <span>{post.products.display_name}</span>
          </>
        )}
        <span>·</span>
        <span>
          {new Date(post.created_at).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "numeric",
          })}
        </span>
        <span>·</span>
        <span className={statusStyle(post.status).split(" ")[0]}>
          {post.status}
        </span>
      </div>

      <div className="border-t border-[#111] mb-8" />

      {/* Body */}
      <div className="mb-8">
        <p className="text-[14px] leading-[1.8] whitespace-pre-wrap">{post.description}</p>
        {post.image_url && (
          <div className="mt-6">
            <a href={post.image_url} target="_blank" rel="noopener noreferrer">
              <img src={post.image_url} alt="attachment" className="max-w-full max-h-[500px] object-contain border border-[#eee]" />
            </a>
          </div>
        )}
      </div>

      {/* Admin: status change */}
      {admin && (
        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-[#ddd]">
          <span className="text-[11px] text-[#999]">Status:</span>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`text-[11px] px-2 py-0.5 border cursor-pointer ${
                post.status === s
                  ? "bg-[#111] text-white border-[#111]"
                  : "bg-white text-[#666] border-[#ddd] hover:border-[#111]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

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
                  <span className="text-[10px] font-bold text-white bg-[#111] px-1.5 py-0.5">
                    iiiaha
                  </span>
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
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a reply..."
            rows={3}
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors resize-y font-[inherit] mb-3"
          />
          <button
            onClick={addComment}
            disabled={commenting || !newComment.trim()}
            className="bg-[#111] text-white text-[13px] font-bold px-6 py-2.5 border-0 cursor-pointer hover:bg-[#333] transition-colors disabled:opacity-40"
          >
            {commenting ? "Posting..." : "Reply"}
          </button>
        </div>
      ) : (
        <p className="mt-6 text-[13px] text-[#999]">
          <Link href="/login" className="text-[#111] underline">Log in</Link> to reply.
        </p>
      )}
    </div>
  );
}
