"use client";

import { useState } from "react";
import { resetPassword } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "요청에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[360px] mx-auto pt-20">
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-8">
        Reset Password
      </h1>
      <div className="border-t border-[#111] mb-8" />

      {sent ? (
        <>
          <p className="text-[14px] text-[#111] mb-3">
            비밀번호 재설정 메일을 발송했습니다.
          </p>
          <p className="text-[13px] text-[#666] leading-[1.7]">
            {email}로 전송된 링크를 클릭하여 새 비밀번호를 설정해 주세요.
            메일이 보이지 않으면 스팸함을 확인해 주세요.
          </p>
          <a
            href="/login"
            className="inline-block text-[13px] text-[#111] underline mt-6"
          >
            로그인으로 돌아가기
          </a>
        </>
      ) : (
        <>
          <p className="text-[13px] text-[#666] mb-6">
            가입 시 사용한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.
          </p>
          {error && (
            <p className="text-[13px] text-red-600 mb-4">{error}</p>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[12px] text-[#666] font-bold mb-1 tracking-[0.05em] uppercase">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-[#ddd] px-3 py-2.5 text-[14px] outline-none focus:border-[#111] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-[#111] text-white text-[13px] font-bold tracking-[0.05em] py-3 border-0 cursor-pointer hover:bg-[#333] transition-colors duration-200 disabled:opacity-40"
            >
              {loading ? "..." : "Send reset link"}
            </button>
          </form>
          <a
            href="/login"
            className="inline-block text-[13px] text-[#999] mt-6 hover:underline"
          >
            로그인으로 돌아가기
          </a>
        </>
      )}
    </div>
  );
}
