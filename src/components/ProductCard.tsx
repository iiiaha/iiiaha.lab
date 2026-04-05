import Link from "next/link";
import { Product, formatPrice } from "@/lib/types";

export default function ProductCard({ product }: { product: Product }) {
  const href =
    product.type === "extension"
      ? `/extensions/${product.slug}`
      : `/courses/${product.slug}`;

  return (
    <Link href={href} className="group no-underline">
      <div className="aspect-square bg-[#f5f5f5] border border-[#ddd] mb-3 overflow-hidden flex items-center justify-center p-[20%]">
        {product.thumbnail_url ? (
          <img
            src={product.thumbnail_url}
            alt={product.display_name}
            className="w-full h-full object-contain group-hover:opacity-85 transition-opacity duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#999] text-[13px]">
            {product.display_name}
          </div>
        )}
      </div>
      <h3 className="text-[14px] font-bold group-hover:underline">
        {product.display_name}
      </h3>
      <div className="flex items-center gap-1.5 mt-0.5">
        {(product.discount_percent ?? 0) > 0 && product.original_price ? (
          <>
            <span className="text-[12px] text-[#ccc] line-through">{formatPrice(product.original_price)}</span>
            <span className="text-[13px] font-bold text-red-600">{formatPrice(product.price)}</span>
          </>
        ) : (
          <span className="text-[13px] text-[#666]">{formatPrice(product.price)}</span>
        )}
      </div>
    </Link>
  );
}
