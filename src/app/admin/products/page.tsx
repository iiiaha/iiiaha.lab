"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Product } from "@/lib/types";

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <label className="w-[100px] shrink-0 text-[11px] text-[#999] font-bold uppercase tracking-[0.05em]">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
    </div>
  );
}

const EMPTY_PRODUCT: Partial<Product> = {
  slug: "",
  name: "",
  type: "extension",
  platform: "sketchup",
  price: 0,
  description: "",
  version: "1.0.0",
  compatibility: "SketchUp 2021+",
  thumbnail_url: "",
  sort_order: 0,
};

export default function AdminProducts() {
  const router = useRouter();
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [adding, setAdding] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>(EMPTY_PRODUCT);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [platformTab, setPlatformTab] = useState<"sketchup" | "autocad">("sketchup");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const extensionProducts = useMemo(() => products.filter(p => p.type === "extension"), [products]);
  const filteredProducts = useMemo(
    () => extensionProducts.filter(p => p.platform === platformTab),
    [extensionProducts, platformTab]
  );

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });
    setProducts(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  // Drag reorder
  const handleDrop = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const reordered = [...filteredProducts];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const updates = reordered.map((p, i) =>
      supabase.from("products").update({ sort_order: i }).eq("id", p.id)
    );
    await Promise.all(updates);
    showMessage("Order updated");
    load();
  };

  // Reorder
  const moveProduct = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= products.length) return;

    const current = products[index];
    const target = products[targetIndex];

    const currentOrder = current.sort_order ?? index;
    const targetOrder = target.sort_order ?? targetIndex;

    await Promise.all([
      supabase.from("products").update({ sort_order: targetOrder }).eq("id", current.id),
      supabase.from("products").update({ sort_order: currentOrder }).eq("id", target.id),
    ]);

    showMessage("Order updated");
    load();
  };

  // Add
  const saveNew = async () => {
    const maxOrder = products.reduce((max, p) => Math.max(max, p.sort_order ?? 0), -1);
    const { data: inserted, error } = await supabase
      .from("products")
      .insert([{ ...newProduct, sort_order: maxOrder + 1, type: "extension", platform: platformTab }])
      .select("id")
      .single();
    if (error) { showMessage(`Error: ${error.message}`); return; }
    setAdding(false);
    setNewProduct(EMPTY_PRODUCT);
    if (inserted?.id) {
      router.push(`/admin/products/${inserted.id}/edit`);
    } else {
      load();
    }
  };

  // 공개 URL에서 스토리지 상대 경로 추출
  const pathFromPublicUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
      return m ? m[1] : null;
    } catch { return null; }
  };

  // Delete product + 관련 스토리지 파일 청소
  const deleteProduct = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? 썸네일·설치파일도 스토리지에서 같이 삭제됩니다.`)) return;
    const paths: string[] = [];
    if (p.file_key) paths.push(p.file_key);
    const thumbPath = pathFromPublicUrl(p.thumbnail_url);
    if (thumbPath) paths.push(thumbPath);
    if (paths.length > 0) {
      const res = await fetch("/api/admin/delete-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (!confirm(`스토리지 파일 삭제 실패 (${j.error ?? res.status}). DB 행만 삭제하고 계속할까요?`)) return;
      }
    }
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    showMessage("Deleted");
    load();
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em]">제품 관리</h1>
          <p className="text-[13px] text-[#999] mt-1.5">
            익스텐션 상품 등록·편집·정렬 (강의는 강의 관리에서)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
            className="text-[11px] text-[#666] bg-transparent border border-[#ddd] px-3 py-1.5 cursor-pointer hover:bg-[#f5f5f5]"
          >
            {viewMode === "list" ? "그리드 미리보기" : "리스트 보기"}
          </button>
          <button
            onClick={() => setAdding(true)}
            className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333]"
          >
            + 추가
          </button>
        </div>
      </div>
      <div className="h-5 mb-4 text-[11px] text-green-600">{message}</div>
      {/* Platform tabs */}
      <div className="flex gap-4 mb-0 text-[12px]">
        {([
          { key: "sketchup", label: "SketchUp" },
          { key: "autocad", label: "AutoCAD" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPlatformTab(key)}
            className={`pb-2 border-0 bg-transparent cursor-pointer text-[12px] tracking-[0.05em] hover:underline ${
              platformTab === key ? "font-bold text-[#111]" : "text-[#999]"
            }`}
          >
            {label} ({extensionProducts.filter(p => p.platform === key).length})
          </button>
        ))}
      </div>
      <div className="border-t border-[#111] mb-6" />

      {adding && (
        <div className="border border-[#111] p-4 mb-4">
          <p className="text-[11px] text-[#999] mb-3">기본 정보만 입력 후 추가 → 자동으로 편집 페이지로 이동합니다.</p>
          <Field label="Slug" value={newProduct.slug ?? ""} onChange={(v) => setNewProduct({ ...newProduct, slug: v })} />
          <Field label="Name" value={newProduct.name ?? ""} onChange={(v) => setNewProduct({ ...newProduct, name: v })} />
          <Field label="Price" value={newProduct.price ?? 0} type="number" onChange={(v) => setNewProduct({ ...newProduct, price: parseInt(v) || 0 })} />
          <Field label="Version" value={newProduct.version ?? ""} onChange={(v) => setNewProduct({ ...newProduct, version: v })} />
          <Field label="Compatibility" value={newProduct.compatibility ?? ""} onChange={(v) => setNewProduct({ ...newProduct, compatibility: v })} />
          <div className="flex gap-2 mt-3">
            <button onClick={saveNew} className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333]">Add Product</button>
            <button onClick={() => setAdding(false)} className="bg-white text-[#111] text-[12px] font-bold px-4 py-2 border border-[#ddd] cursor-pointer hover:bg-[#f5f5f5]">Cancel</button>
          </div>
        </div>
      )}

      {/* Grid Preview Mode — mirrors actual site layout */}
      {viewMode === "grid" && (
        <div className="mb-8">
          <div className="grid grid-cols-3 gap-x-10 gap-y-10">
            {filteredProducts.map((p, i) => (
              <div key={p.id} className="group relative">
                <div className="relative aspect-square bg-[#f5f5f5] border border-[#ddd] mb-3 overflow-hidden flex items-center justify-center p-14">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[13px] text-[#999]">{p.name}</span>
                  )}
                  <button onClick={() => moveProduct(i, "up")} disabled={i === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-white border border-[#ddd] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity disabled:hidden hover:border-[#111]">
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5L5 9" stroke="#111" strokeWidth="1.2"/></svg>
                  </button>
                  <button onClick={() => moveProduct(i, "down")} disabled={i === filteredProducts.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-white border border-[#ddd] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity disabled:hidden hover:border-[#111]">
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M1 1L5 5L1 9" stroke="#111" strokeWidth="1.2"/></svg>
                  </button>
                </div>
                <h3 className="text-[14px] font-bold">{p.name}</h3>
                <p className="text-[13px] text-[#666] mt-0.5">₩{p.price.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      <div className="border-t border-[#ddd]">
        {filteredProducts.map((p, i) => (
          <div key={p.id}>
            <div
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={() => { if (dragIdx !== null) handleDrop(dragIdx, i); setDragIdx(null); setDragOverIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={`flex items-center border-b border-[#ddd] py-2 gap-2 transition-colors ${
                dragOverIdx === i ? "border-t-2 border-t-[#111]" : ""
              } ${dragIdx === i ? "opacity-40" : ""}`}
            >
              <span className="shrink-0 cursor-grab active:cursor-grabbing text-[#ccc] hover:text-[#999]">
                <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                  <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
                  <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
                  <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
                </svg>
              </span>
              <span className="text-[10px] text-[#ccc] w-4 text-center shrink-0">{i + 1}</span>
              {p.thumbnail_url ? (<img src={p.thumbnail_url} alt="" className="w-5 h-5 object-contain shrink-0" />) : (<div className="w-5 h-5 bg-[#f5f5f5] border border-[#ddd] shrink-0" />)}
              <span className="text-[12px] font-bold truncate min-w-0 flex-1">{p.name}{p.version && <span className="ml-2 text-[10px] font-normal text-[#999]">v{p.version}</span>}</span>
              <div className="flex items-center gap-1 shrink-0 text-[11px]">
                {(p.discount_percent ?? 0) > 0 ? (
                  <>
                    <span className="text-[#ccc] line-through">₩{(p.original_price ?? p.price).toLocaleString()}</span>
                    <span className="font-bold text-red-600">₩{p.price.toLocaleString()}</span>
                    <span className="text-red-500 text-[10px]">-{p.discount_percent}%</span>
                  </>
                ) : (
                  <span className="text-[#666]">₩{p.price.toLocaleString()}</span>
                )}
              </div>
              <button onClick={() => router.push(`/admin/products/${p.id}/edit`)}
                className="text-[10px] text-[#999] bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer shrink-0 hover:bg-[#f5f5f5]">
                편집
              </button>
              <button onClick={() => deleteProduct(p)} className="text-[10px] text-red-500 bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer hover:bg-red-50 shrink-0">삭제</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
