"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Product } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("type", "course")
        .order("created_at", { ascending: true });
      setCourses(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div>
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-1">Courses</h1>
      <div className="border-b border-[#111] mb-4" />
      <div className="min-h-[32px] mb-6" />
      {loading ? (
        <p className="text-[14px] text-[#999]">Loading...</p>
      ) : courses.length === 0 ? (
        <p className="text-[14px] text-[#999]">Coming soon.</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-8 gap-y-10 max-md:grid-cols-2 max-sm:grid-cols-1">
          {courses.map((course) => (
            <ProductCard
              key={course.slug}
              product={course}
            />
          ))}
        </div>
      )}
    </div>
  );
}
