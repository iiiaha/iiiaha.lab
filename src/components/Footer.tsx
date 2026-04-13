import Link from "next/link";

export default function Footer() {
  return (
    <footer>
      <div className="max-w-[800px] mx-auto px-10 max-sm:px-5">
        <div className="border-t border-[#111]" />
      </div>
      <div className="max-w-[800px] mx-auto px-10 max-sm:px-5 py-8">
        <div className="flex justify-between text-[13px] max-sm:flex-col max-sm:gap-6">
          <div className="flex flex-col gap-1">
            <span className="font-bold tracking-[0.05em]">iiiaha.lab</span>
            <span className="text-[#999]">contact@iiiahalab.com</span>
          </div>
          <div className="flex flex-col gap-1 text-right max-sm:text-left">
            <Link href="https://www.instagram.com/iiiaha.lab/" target="_blank" rel="noopener noreferrer">
              Instagram
            </Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
        <div className="mt-6 text-[11px] text-[#999] leading-[1.8] flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2">
            <span>상호 <span className="text-[#666]">이아하랩</span></span>
            <span className="text-[#ddd]">|</span>
            <span>대표 <span className="text-[#666]">이상훈</span></span>
            <span className="text-[#ddd]">|</span>
            <span>사업자등록번호 <span className="text-[#666]">367-02-03753</span></span>
          </div>
          <div>
            주소 <span className="text-[#666]">서울특별시 강남구 언주로135길 32-8, 103호</span>
          </div>
          <div>
            문의 <span className="text-[#666]">010-4005-7606</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
