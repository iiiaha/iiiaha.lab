"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-[22px] font-bold tracking-[0.05em] mb-3">
        문제가 발생했습니다
      </h1>
      <p className="text-[14px] text-[#666] tracking-[0.03em] mb-2">
        잠시 후 다시 시도해 주세요.
      </p>
      {error.digest && (
        <p className="text-[11px] text-[#999] tracking-[0.03em] mb-8">
          오류 ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="text-[13px] text-[#111] underline tracking-[0.03em] bg-transparent border-0 cursor-pointer"
      >
        다시 시도
      </button>
    </div>
  );
}
