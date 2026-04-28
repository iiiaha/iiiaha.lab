"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface Episode {
  id: string;
  title: string;
  description: string | null;
  video_uid: string | null;
  duration: number | null;
  sort_order: number;
  is_preview: boolean;
}

export default function ManageEpisodes() {
  const params = useParams();
  const productId = params.productId as string;
  const supabase = createClient();

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [courseName, setCourseName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    video_uid: "",
    duration: 0,
    sort_order: 0,
    is_preview: false,
  });
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", productId)
      .single();
    setCourseName(product?.name ?? "");

    const { data } = await supabase
      .from("course_episodes")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    setEpisodes(data ?? []);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [productId]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      video_uid: "",
      duration: 0,
      sort_order: episodes.length,
      is_preview: false,
    });
  };

  const saveEpisode = async () => {
    if (editing) {
      const { error } = await supabase
        .from("course_episodes")
        .update(form)
        .eq("id", editing);
      if (error) { showMessage(`Error: ${error.message}`); return; }
      showMessage("Saved");
      setEditing(null);
    } else {
      const { error } = await supabase
        .from("course_episodes")
        .insert({ ...form, product_id: productId });
      if (error) { showMessage(`Error: ${error.message}`); return; }
      showMessage("Episode added");
      setAdding(false);
    }
    resetForm();
    load();
  };

  const deleteEpisode = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    const { error } = await supabase
      .from("course_episodes")
      .delete()
      .eq("id", id);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    showMessage("Deleted");
    load();
  };

  const startEdit = (ep: Episode) => {
    setEditing(ep.id);
    setAdding(false);
    setForm({
      title: ep.title,
      description: ep.description ?? "",
      video_uid: ep.video_uid ?? "",
      duration: ep.duration ?? 0,
      sort_order: ep.sort_order,
      is_preview: ep.is_preview,
    });
  };

  const EpisodeForm = () => (
    <div className="border border-[#111] p-4 mb-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="w-[90px] shrink-0 text-[11px] text-[#999] font-bold uppercase">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-[90px] shrink-0 text-[11px] text-[#999] font-bold uppercase">Description</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-[90px] shrink-0 text-[11px] text-[#999] font-bold uppercase">Video UID</label>
          <input value={form.video_uid} onChange={(e) => setForm({ ...form, video_uid: e.target.value })} placeholder="Cloudflare Stream video UID" className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-[90px] shrink-0 text-[11px] text-[#999] font-bold uppercase">Duration (s)</label>
          <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 0 })} className="w-20 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-[90px] shrink-0 text-[11px] text-[#999] font-bold uppercase">Order</label>
          <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} className="w-20 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-[90px] shrink-0 text-[11px] text-[#999] font-bold uppercase">Preview</label>
          <input type="checkbox" checked={form.is_preview} onChange={(e) => setForm({ ...form, is_preview: e.target.checked })} />
          <span className="text-[11px] text-[#999]">Free preview episode</span>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={saveEpisode} className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333]">
          {editing ? "Save" : "Add"}
        </button>
        <button onClick={() => { setAdding(false); setEditing(null); resetForm(); }} className="bg-white text-[#111] text-[12px] font-bold px-4 py-2 border border-[#ddd] cursor-pointer hover:bg-[#f5f5f5]">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Link href="/admin/courses" className="text-[12px] text-[#999] no-underline hover:underline">
          Courses
        </Link>
        <span className="text-[12px] text-[#999]">/</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[16px] font-bold tracking-[0.03em]">{courseName}</h1>
        <button
          onClick={() => { setAdding(true); setEditing(null); resetForm(); }}
          className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333]"
        >
          + Add Episode
        </button>
      </div>
      <div className="border-t border-[#111] mb-6" />

      {message && <p className="text-[12px] text-green-600 mb-4">{message}</p>}

      {adding && <EpisodeForm />}

      <div className="border-t border-[#ddd]">
        {episodes.map((ep, i) => (
          <div key={ep.id}>
            {editing === ep.id ? (
              <EpisodeForm />
            ) : (
              <div className="flex items-center justify-between border-b border-[#ddd] py-3">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[#999] w-6">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <div>
                    <span className="text-[13px] font-bold">{ep.title}</span>
                    {ep.is_preview && (
                      <span className="text-[10px] text-[#999] border border-[#ddd] px-1.5 py-0.5 ml-2">Preview</span>
                    )}
                    {ep.video_uid && (
                      <span className="text-[10px] text-green-600 ml-2">Video linked</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(ep)} className="text-[11px] text-[#111] bg-transparent border border-[#ddd] px-3 py-1 cursor-pointer hover:bg-[#f5f5f5]">Edit</button>
                  <button onClick={() => deleteEpisode(ep.id, ep.title)} className="text-[11px] text-red-600 bg-transparent border border-[#ddd] px-3 py-1 cursor-pointer hover:bg-red-50">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
