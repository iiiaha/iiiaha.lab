"use client";

import { useState } from "react";
import { signUp, signInWithGoogle } from "@/lib/auth";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-[360px] mx-auto pt-20 text-center">
        <h1 className="text-[16px] font-bold tracking-[0.03em] mb-[10px]">
          Check your email
        </h1>
        <div className="border-b border-[#111] mb-8" />
        <p className="text-[14px] text-[#666] mb-2">
          확인 링크를 보내드렸습니다
        </p>
        <p className="text-[14px] font-bold mb-6">{email}</p>
        <p className="text-[13px] text-[#999] leading-[1.7]">
          이메일의 링크를 눌러 계정을 활성화한 뒤 다시 로그인해 주세요.
        </p>
        <a
          href="/login"
          className="inline-block mt-8 text-[13px] text-[#111] border border-[#111] px-6 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors"
        >
          로그인으로
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-[360px] mx-auto pt-20">
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-[10px]">
        Sign up
      </h1>
      <div className="border-b border-[#111] mb-8" />
      <button
        onClick={() => signInWithGoogle()}
        className="w-full flex items-center justify-center gap-2 border border-[#ddd] bg-white text-[13px] font-bold tracking-[0.03em] py-3 cursor-pointer hover:bg-[#f5f5f5] transition-colors duration-200 mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#333" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#555" />
          <path d="M5.84 14.09a7.12 7.12 0 0 1 0-4.17V7.07H2.18A11.97 11.97 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77.01-.54z" fill="#777" />
          <path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.19 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.07l3.66 2.84c.87-2.6 3.3-4.16 6.16-4.16z" fill="#999" />
        </svg>
        Google로 계속하기
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 border-b border-[#ddd]" />
        <span className="text-[11px] text-[#999]">또는</span>
        <div className="flex-1 border-b border-[#ddd]" />
      </div>
      {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">
            이메일
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors"
          />
        </div>
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">
            비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors"
          />
        </div>
        <div>
          <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">
            비밀번호 확인
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-5 bg-[#111] text-white text-[13px] font-bold tracking-[0.05em] py-3 border-0 cursor-pointer hover:bg-[#333] transition-colors duration-200 disabled:opacity-40"
        >
          {loading ? "..." : "회원가입"}
        </button>
      </form>
      <p className="text-[13px] text-[#999] mt-4">
        이미 계정이 있으신가요?{" "}
        <a href="/login" className="text-[#111] underline">
          로그인
        </a>
      </p>
    </div>
  );
}
