import type { Metadata } from "next";
import { getProducts } from "@/lib/products";
import SubscribeContent from "./SubscribeContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Membership",
  description: "iiiaha.lab 멤버십 — 모든 익스텐션을 한 번에.",
  alternates: { canonical: "https://iiiahalab.com/subscribe" },
};

export default async function SubscribePage() {
  const allProducts = await getProducts();
  const extensions = allProducts.filter((p) => p.type === "extension");
  // 정상가(original_price) 기준으로 합계. 디버깅 할인이 적용되지 않은 금액.
  const totalPrice = extensions.reduce(
    (sum, p) => sum + (p.original_price ?? p.price),
    0
  );

  return <SubscribeContent extensions={extensions} totalPrice={totalPrice} />;
}
