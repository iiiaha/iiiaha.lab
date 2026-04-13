"use client";

import { usePathname } from "next/navigation";

export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  return (
    <main
      className={
        isAdmin
          ? "flex-1 w-full"
          : "flex-1 w-full max-w-[800px] mx-auto px-10 py-8 max-sm:px-5"
      }
    >
      {children}
    </main>
  );
}
