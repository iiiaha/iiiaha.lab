"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Product } from "@/lib/types";

type EditState = Partial<Product> & { _discountOn?: boolean };

export default function ProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  const [data, setData] = useState<EditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingInstaller, setUploadingInstaller] = useState(false);
  const [message, setMessage] = useState("");
  const busy = uploading || uploadingInstaller || saving;

  useEffect(() => {
    (async () => {
      const { data: p, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !p) {
        router.push("/admin/products");
        return;
      }
      setData({ ...p, _discountOn: (p.discount_percent ?? 0) > 0 });
      setLoading(false);
    })();
  }, [id, router, supabase]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const update = (patch: Partial<EditState>) =>
    setData((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!data) return;
    setSaving(true);
    const orig = data.original_price ?? data.price ?? 0;
    const disc = data._discountOn ? data.discount_percent ?? 0 : 0;
    const payload = {
      slug: data.slug,
      name: data.name,
      subtitle: data.subtitle ?? null,
      badge: data.badge ?? null,
      type: data.type,
      platform: data.platform ?? null,
      price: disc > 0 ? Math.round(orig * (1 - disc / 100)) : orig,
      original_price: orig,
      discount_percent: disc,
      discount_start: data._discountOn ? data.discount_start ?? null : null,
      discount_end: data._discountOn ? data.discount_end ?? null : null,
      version: data.version ?? null,
      compatibility: data.compatibility ?? null,
      description: data.description ?? "",
      description_ko: data.description_ko ?? null,
      thumbnail_url: data.thumbnail_url ?? null,
      file_key: data.file_key ?? null,
      sort_order: data.sort_order ?? 0,
    };
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    setSaving(false);
    if (error) {
      showMessage(`Error: ${error.message}`);
      return;
    }
    router.push("/admin/products");
  };

  const uploadThumbnail = async (file: File) => {
    if (!data?.slug) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", data.slug);
      fd.append("folder", "thumbnails");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        showMessage(`Upload error: ${json.error ?? res.status}`);
        return;
      }
      update({ thumbnail_url: json.url });
      showMessage("썸네일 업로드 완료 — Save 눌러야 DB 반영");
    } finally {
      setUploading(false);
    }
  };

  const uploadInstaller = async (file: File) => {
    if (!data?.slug) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (data.platform === "sketchup" && ext !== "rbz") {
      showMessage("SketchUp 설치파일은 .rbz만 허용");
      return;
    }
    setUploadingInstaller(true);
    try {
      const folder = data.platform === "sketchup" ? "rbz" : "installers";
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", data.slug);
      fd.append("folder", folder);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        showMessage(`Upload error: ${json.error ?? res.status}`);
        return;
      }
      update({ file_key: `${folder}/${data.slug}.${ext}` });
      showMessage("설치파일 업로드 완료 — Save 눌러야 DB 반영");
    } finally {
      setUploadingInstaller(false);
    }
  };

  const deleteInstaller = async () => {
    if (!data?.file_key) return;
    if (!confirm("설치파일을 스토리지에서 삭제합니다. 제품은 유지됩니다.")) return;
    setUploadingInstaller(true);
    try {
      const res = await fetch("/api/admin/delete-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: [data.file_key] }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showMessage(`Delete error: ${j.error ?? res.status}`);
        return;
      }
      update({ file_key: undefined });
      showMessage("설치파일 삭제됨 — Save 눌러야 DB 반영");
    } finally {
      setUploadingInstaller(false);
    }
  };

  if (loading || !data) {
    return <div className="pt-20 text-center text-[14px] text-[#999]">Loading...</div>;
  }

  const orig = data.original_price ?? data.price ?? 0;
  const discountOn = !!data._discountOn;
  const discPercent = data.discount_percent ?? 0;
  const finalPrice = discountOn && discPercent > 0 ? Math.round(orig * (1 - discPercent / 100)) : orig;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin/products" className="flex items-center gap-1.5 text-[16px] font-bold tracking-[0.03em] no-underline hover:underline">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#111" strokeWidth="1.5"/></svg>
          제품 관리
        </Link>
        <div className="flex items-center gap-2">
          {message && <span className="text-[11px] text-green-600">{message}</span>}
          <Link href="/admin/products" className="text-[11px] text-[#666] border border-[#ddd] px-3 py-1.5 no-underline hover:bg-[#f5f5f5]">Cancel</Link>
          <button onClick={save} disabled={busy} className="text-[11px] text-white bg-[#111] px-4 py-1.5 border-0 cursor-pointer hover:bg-[#333] disabled:opacity-50 font-bold">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <div className="border-b border-[#111] mb-8" />

      {/* Thumbnail */}
      <section className="mb-8">
        <SectionLabel>Thumbnail</SectionLabel>
        <div className="aspect-video bg-[#f5f5f5] border border-[#ddd] flex items-center justify-center text-[#999] mb-2 max-w-[400px]">
          {data.thumbnail_url ? (
            <img src={data.thumbnail_url} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[12px]">No image</span>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadThumbnail(f); }}
          className="text-[12px] disabled:opacity-50"
        />
      </section>

      {/* Identity */}
      <section className="mb-8 grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="Slug" value={data.slug ?? ""} onChange={(v) => update({ slug: v })} />
        <Field label="Platform" value={data.platform ?? "sketchup"} onChange={(v) => update({ platform: v as "sketchup" | "autocad" })}
          options={[{ label: "SketchUp", value: "sketchup" }, { label: "AutoCAD", value: "autocad" }]} />
        <Field label="Name" value={data.name ?? ""} onChange={(v) => update({ name: v })} />
        <Field label="Sort Order" value={String(data.sort_order ?? 0)} onChange={(v) => update({ sort_order: parseInt(v) || 0 })} type="number" />
        <Field label="Subtitle" value={data.subtitle ?? ""} onChange={(v) => update({ subtitle: v })} />
        <Field label="Badge" value={data.badge ?? ""} onChange={(v) => update({ badge: v })} placeholder="e.g. New, Coming Soon" />
        <Field label="Version" value={data.version ?? ""} onChange={(v) => update({ version: v })} />
        <Field label="Compatibility" value={data.compatibility ?? ""} onChange={(v) => update({ compatibility: v })} />
      </section>

      {/* Pricing */}
      <section className="mb-8 border border-[#ddd] p-5">
        <SectionLabel>Pricing</SectionLabel>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] text-[#999] w-[80px] shrink-0">Price (₩)</span>
          <input type="text" inputMode="numeric" value={orig}
            onChange={(e) => update({ original_price: parseInt(e.target.value) || 0 })}
            className="w-[120px] border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111] text-right" />
        </div>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] text-[#999] w-[80px] shrink-0">Sale</span>
          <button type="button" onClick={() => update({ _discountOn: !discountOn })}
            className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${discountOn ? "bg-[#111]" : "bg-[#ddd]"}`}>
            <span className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${discountOn ? "left-[18px]" : "left-[2px]"}`} />
          </button>
          {discountOn && (
            <>
              <input type="text" inputMode="numeric" value={discPercent}
                onChange={(e) => update({ discount_percent: parseInt(e.target.value) || 0 })}
                className="w-[50px] border border-[#ddd] px-2 py-1.5 text-[13px] text-right outline-none focus:border-[#111]" />
              <span className="text-[11px] text-[#999]">%</span>
            </>
          )}
        </div>
        {discountOn && (
          <div className="flex items-center gap-3 mb-3 max-sm:flex-col max-sm:items-start">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#999] w-[80px] shrink-0">From</span>
              <input type="datetime-local"
                value={data.discount_start ? new Date(data.discount_start).toISOString().slice(0, 16) : ""}
                onChange={(e) => update({ discount_start: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="border border-[#ddd] px-2 py-1.5 text-[12px] outline-none focus:border-[#111]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#999] w-[80px] shrink-0">To</span>
              <input type="datetime-local"
                value={data.discount_end ? new Date(data.discount_end).toISOString().slice(0, 16) : ""}
                onChange={(e) => update({ discount_end: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="border border-[#ddd] px-2 py-1.5 text-[12px] outline-none focus:border-[#111]" />
            </div>
            <span className="text-[10px] text-[#ccc]">비워두면 항상 적용</span>
          </div>
        )}
        <div className="border-t border-[#eee] pt-3 mt-3 flex items-center gap-3">
          <span className="text-[11px] text-[#999] w-[80px] shrink-0">Final</span>
          {discountOn && discPercent > 0 ? (
            <>
              <span className="text-[12px] text-[#ccc] line-through">₩{orig.toLocaleString()}</span>
              <span className="text-[15px] font-bold text-red-600">₩{finalPrice.toLocaleString()}</span>
              <span className="text-[11px] text-red-500">-{discPercent}%</span>
            </>
          ) : (
            <span className="text-[15px] font-bold">₩{orig.toLocaleString()}</span>
          )}
        </div>
      </section>

      {/* Description (EN) */}
      <section className="mb-8">
        <SectionLabel>Description (EN)</SectionLabel>
        <RichTextarea value={data.description ?? ""} onChange={(v) => update({ description: v })} rows={10} />
        <FormatHint />
      </section>

      {/* Description (KR) */}
      <section className="mb-8">
        <SectionLabel>Description (KR)</SectionLabel>
        <RichTextarea value={data.description_ko ?? ""} onChange={(v) => update({ description_ko: v })} rows={10} />
        <FormatHint />
      </section>

      {/* Installer */}
      <section className="mb-8 border border-[#ddd] p-5">
        <SectionLabel>설치파일</SectionLabel>
        <input
          type="file"
          accept={data.platform === "sketchup" ? ".rbz" : ".exe,.msi,.zip"}
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadInstaller(f); }}
          className="text-[12px] disabled:opacity-50 mb-2"
        />
        {data.file_key ? (
          <div className="flex items-center gap-3">
            <code className="text-[11px] text-[#666] flex-1 truncate">{data.file_key}</code>
            <button type="button" onClick={deleteInstaller} disabled={busy}
              className="text-[11px] text-red-500 bg-transparent border border-[#ddd] px-2 py-1 cursor-pointer hover:bg-red-50 disabled:opacity-50">
              파일 삭제
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-[#ccc]">업로드된 파일 없음</p>
        )}
        <p className="text-[10px] text-[#ccc] mt-2">
          {data.platform === "sketchup"
            ? ".rbz만 허용. uploads/rbz/{slug}.rbz로 저장됨"
            : "uploads/installers/{slug}.{ext}로 저장됨"}
        </p>
      </section>

      {/* Bottom action bar */}
      <div className="flex items-center justify-end gap-2 border-t border-[#ddd] pt-5">
        {message && <span className="text-[11px] text-green-600 mr-auto">{message}</span>}
        <Link href="/admin/products" className="text-[12px] text-[#666] border border-[#ddd] px-4 py-2 no-underline hover:bg-[#f5f5f5]">Cancel</Link>
        <button onClick={save} disabled={busy} className="text-[12px] text-white bg-[#111] px-5 py-2 border-0 cursor-pointer hover:bg-[#333] disabled:opacity-50 font-bold">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[#999] tracking-[0.1em] uppercase mb-3 font-bold">{children}</p>;
}

function Field({
  label, value, onChange, type = "text", options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] text-[#999] uppercase tracking-[0.05em] mb-1">{label}</label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111] bg-white">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111]" />
      )}
    </div>
  );
}

function RichTextarea({ value, onChange, rows = 8 }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (left: string, right: string = left) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + left + selected + right + value.slice(end);
    onChange(next);
    // 커서를 wrap된 영역 안에 두기
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + left.length, end + left.length);
    });
  };

  const insertAtLineStart = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5 border border-[#ddd] border-b-0 px-2 py-1.5 bg-[#fafafa]">
        <ToolbarButton onClick={() => wrap("**")} title="Bold (Ctrl+B)">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton onClick={() => wrap("*")} title="Italic (Ctrl+I)">
          <em>I</em>
        </ToolbarButton>
        <span className="w-px h-4 bg-[#ddd] mx-1" />
        <ToolbarButton onClick={() => insertAtLineStart("• ")} title="Bullet line">
          •
        </ToolbarButton>
        <ToolbarButton onClick={() => wrap("• ", " — ")} title="Feature item (• Title — Description)">
          ⊕
        </ToolbarButton>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); wrap("**"); }
          if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); wrap("*"); }
        }}
        rows={rows}
        className="w-full border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111] resize-y font-mono leading-[1.6]"
      />
    </div>
  );
}

function ToolbarButton({ onClick, title, children }: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="text-[12px] w-7 h-7 flex items-center justify-center bg-white border border-[#ddd] cursor-pointer hover:bg-[#f5f5f5]">
      {children}
    </button>
  );
}

function FormatHint() {
  return (
    <p className="text-[10px] text-[#bbb] mt-1.5 leading-[1.5]">
      <code>**bold**</code> · <code>*italic*</code> · 줄 시작에 <code>• Title — Description</code> 형식은 강조 항목으로 렌더링됨
    </p>
  );
}
