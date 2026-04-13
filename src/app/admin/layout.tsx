"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { getUser } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "대시보드", icon: "~" },
  { href: "/admin/products", label: "제품 관리", icon: "P" },
  { href: "/admin/orders", label: "주문 관리", icon: "O" },
  { href: "/admin/users", label: "사용자 · 라이선스", icon: "U" },
  { href: "/admin/courses", label: "강의 관리", icon: "C" },
  { href: "/admin/openlab", label: "오픈랩", icon: "!" },
  { href: "/admin/coupons", label: "쿠폰", icon: "%" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const user = await getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const admin = await isAdmin();
      if (!admin) {
        router.push("/");
        return;
      }
      setAuthorized(true);
      setLoading(false);
    };
    check();
  }, [router]);

  // 관리자 페이지에서는 상단 헤더 메뉴 숨김
  useEffect(() => {
    const header = document.querySelector("header");
    if (header) header.style.display = "none";
    return () => {
      if (header) header.style.display = "";
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-[14px] text-[#999]">
        Loading...
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex gap-0 min-h-[70vh] -mx-10 -my-8 max-sm:-mx-5">
      {/* Sidebar */}
      <aside className="w-[200px] shrink-0 border-r border-[#ddd] py-8 px-6">
        <h2 className="text-[13px] font-bold tracking-[0.05em] mb-6">관리자</h2>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon }) => {
            const active =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 text-[13px] no-underline hover:bg-[#f5f5f5] transition-colors ${
                  active ? "font-bold bg-[#f5f5f5]" : "text-[#666]"
                }`}
              >
                <span className="w-4 text-center text-[11px] text-[#999]">
                  {icon}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 pt-4 border-t border-[#ddd]">
          <Link
            href="/"
            className="text-[12px] text-[#999] no-underline hover:underline"
          >
            사이트로 돌아가기
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 py-8 px-8 overflow-auto">{children}</main>
    </div>
  );
}
