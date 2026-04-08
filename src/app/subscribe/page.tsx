import { getProducts } from "@/lib/products";
import { formatPrice } from "@/lib/types";
import SubscribeContent from "./SubscribeContent";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const allProducts = await getProducts();
  const extensions = allProducts.filter((p) => p.type === "extension");
  const totalPrice = extensions.reduce((sum, p) => sum + p.price, 0);

  return <SubscribeContent extensions={extensions} totalPrice={totalPrice} />;
}
