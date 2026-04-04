import { getProducts } from "@/lib/products";
import ExtensionsList from "./ExtensionsList";

export default async function ExtensionsPage() {
  const allProducts = await getProducts();
  const extensions = allProducts.filter((p) => p.type === "extension");

  return <ExtensionsList products={extensions} />;
}
