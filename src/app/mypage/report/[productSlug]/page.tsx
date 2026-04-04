"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

export default function ReportBugPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.productSlug as string;
  const supabase = createClient();

  const [productName, setProductName] = useState("");
  const [productId, setProductId] = useState("");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: product } = await supabase
        .from("products")
        .select("id, display_name")
        .eq("slug", slug)
        .single();

      if (!product) { router.push("/mypage"); return; }
      setProductName(product.display_name);
      setProductId(product.id);
      setPageLoading(false);
    };
    load();
  }, [slug, router, supabase]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Please fill in both title and description.");
      return;
    }
    setLoading(true);
    setError("");

    let imageUrl: string | null = null;

    // 이미지 업로드
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `bug-reports/${userId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("public")
        .upload(path, imageFile, { upsert: true });

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage
          .from("public")
          .getPublicUrl(path);
        imageUrl = publicUrl;
      }
    }

    // 버그 리포트 저장
    const { error: insertErr } = await supabase.from("bug_reports").insert({
      user_id: userId,
      product_id: productId,
      title: title.trim(),
      description: description.trim(),
      image_url: imageUrl,
    });

    if (insertErr) {
      setError(insertErr.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (pageLoading) {
    return <div className="pt-20 text-center text-[14px] text-[#999]">Loading...</div>;
  }

  if (sent) {
    return (
      <div className="pt-20 text-center">
        <h1 className="text-[16px] font-bold mb-4">Report submitted</h1>
        <p className="text-[14px] text-[#666] mb-2">
          Thank you for reporting this issue.
        </p>
        <p className="text-[13px] text-[#999] mb-8">
          We will review your report and work on a fix.
        </p>
        <Link
          href="/mypage"
          className="text-[13px] text-[#111] border border-[#111] px-6 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors"
        >
          Back to My Page
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-10">
      <Link href="/mypage" className="text-[12px] text-[#999] hover:underline mb-6 inline-block">
        Back to My Page
      </Link>

      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-2">
        Bug Report
      </h1>
      <p className="text-[13px] text-[#666] mb-6">{productName}</p>
      <div className="border-t border-[#111] mb-8" />

      {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Title */}
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the issue"
            required
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please describe the bug in detail. Include steps to reproduce if possible."
            required
            rows={6}
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors resize-y font-[inherit]"
          />
        </div>

        {/* Screenshot */}
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">
            Screenshot (optional)
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#111]"); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#111]"); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-[#111]");
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith("image/")) {
                setImageFile(file);
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
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-[300px] max-h-[200px] object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-[#111] text-white text-[11px] border-0 cursor-pointer"
                >
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
                <p className="text-[13px] text-[#999] mt-2">
                  Drop an image here or click to upload
                </p>
              </>
            )}
          </div>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 mt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#111] text-white text-[13px] font-bold px-6 py-3 border-0 cursor-pointer hover:bg-[#333] transition-colors disabled:opacity-40"
          >
            {loading ? "Submitting..." : "Submit Report"}
          </button>
          <Link
            href="/mypage"
            className="text-[#111] text-[13px] font-bold px-6 py-3 border border-[#ddd] no-underline hover:bg-[#f5f5f5] transition-colors flex items-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
