import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-[22px] font-bold tracking-[0.05em] mb-3">404</h1>
      <p className="text-[14px] text-[#666] tracking-[0.03em] mb-8">
        요청하신 페이지를 찾을 수 없습니다.
      </p>
      <Link
        href="/"
        className="text-[13px] text-[#111] underline tracking-[0.03em]"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
