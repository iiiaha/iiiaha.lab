export type ProductType = "extension" | "course";
export type Platform = "sketchup" | "autocad";

export interface Product {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  type: ProductType;
  platform?: Platform;
  price: number;
  description: string;
  version?: string;
  compatibility?: string;
  thumbnail_url?: string;
  description_ko?: string;
  sort_order?: number;
}

export function formatPrice(price: number): string {
  return `₩${price.toLocaleString("ko-KR")}`;
}
