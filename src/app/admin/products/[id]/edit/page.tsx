"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Product } from "@/lib/types";

type EditState = Partial<Product> & { _discountOn?: boolean };

interface ProductVersion {
  id: string;
  product_id: string;
  version: string;
  file_key: string | null;
  changelog: string | null;
  released_at: string;
  created_at: string;
}

export default function ProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  const [data, setData] = useState<EditState | null>(null);
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingInstaller, setUploadingInstaller] = useState(false);
  const [message, setMessage] = useState("");
  const busy = uploading || uploadingInstaller || saving;

  const reloadVersions = useCallback(async () => {
    const { data: rows } = await supabase
      .from("product_versions")
      .select("*")
      .eq("product_id", id)
      .order("released_at", { ascending: false });
    setVersions((rows ?? []) as ProductVersion[]);
  }, [id, supabase]);

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
      await reloadVersions();
      setLoading(false);
    })();
  }, [id, router, supabase, reloadVersions]);

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
      compatibility: data.compatibility ?? null,
      description: data.description ?? "",
      description_ko: data.description_ko ?? null,
      thumbnail_url: data.thumbnail_url ?? null,
      youtube_url: data.youtube_url ?? null,
      sort_order: data.sort_order ?? 0,
      // version + file_key are managed by the version manager below and
      // synced server-side; do NOT write them from this form.
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

  const addVersion = async (input: {
    version: string;
    file: File | null;
    changelog: string;
  }) => {
    if (!data?.slug || !data.platform) return false;
    const version = input.version.trim();
    if (!version) {
      showMessage("버전 번호를 입력해 주세요");
      return false;
    }
    if (versions.some((v) => v.version === version)) {
      showMessage(`v${version}은 이미 존재합니다`);
      return false;
    }
    if (!input.file) {
      showMessage("설치파일을 선택해 주세요");
      return false;
    }

    const file = input.file;
    setUploadingInstaller(true);
    try {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (data.platform === "sketchup" && ext !== "rbz") {
        showMessage("SketchUp 설치파일은 .rbz만 허용");
        return false;
      }

      // 1) signed upload URL 발급 (버전별 경로: {slug}_v{version}.{ext})
      const urlRes = await fetch("/api/admin/installer-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: data.slug,
          platform: data.platform,
          ext,
          version,
        }),
      });
      const urlJson = await urlRes.json().catch(() => ({}));
      if (!urlRes.ok) {
        showMessage(`Upload error: ${urlJson.error ?? urlRes.status}`);
        return false;
      }

      // 2) Storage 직접 PUT
      const { error: upErr } = await supabase.storage
        .from("uploads")
        .uploadToSignedUrl(urlJson.path, urlJson.token, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });
      if (upErr) {
        showMessage(`Upload error: ${upErr.message}`);
        return false;
      }
      const fileKey: string = urlJson.path;

      // 3) product_versions row INSERT (서버에서 products.version/file_key 동기화)
      const res = await fetch("/api/admin/product-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: id,
          version,
          file_key: fileKey,
          changelog: input.changelog.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage(`버전 추가 실패: ${json.error ?? res.status}`);
        return false;
      }

      await reloadVersions();
      // products.version은 서버에서 갱신됐으므로 로컬 state도 맞춰둔다
      update({ version, file_key: fileKey });
      showMessage(`v${version} 추가됨`);
      return true;
    } finally {
      setUploadingInstaller(false);
    }
  };

  const deleteVersion = async (v: ProductVersion) => {
    if (!confirm(`v${v.version}을 삭제합니다. 설치파일도 스토리지에서 함께 삭제됩니다.`)) return;
    setUploadingInstaller(true);
    try {
      const res = await fetch("/api/admin/product-versions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showMessage(`삭제 실패: ${j.error ?? res.status}`);
        return;
      }
      await reloadVersions();
      // 최신 버전이 바뀌었을 수 있으므로 products row를 다시 읽는다
      const { data: p } = await supabase
        .from("products")
        .select("version, file_key")
        .eq("id", id)
        .single();
      update({ version: p?.version ?? undefined, file_key: p?.file_key ?? undefined });
      showMessage(`v${v.version} 삭제됨`);
    } finally {
      setUploadingInstaller(false);
    }
  };

  const updateChangelog = async (v: ProductVersion, changelog: string) => {
    setUploadingInstaller(true);
    try {
      const res = await fetch("/api/admin/product-versions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, changelog }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showMessage(`수정 실패: ${j.error ?? res.status}`);
        return;
      }
      await reloadVersions();
      showMessage(`v${v.version} 변경사항 저장됨`);
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

      {/* YouTube */}
      <section className="mb-8">
        <SectionLabel>YouTube Video (optional)</SectionLabel>
        <input
          type="url"
          value={data.youtube_url ?? ""}
          onChange={(e) => update({ youtube_url: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=... 또는 https://youtu.be/..."
          className="w-full border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111]"
        />
        <p className="text-[10px] text-[#bbb] mt-1.5">
          입력하면 상세 페이지 상단에 썸네일 대신 이 영상이 16:9 임베드로 표시됨. 비우면 썸네일이 표시됨.
        </p>
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

      {/* Description (KR) */}
      <section className="mb-8">
        <SectionLabel>Description</SectionLabel>
        <RichTextarea value={data.description_ko ?? ""} onChange={(v) => update({ description_ko: v })} rows={10} />
        <FormatHint />
      </section>

      {/* Installer / Versions */}
      <section className="mb-8 border border-[#ddd] p-5">
        <SectionLabel>설치파일 · 버전 관리</SectionLabel>
        <p className="text-[11px] text-[#999] mb-4">
          가장 최근 배포(released_at 기준)가 자동으로 “현재 버전”이 되어 다운로드·마이페이지에 노출됩니다.
        </p>
        <VersionManager
          platform={data.platform ?? "sketchup"}
          versions={versions}
          busy={busy}
          onAdd={addVersion}
          onDelete={deleteVersion}
          onSaveChangelog={updateChangelog}
        />
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

function VersionManager({
  platform,
  versions,
  busy,
  onAdd,
  onDelete,
  onSaveChangelog,
}: {
  platform: "sketchup" | "autocad";
  versions: ProductVersion[];
  busy: boolean;
  onAdd: (input: { version: string; file: File | null; changelog: string }) => Promise<boolean>;
  onDelete: (v: ProductVersion) => void;
  onSaveChangelog: (v: ProductVersion, changelog: string) => void;
}) {
  const [newVersion, setNewVersion] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newChangelog, setNewChangelog] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const accept = platform === "sketchup" ? ".rbz" : ".exe,.msi,.zip";

  const handleAdd = async () => {
    const ok = await onAdd({ version: newVersion, file: newFile, changelog: newChangelog });
    if (ok) {
      setNewVersion("");
      setNewFile(null);
      setNewChangelog("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const latestId = versions[0]?.id;

  return (
    <div className="flex flex-col gap-4">
      {/* Version list */}
      {versions.length === 0 ? (
        <p className="text-[11px] text-[#ccc] py-4 text-center border border-dashed border-[#eee]">
          등록된 버전 없음
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {versions.map((v) => (
            <VersionRow
              key={v.id}
              v={v}
              isLatest={v.id === latestId}
              busy={busy}
              onDelete={() => onDelete(v)}
              onSaveChangelog={(text) => onSaveChangelog(v, text)}
            />
          ))}
        </ul>
      )}

      {/* New version form */}
      <div className="border-t border-[#eee] pt-4">
        <p className="text-[11px] text-[#999] tracking-[0.1em] uppercase mb-3 font-bold">새 버전 추가</p>
        <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3 items-center mb-3">
          <span className="text-[11px] text-[#999]">버전 번호</span>
          <input
            type="text"
            value={newVersion}
            onChange={(e) => setNewVersion(e.target.value)}
            placeholder="1.0.1"
            disabled={busy}
            className="border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111] disabled:opacity-50 max-w-[200px]"
          />
          <span className="text-[11px] text-[#999]">설치파일</span>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            disabled={busy}
            onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
            className="text-[12px] disabled:opacity-50"
          />
        </div>
        <p className="text-[11px] text-[#999] mb-1.5">변경사항</p>
        <textarea
          value={newChangelog}
          onChange={(e) => setNewChangelog(e.target.value)}
          placeholder="• 버그 수정 — 어떤 상황에서 어떤 문제가 있었고, 어떻게 해결했는지&#10;• 기능 개선 — ..."
          rows={5}
          disabled={busy}
          className="w-full border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111] resize-y font-mono leading-[1.6] disabled:opacity-50"
        />
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !newVersion.trim()}
            className="text-[12px] text-white bg-[#111] px-4 py-2 border-0 cursor-pointer hover:bg-[#333] disabled:opacity-50 font-bold"
          >
            버전 추가
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionRow({
  v,
  isLatest,
  busy,
  onDelete,
  onSaveChangelog,
}: {
  v: ProductVersion;
  isLatest: boolean;
  busy: boolean;
  onDelete: () => void;
  onSaveChangelog: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v.changelog ?? "");

  // 외부에서 v.changelog가 reload되면 draft를 따라가게
  useEffect(() => {
    if (!editing) setDraft(v.changelog ?? "");
  }, [v.changelog, editing]);

  const released = new Date(v.released_at);
  const releasedLabel = `${released.getFullYear()}.${String(released.getMonth() + 1).padStart(2, "0")}.${String(
    released.getDate()
  ).padStart(2, "0")}`;

  return (
    <li className="border border-[#eee] p-3">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[13px] font-bold">v{v.version}</span>
        {isLatest && (
          <span className="text-[10px] text-white bg-[#111] px-1.5 py-0.5 tracking-[0.05em]">LATEST</span>
        )}
        <span className="text-[11px] text-[#999]">{releasedLabel}</span>
        {v.file_key ? (
          <code className="text-[10px] text-[#999] truncate flex-1" title={v.file_key}>
            {v.file_key}
          </code>
        ) : (
          <span className="text-[10px] text-[#ccc] flex-1">파일 없음</span>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="text-[11px] text-[#666] bg-transparent border border-[#ddd] px-2 py-1 cursor-pointer hover:bg-[#f5f5f5] disabled:opacity-50"
          >
            변경사항 수정
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="text-[11px] text-red-500 bg-transparent border border-[#ddd] px-2 py-1 cursor-pointer hover:bg-red-50 disabled:opacity-50"
        >
          삭제
        </button>
      </div>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            disabled={busy}
            className="w-full border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111] resize-y font-mono leading-[1.6] disabled:opacity-50"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setDraft(v.changelog ?? "");
                setEditing(false);
              }}
              disabled={busy}
              className="text-[11px] text-[#666] border border-[#ddd] px-3 py-1.5 bg-white cursor-pointer hover:bg-[#f5f5f5] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveChangelog(draft);
                setEditing(false);
              }}
              disabled={busy}
              className="text-[11px] text-white bg-[#111] px-3 py-1.5 border-0 cursor-pointer hover:bg-[#333] disabled:opacity-50 font-bold"
            >
              저장
            </button>
          </div>
        </>
      ) : v.changelog ? (
        <pre className="text-[12px] text-[#333] whitespace-pre-wrap font-mono leading-[1.6] m-0">
          {v.changelog}
        </pre>
      ) : (
        <p className="text-[11px] text-[#ccc] italic">변경사항 없음</p>
      )}
    </li>
  );
}
