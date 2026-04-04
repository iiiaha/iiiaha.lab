"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, signOut } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

const CONFIRM_TEXT = "delete my account";

export default function DeleteAccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [productCount, setProductCount] = useState(0);
  const [courseCount, setCourseCount] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? "");

      const supabase = createClient();

      // 구매한 익스텐션 수
      const { data: extOrders } = await supabase
        .from("orders")
        .select("id, products(type)")
        .eq("user_id", user.id)
        .eq("status", "paid");

      const extensions =
        extOrders?.filter(
          (o) => (o.products as unknown as { type: string })?.type === "extension"
        ).length ?? 0;
      const courses =
        extOrders?.filter(
          (o) => (o.products as unknown as { type: string })?.type === "course"
        ).length ?? 0;

      setProductCount(extensions);
      setCourseCount(courses);
      setPageLoading(false);
    };
    load();
  }, [router]);

  const handleDelete = async () => {
    if (input !== CONFIRM_TEXT) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      await signOut();
      router.push("/");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to delete account");
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="pt-20 text-center text-[14px] text-[#999]">
        Loading...
      </div>
    );
  }

  return (
    <div className="pt-10">
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">
        Delete Account
      </h1>
      <div className="border-t border-[#111] mb-8" />

      {/* Warning */}
      <div className="border border-red-200 bg-red-50 p-5 mb-8">
        <p className="text-[14px] font-bold text-red-600 mb-2">
          This action is permanent and cannot be undone.
        </p>
        <p className="text-[12px] text-red-500">
          이 작업은 영구적이며 되돌릴 수 없습니다.
        </p>
        <p className="text-[13px] text-[#666] leading-relaxed mt-3">
          Once you delete your account, all of your data will be permanently
          removed. This includes:
        </p>
        <p className="text-[12px] text-[#999]">
          계정을 삭제하면 모든 데이터가 영구적으로 제거됩니다. 여기에는 다음이 포함됩니다:
        </p>
      </div>

      {/* What will be lost */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex items-start gap-2">
          <span className="text-[13px] text-red-500 mt-px">×</span>
          <div>
            <p className="text-[13px] font-bold">
              {productCount} extension license{productCount !== 1 ? "s" : ""}
            </p>
            <p className="text-[12px] text-[#999]">
              All purchased extension licenses and download access will be permanently revoked.
            </p>
            <p className="text-[12px] text-[#bbb]">
              구매한 모든 익스텐션 라이선스와 다운로드 권한이 영구적으로 취소됩니다.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[13px] text-red-500 mt-px">×</span>
          <div>
            <p className="text-[13px] font-bold">
              {courseCount} course{courseCount !== 1 ? "s" : ""}
            </p>
            <p className="text-[12px] text-[#999]">
              All purchased courses, progress, and viewing access will be permanently removed.
            </p>
            <p className="text-[12px] text-[#bbb]">
              구매한 모든 강의, 시청 진도, 열람 권한이 영구적으로 삭제됩니다.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[13px] text-red-500 mt-px">×</span>
          <div>
            <p className="text-[13px] font-bold">Account data</p>
            <p className="text-[12px] text-[#999]">
              Your email ({email}), order history, and all associated data will be deleted.
            </p>
            <p className="text-[12px] text-[#bbb]">
              이메일({email}), 주문 내역 및 모든 관련 데이터가 삭제됩니다.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[13px] text-red-500 mt-px">×</span>
          <div>
            <p className="text-[13px] font-bold">No refunds</p>
            <p className="text-[12px] text-[#999]">
              Deleting your account does not entitle you to a refund for any purchases.
            </p>
            <p className="text-[12px] text-[#bbb]">
              계정 삭제 시 기존 구매에 대한 환불은 제공되지 않습니다.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-[#ddd] mb-8" />

      {/* Confirmation input */}
      <div className="mb-6">
        <p className="text-[13px] text-[#666] mb-3">
          To confirm, type{" "}
          <code className="bg-[#f5f5f5] px-1.5 py-0.5 text-[12px] font-bold">
            {CONFIRM_TEXT}
          </code>{" "}
          below:
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={CONFIRM_TEXT}
          className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-red-400 transition-colors"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDelete}
          disabled={input !== CONFIRM_TEXT || loading}
          className="bg-red-600 text-white text-[13px] font-bold px-6 py-3 border-0 cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-30 disabled:cursor-default"
        >
          {loading ? "Deleting..." : "Permanently delete account"}
        </button>
        <button
          onClick={() => router.push("/mypage")}
          className="bg-white text-[#111] text-[13px] font-bold px-6 py-3 border border-[#ddd] cursor-pointer hover:bg-[#f5f5f5] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
