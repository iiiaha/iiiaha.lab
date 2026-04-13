// 정식 배포 전까지 신규 가입을 임시로 차단.
// 복구: 이 파일을 이전 커밋으로 되돌리면 된다.
export default function SignUpPage() {
  return (
    <div className="max-w-[360px] mx-auto pt-20 text-center">
      <h1 className="text-[16px] font-bold tracking-[0.03em] mb-6">
        Sign up
      </h1>
      <div className="border-t border-[#111] mb-8" />
      <p className="text-[14px] text-[#111] mb-3">
        현재 신규 가입을 받지 않고 있습니다.
      </p>
      <p className="text-[13px] text-[#666] leading-[1.7] mb-8">
        iiiaha.lab은 정식 오픈 전이며, 오픈 시점에 가입을 다시 열 예정입니다.
        <br />
        관련 소식은 아래 채널에서 확인하실 수 있습니다.
      </p>
      <div className="flex flex-col gap-2 items-center">
        <a
          href="https://www.instagram.com/iiiaha.lab/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] text-[#111] border border-[#111] px-6 py-2 no-underline hover:bg-[#111] hover:text-white transition-colors"
        >
          Instagram
        </a>
        <a
          href="/login"
          className="text-[12px] text-[#999] mt-4 no-underline hover:underline"
        >
          이미 가입되어 있다면 로그인
        </a>
      </div>
    </div>
  );
}
