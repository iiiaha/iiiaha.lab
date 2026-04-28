"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Product } from "@/lib/types";

type CourseRow = Product & { episode_count?: number };

const EMPTY_COURSE: Partial<Product> = {
  slug: "",
  name: "",
  subtitle: "",
  badge: "",
  type: "course",
  price: 0,
  description: "",
  description_ko: "",
  thumbnail_url: "",
};

export default function AdminCourses() {
  const supabase = createClient();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Product>>({});
  const [adding, setAdding] = useState(false);
  const [newCourse, setNewCourse] = useState<Partial<Product>>(EMPTY_COURSE);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const showMessage = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(""), 3000);
  };

  const load = async () => {
    const { data: products } = await supabase
      .from("products")
      .select("*")
      .eq("type", "course")
      .order("sort_order", { ascending: true });

    if (!products) { setCourses([]); return; }

    const withCounts = await Promise.all(
      products.map(async (p) => {
        const { count } = await supabase
          .from("course_episodes")
          .select("id", { count: "exact", head: true })
          .eq("product_id", p.id);
        return { ...p, episode_count: count ?? 0 } as CourseRow;
      })
    );
    setCourses(withCounts);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const startEdit = (c: CourseRow) => {
    setEditing(c.id);
    setEditData({ ...c, _discountOn: (c.discount_percent ?? 0) > 0 } as Partial<Product>);
    setAdding(false);
  };

  const discountOn = !!(editData as Record<string, unknown>)._discountOn;
  const origPrice = editData.original_price ?? editData.price ?? 0;
  const discPercent = editData.discount_percent ?? 0;
  const finalPrice = discountOn && discPercent > 0 ? Math.round(origPrice * (1 - discPercent / 100)) : origPrice;

  const saveEdit = async () => {
    if (!editing) return;
    const e = editData as Product & { _discountOn?: boolean };
    const orig = e.original_price ?? e.price ?? 0;
    const disc = e._discountOn ? (e.discount_percent ?? 0) : 0;
    const payload = {
      slug: e.slug,
      name: e.name,
      subtitle: e.subtitle ?? null,
      badge: e.badge ?? null,
      type: "course",
      platform: null,
      price: disc > 0 ? Math.round(orig * (1 - disc / 100)) : orig,
      original_price: orig,
      discount_percent: disc,
      discount_start: e._discountOn ? (e.discount_start ?? null) : null,
      discount_end: e._discountOn ? (e.discount_end ?? null) : null,
      description: e.description ?? "",
      description_ko: e.description_ko ?? null,
      thumbnail_url: e.thumbnail_url ?? null,
      sort_order: e.sort_order ?? 0,
    };
    const { error } = await supabase.from("products").update(payload).eq("id", editing);
    if (error) {
      console.error("[admin/courses] save error", error, payload);
      showMessage(`Error: ${error.message}`);
      return;
    }
    setEditing(null);
    showMessage("Saved");
    load();
  };

  const saveNew = async () => {
    const maxOrder = courses.reduce((max, p) => Math.max(max, p.sort_order ?? 0), -1);
    const { error } = await supabase
      .from("products")
      .insert([{ ...newCourse, type: "course", platform: null, sort_order: maxOrder + 1 }]);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    setAdding(false);
    setNewCourse(EMPTY_COURSE);
    showMessage("Course added");
    load();
  };

  const pathFromPublicUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
      return m ? m[1] : null;
    } catch { return null; }
  };

  const deleteCourse = async (c: CourseRow) => {
    if (!confirm(`Delete "${c.name}"? 에피소드와 썸네일도 같이 삭제됩니다.`)) return;
    const paths: string[] = [];
    const thumbPath = pathFromPublicUrl(c.thumbnail_url);
    if (thumbPath) paths.push(thumbPath);
    if (paths.length) {
      const res = await fetch("/api/admin/delete-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (!confirm(`스토리지 파일 삭제 실패 (${j.error ?? res.status}). DB만 삭제하고 계속할까요?`)) return;
      }
    }
    const { error } = await supabase.from("products").delete().eq("id", c.id);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    showMessage("Deleted");
    load();
  };

  const uploadThumbnail = async (file: File, slug: string, target: "edit" | "new") => {
    if (!slug) { showMessage("Upload error: slug 없음"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      fd.append("folder", "thumbnails");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        console.error("[admin/courses] upload error", json);
        showMessage(`Upload error: ${json.error ?? res.status}`);
        return;
      }
      if (target === "edit") setEditData((p) => ({ ...p, thumbnail_url: json.url }));
      else setNewCourse((p) => ({ ...p, thumbnail_url: json.url }));
      showMessage("Uploaded — Save 눌러야 DB 반영됨");
    } finally {
      setUploading(false);
    }
  };

  const editPanel = editing ? (
    <div className="fixed right-0 top-0 w-[420px] h-full bg-white border-l border-[#ddd] px-8 py-8 overflow-y-auto z-50 shadow-[-4px_0_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold">강의 편집</h2>
        <button onClick={() => setEditing(null)} className="text-[11px] text-[#999] bg-transparent border-0 cursor-pointer hover:underline">닫기</button>
      </div>

      <div className="flex flex-col gap-2 text-[12px]">
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Slug</label><input value={editData.slug ?? ""} onChange={(e) => setEditData({...editData, slug: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Name</label><input value={editData.name ?? ""} onChange={(e) => setEditData({...editData, name: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Subtitle</label><input value={editData.subtitle ?? ""} onChange={(e) => setEditData({...editData, subtitle: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Badge</label><input value={editData.badge ?? ""} onChange={(e) => setEditData({...editData, badge: e.target.value})} placeholder="e.g. New" className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>

        <div className="border border-[#eee] p-2.5 mt-1">
          <p className="text-[10px] text-[#999] font-bold uppercase mb-2">Pricing</p>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-[#999] w-[50px] shrink-0">Price</span>
            <span className="text-[11px] text-[#999]">₩</span>
            <input type="text" inputMode="numeric" value={origPrice} onChange={(e) => setEditData({...editData, original_price: parseInt(e.target.value) || 0})} className="w-[70px] border border-[#ddd] px-1.5 py-0.5 text-[12px] text-right outline-none focus:border-[#111]" />
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-[#999] w-[50px] shrink-0">Sale</span>
            <button type="button" onClick={() => setEditData((prev) => ({...prev, _discountOn: !discountOn} as Partial<Product>))} className={`w-7 h-4 rounded-full relative transition-colors shrink-0 ${discountOn ? "bg-[#111]" : "bg-[#ddd]"}`}>
              <span className={`absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all ${discountOn ? "left-[13px]" : "left-[2px]"}`} />
            </button>
            {discountOn && (
              <>
                <input type="text" inputMode="numeric" value={discPercent} onChange={(e) => setEditData({...editData, discount_percent: parseInt(e.target.value) || 0})} className="w-[32px] border border-[#ddd] px-1 py-0.5 text-[12px] text-right outline-none focus:border-[#111]" />
                <span className="text-[10px] text-[#999]">%</span>
              </>
            )}
          </div>
          {discountOn && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] text-[#999] w-[50px] shrink-0">From</span>
                <input type="datetime-local" value={editData.discount_start ? new Date(editData.discount_start).toISOString().slice(0,16) : ""} onChange={(e) => setEditData({...editData, discount_start: e.target.value ? new Date(e.target.value).toISOString() : undefined} as Partial<Product>)} className="flex-1 border border-[#ddd] px-1 py-0.5 text-[11px] outline-none focus:border-[#111]" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#999] w-[50px] shrink-0">To</span>
                <input type="datetime-local" value={editData.discount_end ? new Date(editData.discount_end).toISOString().slice(0,16) : ""} onChange={(e) => setEditData({...editData, discount_end: e.target.value ? new Date(e.target.value).toISOString() : undefined} as Partial<Product>)} className="flex-1 border border-[#ddd] px-1 py-0.5 text-[11px] outline-none focus:border-[#111]" />
              </div>
              <p className="text-[9px] text-[#ccc] mt-1">Leave empty = always active</p>
            </div>
          )}
          <div className="border-t border-[#eee] pt-2 mt-1 flex items-center gap-1.5">
            <span className="text-[10px] text-[#999] w-[50px] shrink-0">Final</span>
            {discountOn && discPercent > 0 ? (
              <><span className="text-[11px] text-[#ccc] line-through">₩{origPrice.toLocaleString()}</span><span className="text-[13px] font-bold text-red-600">₩{finalPrice.toLocaleString()}</span><span className="text-[10px] text-red-500">-{discPercent}%</span></>
            ) : (
              <span className="text-[13px] font-bold">₩{origPrice.toLocaleString()}</span>
            )}
          </div>
        </div>

        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Desc (EN)</label><textarea value={editData.description ?? ""} onChange={(e) => setEditData({...editData, description: e.target.value})} rows={4} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111] resize-y font-[inherit]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Desc (KR)</label><textarea value={editData.description_ko ?? ""} onChange={(e) => setEditData({...editData, description_ko: e.target.value})} rows={4} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111] resize-y font-[inherit]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Thumbnail URL</label><input value={editData.thumbnail_url ?? ""} onChange={(e) => setEditData({...editData, thumbnail_url: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f && editing && editData.slug) uploadThumbnail(f, editData.slug, "edit"); }} className="text-[11px] disabled:opacity-50" />
          {uploading && <span className="text-[10px] text-[#999]">업로드 중...</span>}
          {editData.thumbnail_url && !uploading && <img src={editData.thumbnail_url} alt="" className="w-6 h-6 object-contain border border-[#ddd]" />}
        </div>

        <div className="flex gap-2 mt-3 justify-between items-center">
          <Link href={`/admin/courses/${editing}`} className="text-[11px] text-[#111] no-underline hover:underline">에피소드 관리 →</Link>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="text-[11px] text-[#111] px-3 py-1.5 border border-[#ddd] bg-white cursor-pointer hover:bg-[#f5f5f5]">Cancel</button>
            <button onClick={saveEdit} disabled={uploading} className="text-[11px] text-white bg-[#111] px-3 py-1.5 border-0 cursor-pointer hover:bg-[#333] disabled:opacity-50">{uploading ? "업로드 중..." : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em]">강의 관리</h1>
          <p className="text-[13px] text-[#999] mt-1.5">강의 등록·가격·설명·썸네일 및 에피소드 관리</p>
        </div>
        <button
          onClick={() => { setAdding(true); setEditing(null); }}
          className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333]"
        >
          + 추가
        </button>
      </div>
      <div className="h-5 mb-4 text-[11px] text-green-600">{message}</div>
      <div className="border-t border-[#111] mb-6" />

      {adding && (
        <div className="border border-[#111] p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="w-[100px] shrink-0 text-[11px] text-[#999] font-bold uppercase tracking-[0.05em]">Slug</label>
            <input value={newCourse.slug ?? ""} onChange={(e) => setNewCourse({...newCourse, slug: e.target.value})} className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <label className="w-[100px] shrink-0 text-[11px] text-[#999] font-bold uppercase tracking-[0.05em]">Name</label>
            <input value={newCourse.name ?? ""} onChange={(e) => setNewCourse({...newCourse, name: e.target.value})} className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <label className="w-[100px] shrink-0 text-[11px] text-[#999] font-bold uppercase tracking-[0.05em]">Price</label>
            <input type="number" value={newCourse.price ?? 0} onChange={(e) => setNewCourse({...newCourse, price: parseInt(e.target.value) || 0})} className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
          </div>
          <p className="text-[10px] text-[#999] mt-1 mb-2">추가 후 편집에서 썸네일·할인·설명을 입력하세요.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={saveNew} className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333]">Add Course</button>
            <button onClick={() => setAdding(false)} className="bg-white text-[#111] text-[12px] font-bold px-4 py-2 border border-[#ddd] cursor-pointer hover:bg-[#f5f5f5]">Cancel</button>
          </div>
        </div>
      )}

      <div className="border-t border-[#ddd]">
        {courses.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">강의 없음. + 추가로 등록하세요.</p>
        ) : (
          courses.map((c) => (
            <div key={c.id} className={`flex items-center border-b border-[#ddd] py-2 gap-2 ${editing === c.id ? "bg-[#f8f8f8]" : ""}`}>
              {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" className="w-5 h-5 object-contain shrink-0" /> : <div className="w-5 h-5 bg-[#f5f5f5] border border-[#ddd] shrink-0" />}
              <span className="text-[12px] font-bold truncate min-w-0 flex-1">{c.name}</span>
              <span className="text-[10px] text-[#999] shrink-0">{c.episode_count ?? 0} eps</span>
              <div className="flex items-center gap-1 shrink-0 text-[11px]">
                {(c.discount_percent ?? 0) > 0 ? (
                  <>
                    <span className="text-[#ccc] line-through">₩{(c.original_price ?? c.price).toLocaleString()}</span>
                    <span className="font-bold text-red-600">₩{c.price.toLocaleString()}</span>
                    <span className="text-red-500 text-[10px]">-{c.discount_percent}%</span>
                  </>
                ) : (
                  <span className="text-[#666]">₩{c.price.toLocaleString()}</span>
                )}
              </div>
              <button onClick={() => startEdit(c)} className={`text-[10px] bg-transparent border px-2 py-0.5 cursor-pointer shrink-0 ${editing === c.id ? "text-[#111] border-[#111] font-bold" : "text-[#999] border-[#ddd] hover:bg-[#f5f5f5]"}`}>편집</button>
              <Link href={`/admin/courses/${c.id}`} className="text-[10px] text-[#111] border border-[#ddd] px-2 py-0.5 no-underline hover:bg-[#f5f5f5] shrink-0">에피소드</Link>
              <button onClick={() => deleteCourse(c)} className="text-[10px] text-red-500 bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer hover:bg-red-50 shrink-0">삭제</button>
            </div>
          ))
        )}
      </div>
      {editPanel}
    </div>
  );
}
