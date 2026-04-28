"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface Coupon {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_amount: number | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function AdminCoupons() {
  const supabase = createClient();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // 새 쿠폰 폼
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    setCoupons((data as Coupon[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const create = async () => {
    if (!code.trim() || !discountValue) return;

    const { error } = await supabase.from("coupons").insert({
      code: code.toUpperCase().trim(),
      discount_type: discountType,
      discount_value: Number(discountValue),
      min_amount: minAmount ? Number(minAmount) : null,
      max_uses: maxUses ? Number(maxUses) : null,
      expires_at: expiresAt || null,
    });

    if (error) {
      showMsg(`오류: ${error.message}`);
      return;
    }

    setShowForm(false);
    setCode("");
    setDiscountValue("");
    setMinAmount("");
    setMaxUses("");
    setExpiresAt("");
    showMsg("쿠폰 생성 완료");
    load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("coupons").update({ is_active: !active }).eq("id", id);
    showMsg(active ? "비활성화됨" : "활성화됨");
    load();
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("이 쿠폰을 삭제하시겠습니까?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    showMsg("삭제 완료");
    load();
  };

  if (loading) return <p className="text-[14px] text-[#999]">로딩 중...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold">쿠폰 관리</h1>
          {message && <span className="text-[11px] text-green-600">{message}</span>}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[12px] border border-[#111] bg-transparent px-3 py-1 cursor-pointer hover:bg-[#111] hover:text-white transition-colors"
        >
          {showForm ? "취소" : "새 쿠폰"}
        </button>
      </div>

      {/* 생성 폼 */}
      {showForm && (
        <div className="border border-[#ddd] p-4 mb-6">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[11px] text-[#999] block mb-1">코드</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="WELCOME10"
                className="w-full border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#999] block mb-1">할인 유형</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
                className="w-full border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              >
                <option value="percent">% 할인</option>
                <option value="fixed">원 할인</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#999] block mb-1">
                할인 값 {discountType === "percent" ? "(%)" : "(₩)"}
              </label>
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percent" ? "10" : "5000"}
                className="w-full border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#999] block mb-1">최소 금액 (선택)</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="10000"
                className="w-full border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#999] block mb-1">최대 사용 횟수 (선택)</label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="100"
                className="w-full border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#999] block mb-1">만료일 (선택)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full border border-[#ddd] px-2 py-1.5 text-[13px] outline-none focus:border-[#111]"
              />
            </div>
          </div>
          <button
            onClick={create}
            className="text-[12px] bg-[#111] text-white border-0 px-4 py-1.5 cursor-pointer hover:bg-[#333]"
          >
            생성
          </button>
        </div>
      )}

      {/* 목록 */}
      <div className="border-t border-[#ddd]">
        {coupons.length === 0 ? (
          <p className="text-[13px] text-[#999] py-4">쿠폰 없음</p>
        ) : (
          coupons.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-[#ddd] py-2.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <code className="text-[13px] font-bold">{c.code}</code>
                  <span className={`text-[10px] font-bold ${c.is_active ? "text-green-600" : "text-[#999]"}`}>
                    {c.is_active ? "활성" : "비활성"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#999]">
                  <span>
                    {c.discount_type === "percent" ? `${c.discount_value}%` : `₩${c.discount_value.toLocaleString()}`} 할인
                  </span>
                  {c.min_amount && <span>최소 ₩{c.min_amount.toLocaleString()}</span>}
                  <span>사용 {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}회</span>
                  {c.expires_at && <span>~{new Date(c.expires_at).toLocaleDateString("ko-KR")}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => toggleActive(c.id, c.is_active)}
                  className={`text-[10px] bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer ${
                    c.is_active ? "text-[#999] hover:bg-[#f5f5f5]" : "text-green-600 hover:bg-green-50"
                  }`}
                >
                  {c.is_active ? "비활성화" : "활성화"}
                </button>
                <button
                  onClick={() => deleteCoupon(c.id)}
                  className="text-[10px] text-red-600 bg-transparent border border-[#ddd] px-2 py-0.5 cursor-pointer hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
