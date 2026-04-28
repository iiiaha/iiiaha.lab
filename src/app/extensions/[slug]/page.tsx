import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import ExtensionDetail from "./ExtensionDetail";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not Found" };

  const title = product.name;
  const description =
    product.description?.slice(0, 160) ?? `${product.name} — iiiaha.lab 익스텐션`;
  const image = product.thumbnail_url ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://iiiahalab.com/extensions/${slug}`,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    alternates: { canonical: `https://iiiahalab.com/extensions/${slug}` },
  };
}

export default async function ExtensionDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  return <ExtensionDetail product={product} />;
}
