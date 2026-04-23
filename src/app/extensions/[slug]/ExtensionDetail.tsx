"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Product, formatPrice } from "@/lib/types";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { renderInline } from "@/lib/markdown";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import PurchaseInfo from "@/components/PurchaseInfo";

type OwnershipState =
  | "loading"
  | "not_logged_in"
  | "purchased"           // 영구구매
  | "membership_owned"    // 멤버십으로 get 완료
  | "membership_available" // 멤버십 있지만 아직 get 안 함
  | "not_owned";          // 비회원 또는 멤버십 없음

export default function ExtensionDetail({ product }: { product: Product }) {
  const [ownership, setOwnership] = useState<OwnershipState>("loading");
  const [added, setAdded] = useState(false);
  const [getting, setGetting] = useState(false);
  const { addItem, items } = useCart();

  useEffect(() => {
    const check = async () => {
      const user = await getUser();
      if (!user) {
        setOwnership("not_logged_in");
        return;
      }
      const supabase = createClient();

      // 영구구매 확인 (subscription_id가 null인 라이선스)
      const { data: permLicense } = await supabase
        .from("licenses")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .is("subscription_id", null)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (permLicense) {
        setOwnership("purchased");
        return;
      }

      // 멤버십 확인
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (subscription) {
        // 멤버십으로 이미 get 했는지 확인
        const { data: memLicense } = await supabase
          .from("licenses")
          .select("id, status")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .not("subscription_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (memLicense && memLicense.status === "active") {
          setOwnership("membership_owned");
        } else {
          setOwnership("membership_available");
        }
        return;
      }

      // 구매 여부 확인 (기존 orders 기반 — 하위 호환)
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .eq("status", "paid")
        .limit(1)
        .maybeSingle();

      if (order) {
        setOwnership("purchased");
        return;
      }

      setOwnership("not_owned");
    };
    check();
  }, [product.id]);

  const handleGet = async () => {
    setGetting(true);
    try {
      const res = await fetch("/api/membership/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_slug: product.slug }),
      });
      if (res.ok) {
        setOwnership("membership_owned");
      }
    } finally {
      setGetting(false);
    }
  };

  const info = [
    { label: "Version", value: product.version },
    { label: "Compatible", value: product.compatibility },
    { label: "Price", value: null },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <Link href="/extensions" className="flex items-center gap-1.5 text-[16px] font-bold tracking-[0.03em] no-underline hover:underline">
          Extensions
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#111" strokeWidth="1.5"/></svg>
        </Link>
      </div>
      <div className="border-b border-[#111] mb-[72px] sticky-divider" />

      {(() => {
        const embed = getYoutubeEmbedUrl(product.youtube_url);
        if (embed) {
          return (
            <div className="aspect-video border border-[#ddd] mb-5 overflow-hidden bg-black">
              <iframe
                src={embed}
                title={`${product.name} — 작동 영상`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
              />
            </div>
          );
        }
        return (
          <div className="aspect-video bg-[#f5f5f5] border border-[#ddd] mb-5 flex items-center justify-center text-[#999]">
            {product.thumbnail_url ? (
              <img
                src={product.thumbnail_url}
                alt={product.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              product.name
            )}
          </div>
        );
      })()}

      <h1 className="text-[15px] font-bold tracking-[0.03em] mb-3">
        {product.name}
      </h1>

      <div className="border-t border-[#ddd]">
        {info.map(
          ({ label, value }) =>
            value && (
              <div key={label} className="flex border-b border-[#ddd] py-1">
                <span className="w-[140px] shrink-0 text-[13px] text-[#666]">
                  {label}
                </span>
                <span className="text-[14px]">{value}</span>
              </div>
            )
        )}
        {/* Price */}
        <div className="flex border-b border-[#ddd] py-1">
          <span className="w-[140px] shrink-0 text-[13px] text-[#666]">Price</span>
          <div className="flex items-center gap-2">
            {(product.discount_percent ?? 0) > 0 && product.original_price ? (
              <>
                <span className="text-[13px] text-[#999] line-through">{formatPrice(product.original_price)}</span>
                <span className="text-[14px] font-bold text-[#111]">{formatPrice(product.price)}</span>
                <span className="text-[11px] text-[#666] font-bold">-{product.discount_percent}%</span>
              </>
            ) : (
              <span className="text-[14px]">{formatPrice(product.price)}</span>
            )}
          </div>
        </div>
        {/* Description — 한국어 우선, 없으면 기존 영문 폴백 */}
        {(() => {
          const body = product.description_ko ?? product.description;
          if (!body) return null;
          return (
            <div className="pt-1.5 pb-4">
              <div className="flex mb-10">
                <span className="w-[140px] shrink-0 text-[13px] text-[#666]">
                  Description
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {body.split("\n").map((line, i) => {
                  const match = line.match(/^[•]\s*(.+?)\s*[—]\s*(.+)$/);
                  if (match) {
                    return (
                      <div key={i} className="flex gap-2">
                        <span className="text-[13px] text-[#ccc] mt-px">•</span>
                        <div>
                          <p className="text-[13px] font-bold text-[#666] mb-0.5">
                            {renderInline(match[1])}
                          </p>
                          <p className="text-[12px] text-[#999]">{renderInline(match[2])}</p>
                        </div>
                      </div>
                    );
                  }
                  return line.trim() ? (
                    <p key={i} className="text-[13px] text-[#666]">
                      {renderInline(line)}
                    </p>
                  ) : null;
                })}
              </div>
            </div>
          );
        })()}
      </div>

      <PurchaseInfo variant="extension" />

      {/* Purchase / Get / Purchased */}
      <div className="mt-6">
        {ownership === "loading" ? (
          <div className="w-full py-4 text-center text-[14px] text-[#999]">
            ...
          </div>
        ) : ownership === "purchased" ? (
          <div className="border border-[#ddd] rounded p-5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold">Purchased</span>
              <a
                href={`/api/download/${product.slug}`}
                className="text-[12px] text-[#111] border border-[#111] px-4 py-1.5 rounded no-underline hover:bg-[#111] hover:text-white transition-colors"
              >
                설치파일 다운받기
              </a>
            </div>
          </div>
        ) : ownership === "membership_owned" ? (
          /* 소유 중 — 같은 gradient 블록을 dim 처리 */
          <div className="sub-cta w-full py-4 rounded overflow-hidden relative opacity-60 transition-opacity">
            <div className="sub-cta-bg absolute inset-0" />
            <div className="sub-cta-aurora absolute inset-0" />
            <div className="relative flex flex-col items-center">
              <span className="text-[14px] font-bold text-white tracking-[0.03em]">
                이미 다운로드한 익스텐션입니다
              </span>
              <span className="text-[10px] text-[rgba(255,255,255,0.6)] mt-0.5">
                <Link href="/mypage" className="underline hover:text-white">마이페이지</Link>에서 확인하세요
              </span>
            </div>
          </div>
        ) : ownership === "membership_available" ? (
          getting ? (
            /* 처리 중 — gradient 블록 dim + 완료 상태로 자연스럽게 이어지는 톤 */
            <div className="sub-cta w-full py-4 rounded overflow-hidden relative opacity-60 transition-opacity">
              <div className="sub-cta-bg absolute inset-0" />
              <div className="sub-cta-aurora absolute inset-0" />
              <div className="relative flex flex-col items-center">
                <span className="text-[14px] font-bold text-white tracking-[0.03em]">
                  내려받는 중...
                </span>
                <span className="text-[10px] text-[rgba(255,255,255,0.6)] mt-0.5">
                  잠시만 기다려 주세요
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGet}
              className="sub-cta w-full border-0 cursor-pointer py-4 rounded overflow-hidden relative"
            >
              <div className="sub-cta-bg absolute inset-0" />
              <div className="sub-cta-aurora absolute inset-0" />
              <div className="relative flex flex-col items-center">
                <span className="text-[14px] font-bold text-white tracking-[0.03em]">
                  이 익스텐션 내려받기
                </span>
                <span className="text-[10px] text-[rgba(255,255,255,0.5)] mt-0.5">
                  iiiahalab membership
                </span>
              </div>
            </button>
          )
        ) : (
          <div className="flex gap-3">
            {/* 개별 구매 */}
            <div className="flex-1 flex flex-col">
              {items.some((i) => i.id === product.id) || added ? (
                <Link
                  href="/cart"
                  className="flex-1 flex flex-col items-center justify-center bg-[#111] text-white text-center no-underline py-3 rounded hover:bg-[#333] active:bg-[#000] transition-colors duration-150"
                >
                  <span className="text-[13px] font-bold tracking-[0.03em]">장바구니에 담았습니다.</span>
                  <span className="text-[10px] text-[rgba(255,255,255,0.5)] mt-0.5">장바구니로 이동하기</span>
                </Link>
              ) : (
                <button
                  onClick={() => {
                    addItem({
                      id: product.id,
                      slug: product.slug,
                      name: product.name,
                      price: product.price,
                      original_price: product.original_price,
                      discount_percent: product.discount_percent,
                      thumbnail_url: product.thumbnail_url,
                    });
                    setAdded(true);
                  }}
                  className="flex-1 flex flex-col items-center justify-center bg-[#111] text-white border-0 cursor-pointer py-3 rounded hover:bg-[#333] active:bg-[#000] transition-colors duration-150"
                >
                  <span className="text-[13px] font-bold tracking-[0.03em]">이 익스텐션 개별 구매하기</span>
                  <span className="text-[10px] text-[rgba(255,255,255,0.5)] mt-0.5">이 익스텐션에 대한 영구 라이선스 획득</span>
                  {(product.discount_percent ?? 0) > 0 && product.original_price ? (
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-[10px] text-[rgba(255,255,255,0.35)] line-through">{formatPrice(product.original_price)}</span>
                      <span className="text-[12px] font-bold text-white">{formatPrice(product.price)}</span>
                    </div>
                  ) : (
                    <span className="text-[12px] font-bold text-white mt-1">{formatPrice(product.price)}</span>
                  )}
                  {(product.discount_percent ?? 0) > 0 && (
                    <span className="text-[9px] text-[rgba(255,255,255,0.4)] mt-0.5">디버깅 기간 내 가격 인하 · ~ 2026.07.31</span>
                  )}
                </button>
              )}
            </div>

            {/* 멤버십 */}
            <div className="flex-1 flex flex-col">
              <Link
                href="/subscribe"
                className="sub-cta flex-1 flex flex-col items-center justify-center no-underline overflow-hidden relative py-3 rounded"
              >
                <div className="sub-cta-bg absolute inset-0" />
                <div className="sub-cta-aurora absolute inset-0" />
                <span className="relative text-[13px] font-bold text-white tracking-[0.03em]">이아하랩 멤버십 가입하기</span>
                <span className="relative text-[10px] text-[rgba(255,255,255,0.5)] mt-0.5">모든 익스텐션 자유롭게 이용</span>
                <div className="relative flex items-baseline gap-1 mt-1">
                  <span className="text-[10px] text-[rgba(255,255,255,0.35)] line-through">₩29,000</span>
                  <span className="text-[12px] font-bold text-white">₩24,900</span>
                  <span className="text-[10px] text-[rgba(255,255,255,0.45)]">/mo</span>
                </div>
                <span className="relative text-[9px] text-[rgba(255,255,255,0.4)] mt-0.5">디버깅 기간 내 가격 인하 · ~ 2026.07.31</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
