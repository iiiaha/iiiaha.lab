"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, onAuthStateChange } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export default function Header() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [admin, setAdmin] = useState(false);

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
        <div className="flex items-center justify-between py-8">
          <Link href="/" className="no-underline hover:no-underline">
            <img src="/profile.png" alt="" className="w-[80px] h-[80px] rounded-full object-cover" />
          </Link>
          <nav className="flex gap-5">
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
          </nav>
        </div>
        <div className="border-b border-[#111]" />
      </div>
    </header>
  );
}
