import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MainContainer from "@/components/MainContainer";
import { CartProvider } from "@/lib/cart";

export const metadata: Metadata = {
  metadataBase: new URL("https://iiiahalab.com"),
  title: { default: "iiiaha.lab", template: "%s — iiiaha.lab" },
  description:
    "스케치업·오토캐드 익스텐션과 강의를 제공하는 iiiaha.lab. 멤버십으로 모든 익스텐션을 한 번에.",
  applicationName: "iiiaha.lab",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://iiiahalab.com",
    siteName: "iiiaha.lab",
    title: "iiiaha.lab",
    description: "스케치업·오토캐드 익스텐션과 강의",
  },
  twitter: {
    card: "summary_large_image",
    title: "iiiaha.lab",
    description: "스케치업·오토캐드 익스텐션과 강의",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
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
