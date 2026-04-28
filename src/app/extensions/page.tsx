import type { Metadata } from "next";
import { getProducts } from "@/lib/products";
import ExtensionsList from "./ExtensionsList";

export const metadata: Metadata = {
  title: "Extensions",
  description: "스케치업·오토캐드용 익스텐션 카탈로그.",
  alternates: { canonical: "https://iiiahalab.com/extensions" },
};

export default async function ExtensionsPage() {
  const allProducts = await getProducts();
  const extensions = allProducts.filter((p) => p.type === "extension");

  return <ExtensionsList products={extensions} />;
}
