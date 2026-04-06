import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart";

export const metadata: Metadata = {
  title: "iiiaha.lab",
  description: "SketchUp Extensions & Courses by iiiaha",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <Header />
          <main className="flex-1 w-full max-w-[800px] mx-auto px-10 py-8 max-sm:px-5">
            {children}
          </main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
