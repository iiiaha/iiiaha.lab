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
    { href: "/community", label: "Community" },
    loggedIn
      ? { href: "/mypage", label: "My Page" }
      : { href: "/login", label: "Login" },
    ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-white">
      <div className="max-w-[800px] mx-auto px-10 max-sm:px-5">
        <div className="flex items-baseline justify-between py-5">
          <Link href="/" className="flex items-center gap-2.5 no-underline hover:no-underline">
            <img src="/profile.png" alt="" className="w-9 h-9 rounded-full object-cover" />
            <span className="text-[18px] font-bold tracking-[0.05em]">iiiaha.lab</span>
          </Link>
          <nav className="flex gap-8">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-[13px] tracking-[0.1em] no-underline hover:underline ${
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
