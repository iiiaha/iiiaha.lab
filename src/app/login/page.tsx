"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    params.get("error") === "signup_disabled"
      ? "현재 신규 가입을 받지 않고 있습니다. 정식 오픈 후 다시 이용해 주세요."
      : ""
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/mypage");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[360px] mx-auto pt-20">
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-8">
        Login
      </h1>
      <div className="border-t border-[#111] mb-8" />
      {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">
            이메일
          </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors" />
        </div>
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">
            비밀번호
          </label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors" />
        </div>
        <button type="submit" disabled={loading} className="mt-2 bg-[#111] text-white text-[13px] font-bold tracking-[0.05em] py-3 border-0 cursor-pointer hover:bg-[#333] transition-colors duration-200 disabled:opacity-40">
          {loading ? "..." : "로그인"}
        </button>
      </form>
      <p className="text-[13px] text-[#999] mt-4">
        <a href="/forgot-password" className="text-[#999] underline hover:text-[#111] transition-colors">
          비밀번호를 잊으셨나요?
        </a>
      </p>
      <p className="text-[13px] text-[#999] mt-2">
        아직 계정이 없으신가요?{" "}
        <a href="/signup" className="text-[#111] underline">
          회원가입
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-[14px] text-[#999]">...</div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
