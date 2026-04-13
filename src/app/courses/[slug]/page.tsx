"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Product, formatPrice } from "@/lib/types";
import { getUser } from "@/lib/auth";
import EpisodeList from "./EpisodeList";
import PurchaseInfo from "@/components/PurchaseInfo";

interface Episode {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  sort_order: number;
  is_preview: boolean;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const { data: p } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .single();

      if (!p) {
        router.push("/courses");
        return;
      }
      setProduct(p);

      const { data: eps } = await supabase
        .from("course_episodes")
        .select("id, title, description, duration, sort_order, is_preview")
        .eq("product_id", p.id)
        .order("sort_order", { ascending: true });
      setEpisodes(eps ?? []);

      const user = await getUser();
      if (user) {
        const { data: order } = await supabase
          .from("orders")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", p.id)
          .eq("status", "paid")
          .single();
        setPurchased(!!order);
      }

      setLoading(false);
    };
    load();
  }, [slug, router]);

  if (loading || !product) {
    return <div className="pt-20 text-center text-[14px] text-[#999]">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <Link href="/courses" className="flex items-center gap-1.5 text-[16px] font-bold tracking-[0.03em] no-underline hover:underline">
          Courses
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#111" strokeWidth="1.5"/></svg>
        </Link>
      </div>
      <div className="border-b border-[#111] mb-[72px] sticky-divider" />

      <div className="aspect-video bg-[#f5f5f5] border border-[#ddd] mb-5 flex items-center justify-center text-[#999]">
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt={product.name} className="max-h-full max-w-full object-contain" />
        ) : (
          product.name
        )}
      </div>

      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-2">{product.name}</h1>
      <p className="text-[14px] text-[#666] mb-8">{product.description}</p>

      <h2 className="text-[12px] font-bold text-[#999] tracking-[0.05em] uppercase mb-4">
        Episodes ({episodes.length})
      </h2>

      <EpisodeList episodes={episodes} purchased={purchased} courseSlug={slug} productId={product.id} />

      <PurchaseInfo variant="course" />

      {!purchased && (
        <div className="mt-6">
          <button className="w-full bg-[#111] text-white text-[14px] font-bold tracking-[0.05em] py-4 border-0 cursor-pointer hover:bg-[#333] transition-colors duration-200">
            Purchase &mdash; {formatPrice(product.price)}
          </button>
        </div>
      )}
    </div>
  );
}
