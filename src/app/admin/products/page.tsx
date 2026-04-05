"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { Product } from "@/lib/types";

const EMPTY_PRODUCT: Partial<Product> = {
  slug: "",
  name: "",
  display_name: "",
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
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Product>>({});
  const [adding, setAdding] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>(EMPTY_PRODUCT);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [platformTab, setPlatformTab] = useState<"all" | "sketchup" | "autocad" | "course">("all");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const filteredProducts = useMemo(() => {
    if (platformTab === "all") return products;
    if (platformTab === "course") return products.filter(p => p.type === "course");
    return products.filter(p => p.platform === platformTab);
  }, [products, platformTab]);

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

    // Update sort_order for all affected items
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

    // swap sort_order
    const currentOrder = current.sort_order ?? index;
    const targetOrder = target.sort_order ?? targetIndex;

    await Promise.all([
      supabase.from("products").update({ sort_order: targetOrder }).eq("id", current.id),
      supabase.from("products").update({ sort_order: currentOrder }).eq("id", target.id),
    ]);

    showMessage("Order updated");
    load();
  };

  // Edit
  const startEdit = (p: Product) => {
    setEditing(p.id);
    setEditData({ ...p, _discountOn: (p.discount_percent ?? 0) > 0 } as Partial<Product>);
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { id, _discountOn, ...rest } = editData as Product & { _discountOn?: boolean };
    // Calculate final price
    const orig = rest.original_price ?? rest.price ?? 0;
    const disc = _discountOn ? (rest.discount_percent ?? 0) : 0;
    rest.original_price = orig;
    rest.discount_percent = disc;
    rest.price = disc > 0 ? Math.round(orig * (1 - disc / 100)) : orig;
    if (!_discountOn) {
      rest.discount_start = null as unknown as undefined;
      rest.discount_end = null as unknown as undefined;
    }
    const { error } = await supabase.from("products").update(rest).eq("id", editing);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    setEditing(null);
    showMessage("Saved");
    load();
  };

  // Add
  const saveNew = async () => {
    const maxOrder = products.reduce((max, p) => Math.max(max, p.sort_order ?? 0), -1);
    const type = platformTab === "course" ? "course" : "extension";
    const platform = platformTab === "course" ? null : (platformTab === "all" ? "sketchup" : platformTab);
    const { error } = await supabase.from("products").insert([{ ...newProduct, sort_order: maxOrder + 1, type, platform }]);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    setAdding(false);
    setNewProduct(EMPTY_PRODUCT);
    showMessage("Product added");
    load();
  };

  // Delete
  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    showMessage("Deleted");
    load();
  };

  // Thumbnail upload
  const uploadThumbnail = async (file: File, slug: string, target: "edit" | "new") => {
    const ext = file.name.split(".").pop();
    const path = `thumbnails/${slug}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
    if (error) { showMessage(`Upload error: ${error.message}`); return; }
    const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
    if (target === "edit") setEditData((prev) => ({ ...prev, thumbnail_url: publicUrl }));
    else setNewProduct((prev) => ({ ...prev, thumbnail_url: publicUrl }));
    showMessage("Uploaded");
  };

  const Field = ({ label, value, onChange, type = "text", options }: {
    label: string; value: string | number; onChange: (v: string) => void;
    type?: string; options?: { label: string; value: string }[];
  }) => (
    <div className="flex items-center gap-2 mb-2">
      <label className="w-[100px] shrink-0 text-[11px] text-[#999] font-bold uppercase tracking-[0.05em]">{label}</label>
      {options ? (
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]" />
      )}
    </div>
  );

  const discountOn = !!(editData as Record<string, unknown>)._discountOn;
  const origPrice = editData.original_price ?? editData.price ?? 0;
  const discPercent = editData.discount_percent ?? 0;
  const finalPrice = discountOn && discPercent > 0 ? Math.round(origPrice * (1 - discPercent / 100)) : origPrice;

  const editPanel = editing ? (
    <div className="fixed right-0 top-0 w-[340px] h-full bg-white border-l border-[#ddd] px-6 py-8 overflow-y-auto z-50 shadow-[-4px_0_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-bold">Edit</h2>
        <button onClick={() => setEditing(null)} className="text-[11px] text-[#999] bg-transparent border-0 cursor-pointer hover:underline">Close</button>
      </div>

      <div className="flex flex-col gap-2 text-[12px]">
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Slug</label><input value={editData.slug ?? ""} onChange={(e) => setEditData({...editData, slug: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Name</label><input value={editData.name ?? ""} onChange={(e) => setEditData({...editData, name: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Display Name</label><input value={editData.display_name ?? ""} onChange={(e) => setEditData({...editData, display_name: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>

        {/* Pricing */}
        <div className="border border-[#eee] p-2.5 mt-1">
          <p className="text-[10px] text-[#999] font-bold uppercase mb-2">Pricing</p>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-[#999] w-[50px] shrink-0">Price</span>
            <span className="text-[11px] text-[#999]">₩</span>
            <input type="text" inputMode="numeric" value={origPrice} onChange={(e) => setEditData({...editData, original_price: parseInt(e.target.value) || 0})} className="w-[70px] border border-[#ddd] px-1.5 py-0.5 text-[12px] text-right outline-none focus:border-[#111]" />
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-[#999] w-[50px] shrink-0">Sale</span>
            <button type="button" onClick={() => setEditData((prev) => ({...prev, _discountOn: !discountOn} as Partial<Product>))} className={`w-7 h-4 rounded-full relative transition-colors shrink-0 ${discountOn ? "bg-[#111]" : "bg-[#ddd]"}`}><span className={`absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all ${discountOn ? "left-[13px]" : "left-[2px]"}`} /></button>
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

        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Version</label><input value={editData.version ?? ""} onChange={(e) => setEditData({...editData, version: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Compatibility</label><input value={editData.compatibility ?? ""} onChange={(e) => setEditData({...editData, compatibility: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Desc (EN)</label><textarea value={editData.description ?? ""} onChange={(e) => setEditData({...editData, description: e.target.value})} rows={4} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111] resize-y font-[inherit]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Desc (KR)</label><textarea value={editData.description_ko ?? ""} onChange={(e) => setEditData({...editData, description_ko: e.target.value})} rows={4} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111] resize-y font-[inherit]" /></div>
        <div><label className="text-[10px] text-[#999] uppercase block mb-0.5">Thumbnail URL</label><input value={editData.thumbnail_url ?? ""} onChange={(e) => setEditData({...editData, thumbnail_url: e.target.value})} className="w-full border border-[#ddd] px-2 py-1 text-[12px] outline-none focus:border-[#111]" /></div>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f && editing) { const ep = filteredProducts.find(p=>p.id===editing); if(ep) uploadThumbnail(f, ep.slug, "edit"); }}} className="text-[11px]" />
          {editData.thumbnail_url && <img src={editData.thumbnail_url} alt="" className="w-6 h-6 object-contain border border-[#ddd]" />}
        </div>

        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={() => setEditing(null)} className="text-[11px] text-[#111] px-3 py-1.5 border border-[#ddd] bg-white cursor-pointer hover:bg-[#f5f5f5]">Cancel</button>
          <button onClick={saveEdit} className="text-[11px] text-white bg-[#111] px-3 py-1.5 border-0 cursor-pointer hover:bg-[#333]">Save</button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div>
      <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold tracking-[0.03em]">Products</h1>
          {message && <span className="text-[11px] text-green-600">{message}</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
            className="text-[11px] text-[#666] bg-transparent border border-[#ddd] px-3 py-1.5 cursor-pointer hover:bg-[#f5f5f5]"
          >
            {viewMode === "list" ? "Grid Preview" : "List View"}
          </button>
          <button
            onClick={() => { setAdding(true); setEditing(null); }}
            className="bg-[#111] text-white text-[12px] font-bold px-4 py-2 border-0 cursor-pointer hover:bg-[#333]"
          >
            + Add
          </button>
        </div>
      </div>
      {/* Platform tabs */}
      <div className="flex gap-4 mb-0 text-[12px]">
        {([
          { key: "all", label: "All" },
          { key: "sketchup", label: "SketchUp" },
          { key: "autocad", label: "AutoCAD" },
          { key: "course", label: "Courses" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPlatformTab(key)}
            className={`pb-2 border-0 bg-transparent cursor-pointer text-[12px] tracking-[0.05em] hover:underline ${
              platformTab === key ? "font-bold text-[#111]" : "text-[#999]"
            }`}
          >
            {label} ({key === "all" ? products.length : key === "course" ? products.filter(p => p.type === "course").length : products.filter(p => p.platform === key).length})
          </button>
        ))}
      </div>
      <div className="border-t border-[#111] mb-6" />

      {adding && (
        <div className="border border-[#111] p-4 mb-4">
          <Field label="Slug" value={newProduct.slug ?? ""} onChange={(v) => setNewProduct({ ...newProduct, slug: v })} />
          <Field label="Name" value={newProduct.name ?? ""} onChange={(v) => setNewProduct({ ...newProduct, name: v })} />
          <Field label="Display Name" value={newProduct.display_name ?? ""} onChange={(v) => setNewProduct({ ...newProduct, display_name: v })} />
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
                {/* Thumbnail with reorder buttons */}
                <div className="relative aspect-square bg-[#f5f5f5] border border-[#ddd] mb-3 overflow-hidden flex items-center justify-center p-14">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.display_name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[13px] text-[#999]">{p.display_name}</span>
                  )}
                  {/* Left arrow */}
                  <button onClick={() => moveProduct(i, "up")} disabled={i === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-white border border-[#ddd] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity disabled:hidden hover:border-[#111]">
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5L5 9" stroke="#111" strokeWidth="1.2"/></svg>
                  </button>
                  {/* Right arrow */}
                  <button onClick={() => moveProduct(i, "down")} disabled={i === filteredProducts.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-white border border-[#ddd] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity disabled:hidden hover:border-[#111]">
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M1 1L5 5L1 9" stroke="#111" strokeWidth="1.2"/></svg>
                  </button>
                </div>
                <h3 className="text-[14px] font-bold">{p.display_name}</h3>
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
                  editing === p.id ? "bg-[#f8f8f8]" : ""
                } ${dragOverIdx === i ? "border-t-2 border-t-[#111]" : ""} ${dragIdx === i ? "opacity-40" : ""}`}
              >
                {/* Drag handle */}
                <span className="shrink-0 cursor-grab active:cursor-grabbing text-[#ccc] hover:text-[#999]">
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                    <circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>
                    <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
                    <circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
                  </svg>
                </span>
                <span className="text-[10px] text-[#ccc] w-4 text-center shrink-0">{i + 1}</span>
                {p.thumbnail_url ? (<img src={p.thumbnail_url} alt="" className="w-5 h-5 object-contain shrink-0" />) : (<div className="w-5 h-5 bg-[#f5f5f5] border border-[#ddd] shrink-0" />)}
                <span className="text-[12px] font-bold truncate min-w-0 flex-1">{p.display_name}</span>
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
                <button onClick={() => startEdit(p)} className={`text-[10px] bg-transparent border px-2 py-0.5 cursor-pointer shrink-0 ${editing === p.id ? "text-[#111] border-[#111] font-bold" : "text-[#999] border-[#ddd] hover:bg-[#f5f5f5]"}`}>Edit</button>
                <button onClick={() => deleteProduct(p.id, p.display_name)} className="text-[10px] text-red-500 bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer hover:bg-red-50 shrink-0">Del</button>
              </div>
          </div>
        ))}
      </div>
      </div>
      {editPanel}
    </div>
  );
}
