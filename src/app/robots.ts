import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/mypage/", "/cart", "/billing/", "/payment/"],
      },
    ],
    sitemap: "https://iiiahalab.com/sitemap.xml",
    host: "https://iiiahalab.com",
  };
}
