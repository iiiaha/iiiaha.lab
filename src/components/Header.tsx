"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, onAuthStateChange } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { useCart } from "@/lib/cart";

export default function Header() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { count: cartCount } = useCart();

  useEffect(() => {
    getUser().then(async (u) => {
      setLoggedIn(!!u);
      if (u) setAdmin(await isAdmin());
    });
    const { data } = onAuthStateChange(async (user) => {
      setLoggedIn(!!user);
      if (user) setAdmin(await isAdmin());
      else setAdmin(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // 페이지 이동 시 메뉴 닫기
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { href: "/extensions", label: "Extensions" },
    { href: "/courses", label: "Courses" },
    { href: "/systems", label: "Systems" },
    { href: "/community", label: "Community" },
    loggedIn
      ? { href: "/mypage", label: "My Page" }
      : { href: "/login", label: "Login" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white">
      <div className="max-w-[800px] mx-auto px-10 max-sm:px-5">
        <div className="flex items-center justify-between py-8 max-md:py-5">
          <Link href="/" className="no-underline hover:no-underline shrink-0">
            <img src="/profile.png" alt="" className="w-[80px] h-[80px] max-md:w-[50px] max-md:h-[50px] rounded-full object-cover" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-5 items-center">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-[12px] tracking-[0.02em] no-underline hover:underline ${
                  pathname.startsWith(href) ? "font-bold" : ""
                }`}
              >
                {label}
              </Link>
            ))}
            <Link href="/cart" className="relative no-underline hover:no-underline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-[#111] text-white text-[9px] font-bold w-[14px] h-[14px] rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden bg-transparent border-0 cursor-pointer p-1"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#111" strokeWidth="1.5">
              {menuOpen ? (
                <>
                  <path d="M4 4L16 16" />
                  <path d="M16 4L4 16" />
                </>
              ) : (
                <>
                  <path d="M2 5H18" />
                  <path d="M2 10H18" />
                  <path d="M2 15H18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <nav className="md:hidden flex flex-col border-t border-[#eee] pb-4">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`py-2.5 text-[13px] no-underline hover:underline ${
                  pathname.startsWith(href) ? "font-bold" : "text-[#666]"
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/cart"
              className={`py-2.5 text-[13px] no-underline hover:underline ${
                pathname === "/cart" ? "font-bold" : "text-[#666]"
              }`}
            >
              Cart{cartCount > 0 ? ` (${cartCount})` : ""}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
