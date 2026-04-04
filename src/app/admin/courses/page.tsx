"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface CourseProduct {
  id: string;
  slug: string;
  display_name: string;
  price: number;
  episode_count?: number;
}

export default function AdminCourses() {
  const supabase = createClient();
  const [courses, setCourses] = useState<CourseProduct[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: products } = await supabase
        .from("products")
        .select("id, slug, display_name, price")
        .eq("type", "course")
        .order("created_at", { ascending: true });

      if (!products) {
        setCourses([]);
        return;
      }

      // 에피소드 수 조회
      const withCounts = await Promise.all(
        products.map(async (p) => {
          const { count } = await supabase
            .from("course_episodes")
            .select("id", { count: "exact", head: true })
            .eq("product_id", p.id);
          return { ...p, episode_count: count ?? 0 };
        })
      );

      setCourses(withCounts);
    };
    load();
  }, []);

  return (
    <div>
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">
        Courses
      </h1>
      <div className="border-t border-[#111] mb-6" />

      <p className="text-[12px] text-[#999] mb-6">
        Courses are products with type &quot;course&quot;. Create them in Products first, then manage episodes here.
      </p>

      <div className="border-t border-[#ddd]">
        {courses.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">
            No courses. Add a product with type &quot;course&quot; first.
          </p>
        ) : (
          courses.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between border-b border-[#ddd] py-3"
            >
              <div>
                <span className="text-[13px] font-bold">{c.display_name}</span>
                <span className="text-[11px] text-[#999] ml-2">
                  {c.episode_count} episodes
                </span>
              </div>
              <Link
                href={`/admin/courses/${c.id}`}
                className="text-[11px] text-[#111] border border-[#ddd] px-3 py-1 no-underline hover:bg-[#f5f5f5]"
              >
                Manage Episodes
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
