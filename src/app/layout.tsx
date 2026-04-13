import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MainContainer from "@/components/MainContainer";
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
          <MainContainer>{children}</MainContainer>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
