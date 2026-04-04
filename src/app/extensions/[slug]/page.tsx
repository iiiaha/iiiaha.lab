import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import ExtensionDetail from "./ExtensionDetail";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ExtensionDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  return <ExtensionDetail product={product} />;
}
