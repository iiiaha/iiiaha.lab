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
  const [images, setImages] = useState<{ file?: File; url: string }[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [imgDragIdx, setImgDragIdx] = useState<number | null>(null);
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
          const existingImages: string[] = data.images || (data.image_url ? [data.image_url] : []);
          setImages(existingImages.map((url: string) => ({ url })));
        }
      }

      setAuthorized(true);
    };
    check();
  }, [router, editId, isEdit, supabase]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setNewFiles((prev) => [...prev, ...files]);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => setImages((prev) => [...prev, { file, url: reader.result as string }]);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    const removed = images[idx];
    setImages((prev) => prev.filter((_, i) => i !== idx));
    if (removed.file) {
      setNewFiles((prev) => prev.filter((f) => f !== removed.file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setLoading(true);
    setError("");

    // 새 파일 업로드
    const user = await getUser();
    const allUrls: string[] = [];
    for (const img of images) {
      if (img.file) {
        const ext = img.file.name.split(".").pop();
        const path = `systems/${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("uploads")
          .upload(path, img.file, { upsert: true });
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
          allUrls.push(publicUrl);
        }
      } else {
        allUrls.push(img.url);
      }
    }

    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      status: status || null,
      research_date: researchDate.trim() || null,
      description: description.trim() || null,
      link_url: linkUrl.trim() || null,
      image_url: allUrls[0] || null,
      images: allUrls.length > 0 ? allUrls : null,
    };

    if (isEdit) {
      const { error: updateErr } = await supabase.from("systems").update(payload).eq("id", editId);
      if (updateErr) { setError(updateErr.message); setLoading(false); return; }
      router.push(`/systems/${editId}`);
    } else {
      const { error: insertErr } = await supabase.from("systems").insert(payload);
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
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {images.map((img, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => setImgDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (imgDragIdx === null || imgDragIdx === i) return;
                    const reordered = [...images];
                    const [moved] = reordered.splice(imgDragIdx, 1);
                    reordered.splice(i, 0, moved);
                    setImages(reordered);
                    setImgDragIdx(null);
                  }}
                  onDragEnd={() => setImgDragIdx(null)}
                  className={`relative aspect-square bg-[#f5f5f5] border border-[#ddd] overflow-hidden cursor-grab active:cursor-grabbing ${imgDragIdx === i ? "opacity-40" : ""}`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover pointer-events-none" />
                  <span className="absolute top-1 left-1 text-[9px] text-white bg-[#111]/60 w-4 h-4 flex items-center justify-center">{i + 1}</span>
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-[#111] text-white text-[11px] border-0 cursor-pointer">×</button>
                </div>
              ))}
            </div>
          )}
          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#111]"); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#111]"); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-[#111]");
              const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
              if (files.length === 0) return;
              setNewFiles((prev) => [...prev, ...files]);
              for (const file of files) {
                const reader = new FileReader();
                reader.onload = () => setImages((prev) => [...prev, { file, url: reader.result as string }]);
                reader.readAsDataURL(file);
              }
            }}
            onClick={() => document.getElementById("sys-file")?.click()}
            className="border border-dashed border-[#ddd] py-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#999] transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="1" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
            </svg>
            <p className="text-[13px] text-[#999] mt-2">Drop images here or click to upload</p>
          </div>
          <input id="sys-file" type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
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
