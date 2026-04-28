import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/products";

const BASE = "https://iiiahalab.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  const active = products.filter((p) => p.is_active);

  const productEntries: MetadataRoute.Sitemap = active.map((p) => ({
    url:
      p.type === "course"
        ? `${BASE}/courses/${p.slug}`
        : `${BASE}/extensions/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/extensions`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/courses`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/subscribe`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/openlab`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [...staticEntries, ...productEntries];
}
