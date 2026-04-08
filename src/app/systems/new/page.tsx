"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase";

export default function NewSystemPage() {
  return (
    <Suspense fallback={<div className="pt-20 text-center text-[14px] text-[#999]">Loading...</div>}>
      <SystemForm />
    </Suspense>
  );
}

function SystemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const editId = searchParams.get("edit");
  const isEdit = !!editId;

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [status, setStatus] = useState("");
  const [researchDate, setResearchDate] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const check = async () => {
      const user = await getUser();
      if (!user) { router.push("/login"); return; }
      const a = await isAdmin();
      if (!a) { router.push("/systems"); return; }

      if (isEdit) {
        const { data } = await supabase.from("systems").select("*").eq("id", editId).single();
        if (data) {
          setTitle(data.title);
          setSubtitle(data.subtitle || "");
          setStatus(data.status || "");
          setResearchDate(data.research_date || "");
          setDescription(data.description || "");
          setLinkUrl(data.link_url || "");
          if (data.image_url) {
            setExistingImageUrl(data.image_url);
            setImagePreview(data.image_url);
          }
        }
      }

      setAuthorized(true);
    };
    check();
  }, [router, editId, isEdit, supabase]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setLoading(true);
    setError("");

    let imageUrl: string | null = existingImageUrl;
    if (removeImage) imageUrl = null;

    if (imageFile) {
      const user = await getUser();
      const ext = imageFile.name.split(".").pop();
      const path = `systems/${user?.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("uploads")
        .upload(path, imageFile, { upsert: true });
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
        imageUrl = publicUrl;
      }
    }

    if (isEdit) {
      const { error: updateErr } = await supabase.from("systems").update({
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        status: status || null,
        research_date: researchDate.trim() || null,
        description: description.trim() || null,
        link_url: linkUrl.trim() || null,
        image_url: imageUrl,
      }).eq("id", editId);
      if (updateErr) { setError(updateErr.message); setLoading(false); return; }
      router.push(`/systems/${editId}`);
    } else {
      const { error: insertErr } = await supabase.from("systems").insert({
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        status: status || null,
        research_date: researchDate.trim() || null,
        description: description.trim() || null,
        link_url: linkUrl.trim() || null,
        image_url: imageUrl,
      });
      if (insertErr) { setError(insertErr.message); setLoading(false); return; }
      router.push("/systems");
    }
  };

  if (!authorized) {
    return <div className="pt-20 text-center text-[14px] text-[#999]">Loading...</div>;
  }

  return (
    <div className="pt-10">
      <Link href="/systems" className="flex items-center gap-1.5 text-[12px] text-[#999] no-underline hover:underline mb-6">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#999" strokeWidth="1.2"/></svg>
        R&D
      </Link>

      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">{isEdit ? "Edit System" : "Add System"}</h1>
      <div className="border-t border-[#111] mb-8" />

      {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Project name"
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors" />
        </div>

        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Subtitle</label>
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Short description"
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors" />
        </div>

        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors bg-white">
            <option value="">None</option>
            <option value="Researching">Researching</option>
            <option value="Completed">Completed</option>
            <option value="Released">Released</option>
          </select>
        </div>

        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Research Date</label>
          <input type="text" value={researchDate} onChange={(e) => setResearchDate(e.target.value)} placeholder="e.g. 2026. 01 ~ 2026. 03"
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors" />
        </div>

        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">URL</label>
          <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..."
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors" />
        </div>

        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={30} placeholder="Brief description..."
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors resize-y font-[inherit]" />
        </div>

        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Image</label>
          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#111]"); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#111]"); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-[#111]");
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith("image/")) {
                setImageFile(file);
                setRemoveImage(false);
                const reader = new FileReader();
                reader.onload = () => setImagePreview(reader.result as string);
                reader.readAsDataURL(file);
              }
            }}
            onClick={() => document.getElementById("sys-file")?.click()}
            className="border border-dashed border-[#ddd] py-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#999] transition-colors"
          >
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="max-w-[300px] max-h-[200px] object-contain" />
                <button type="button" onClick={(e) => { e.stopPropagation(); clearImage(); }}
                  className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-[#111] text-white text-[11px] border-0 cursor-pointer">×</button>
              </div>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="1" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                </svg>
                <p className="text-[13px] text-[#999] mt-2">Drop an image here or click to upload</p>
              </>
            )}
          </div>
          <input id="sys-file" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        </div>

        <div className="flex gap-3 mt-2 justify-end">
          <Link href={isEdit ? `/systems/${editId}` : "/systems"} className="text-[#111] text-[13px] font-bold px-6 py-3 border border-[#ddd] no-underline hover:bg-[#f5f5f5] transition-colors flex items-center">Cancel</Link>
          <button type="submit" disabled={loading} className="bg-[#111] text-white text-[13px] font-bold px-6 py-3 border-0 cursor-pointer hover:bg-[#333] transition-colors disabled:opacity-40">
            {loading ? "Saving..." : isEdit ? "Save" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
