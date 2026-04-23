"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

interface ProductOption {
  id: string;
  name: string;
  platform: string | null;
}

const SKETCHUP_VERSIONS = ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017"];
const AUTOCAD_YEARS = ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018"];

export default function NewPostPage() {
  return (
    <Suspense fallback={<div className="pt-20 text-center text-[14px] text-[#999]">Loading...</div>}>
      <PostForm />
    </Suspense>
  );
}

function PostForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const editId = searchParams.get("edit");
  const isEdit = !!editId;

  const [userId, setUserId] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [category, setCategory] = useState<"idea" | "bug" | "notice">("bug");
  const [isAdmin, setIsAdmin] = useState(false);
  const [productId, setProductId] = useState("");
  const [sketchupVersion, setSketchupVersion] = useState("");
  const [autocadVersion, setAutocadVersion] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { isAdmin: checkAdmin } = await import("@/lib/admin");
      setIsAdmin(await checkAdmin());

      const { data } = await supabase
        .from("products")
        .select("id, name, slug, platform")
        .order("sort_order", { ascending: true });
      const productList = data ?? [];
      setProducts(productList);

      if (isEdit) {
        // 기존 글 불러오기
        const { data: post } = await supabase
          .from("posts")
          .select("*")
          .eq("id", editId)
          .single();
        if (post) {
          setCategory(post.category);
          setProductId(post.product_id || "");
          setSketchupVersion(post.sketchup_version || "");
          setAutocadVersion(post.autocad_version || "");
          setTitle(post.title);
          setDescription(post.description);
          if (post.image_url) {
            setExistingImageUrl(post.image_url);
            setImagePreview(post.image_url);
          }
        }
      } else {
        // 신규 — URL 파라미터로 product/category 자동 선택
        const productSlug = searchParams.get("product");
        if (productSlug) {
          const match = productList.find((p: { slug?: string }) => p.slug === productSlug);
          if (match) setProductId(match.id);
        }
        const cat = searchParams.get("category");
        if (cat === "idea" || cat === "bug") setCategory(cat);
      }
      setPageLoading(false);
    };
    load();
  }, [router, supabase, searchParams, editId, isEdit]);

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
    if (!title.trim() || !description.trim()) {
      setError("Please fill in both title and description.");
      return;
    }
    setLoading(true);
    setError("");

    // 이미지 처리
    let imageUrl: string | null = existingImageUrl;

    if (removeImage) {
      imageUrl = null;
    }

    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `openlab/${userId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("uploads")
        .upload(path, imageFile, { upsert: true });
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
        imageUrl = publicUrl;
      }
    }

    if (isEdit) {
      // 수정
      const { error: updateErr } = await supabase
        .from("posts")
        .update({
          category,
          product_id: productId || null,
          sketchup_version: sketchupVersion || null,
          autocad_version: autocadVersion || null,
          title: title.trim(),
          description: description.trim(),
          image_url: imageUrl,
        })
        .eq("id", editId);

      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }
      router.push(`/openlab/${editId}`);
    } else {
      // 신규
      const { data: post, error: insertErr } = await supabase
        .from("posts")
        .insert({
          user_id: userId,
          product_id: productId || null,
          sketchup_version: sketchupVersion || null,
          autocad_version: autocadVersion || null,
          category,
          title: title.trim(),
          description: description.trim(),
          image_url: imageUrl,
        })
        .select()
        .single();

      if (insertErr) {
        setError(insertErr.message);
        setLoading(false);
        return;
      }
      router.push(`/openlab/${post.id}`);
    }
  };

  if (pageLoading) {
    return <div className="pt-20 text-center text-[14px] text-[#999]">Loading...</div>;
  }

  return (
    <div className="pt-10">
      <Link href="/openlab" className="flex items-center gap-1.5 text-[12px] text-[#999] no-underline hover:underline mb-6">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#999" strokeWidth="1.2"/></svg>
        Open Lab
      </Link>

      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">
        {isEdit ? "Edit Post" : "New Post"}
      </h1>
      <div className="border-t border-[#111] mb-8" />

      {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Category */}
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-2 tracking-[0.05em] uppercase">Category</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCategory("idea")}
              className={`text-[13px] px-4 py-2 border cursor-pointer transition-colors ${category === "idea" ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#666] border-[#ddd] hover:border-[#111]"}`}>
              Idea
            </button>
            <button type="button" onClick={() => setCategory("bug")}
              className={`text-[13px] px-4 py-2 border cursor-pointer transition-colors ${category === "bug" ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#666] border-[#ddd] hover:border-[#111]"}`}>
              Question / Bug
            </button>
            {isAdmin && (
              <button type="button" onClick={() => setCategory("notice")}
                className={`text-[13px] px-4 py-2 border cursor-pointer transition-colors ${category === "notice" ? "bg-[#00c9a7] text-white border-[#00c9a7]" : "bg-white text-[#666] border-[#ddd] hover:border-[#00c9a7]"}`}>
                Notice
              </button>
            )}
          </div>
        </div>

        {/* Product */}
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Related Extension (optional)</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors bg-white">
            <option value="">None</option>
            {(["sketchup", "autocad"] as const).map((plat) => {
              const items = products.filter((p) => p.platform === plat);
              if (items.length === 0) return null;
              const label = plat === "sketchup" ? "SketchUp" : "AutoCAD";
              return (
                <optgroup key={plat} label={label}>
                  {items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              );
            })}
            {(() => {
              const others = products.filter((p) => p.platform !== "sketchup" && p.platform !== "autocad");
              if (others.length === 0) return null;
              return (
                <optgroup label="Other">
                  {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              );
            })()}
          </select>
        </div>

        {/* Program Versions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">SketchUp Version</label>
            <select value={sketchupVersion} onChange={(e) => setSketchupVersion(e.target.value)}
              className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors bg-white">
              <option value="">Not used</option>
              {SKETCHUP_VERSIONS.map((v) => <option key={v} value={v}>SketchUp {v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">AutoCAD Version</label>
            <select value={autocadVersion} onChange={(e) => setAutocadVersion(e.target.value)}
              className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors bg-white">
              <option value="">Not used</option>
              <optgroup label="AutoCAD">
                {AUTOCAD_YEARS.map((v) => <option key={v} value={v}>AutoCAD {v}</option>)}
              </optgroup>
              <optgroup label="AutoCAD LT">
                {AUTOCAD_YEARS.map((v) => <option key={`lt-${v}`} value={`LT ${v}`}>AutoCAD LT {v}</option>)}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief summary" required
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe in detail..." required rows={8}
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors resize-y font-[inherit]" />
        </div>

        {/* Attachment */}
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">Attachment (optional)</label>
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
            onClick={() => document.getElementById("file-input")?.click()}
            className="border border-dashed border-[#ddd] py-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#999] transition-colors"
          >
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="max-w-[300px] max-h-[200px] object-contain" />
                <button type="button" onClick={(e) => { e.stopPropagation(); clearImage(); }}
                  className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-[#111] text-white text-[11px] border-0 cursor-pointer">
                  ×
                </button>
              </div>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="1" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <p className="text-[13px] text-[#999] mt-2">Drop an image here or click to upload</p>
              </>
            )}
          </div>
          <input id="file-input" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        </div>

        {/* Submit */}
        <div className="flex gap-3 mt-2 justify-end">
          <Link href={isEdit ? `/openlab/${editId}` : "/openlab"}
            className="text-[#111] text-[13px] font-bold px-6 py-3 border border-[#ddd] no-underline hover:bg-[#f5f5f5] transition-colors flex items-center">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="bg-[#111] text-white text-[13px] font-bold px-6 py-3 border-0 cursor-pointer hover:bg-[#333] transition-colors disabled:opacity-40">
            {loading ? "Saving..." : isEdit ? "Save" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
