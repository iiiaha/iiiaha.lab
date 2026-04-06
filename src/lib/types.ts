export type ProductType = "extension" | "course";
export type Platform = "sketchup" | "autocad";

export interface Product {
  id: string;
  slug: string;
  name: string;
  type: ProductType;
  platform?: Platform;
  price: number;
  description: string;
  version?: string;
  compatibility?: string;
  thumbnail_url?: string;
  description_ko?: string;
  sort_order?: number;
  original_price?: number;
  discount_percent?: number;
  discount_start?: string;
  discount_end?: string;
  subtitle?: string;
  is_active?: boolean;
}

export function formatPrice(price: number): string {
  return `₩${price.toLocaleString("ko-KR")}`;
}
