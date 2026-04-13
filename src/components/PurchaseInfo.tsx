import Link from "next/link";

type Variant = "extension" | "course" | "subscription";

const ROWS: Record<Variant, [string, string][]> = {
  extension: [
    ["제공 형태", "디지털 다운로드 (.rbz 파일)"],
    ["사용 기간", "영구 사용권"],
    ["업데이트", "구매 후 1년 무상 제공"],
    ["기기", "1대 바인딩 · 마이페이지에서 재활성화 가능"],
    ["환불", "라이선스 활성화 전, 구매 후 7일 이내 전액 환불"],
  ],
  course: [
    ["제공 형태", "온라인 스트리밍"],
    ["시청 기간", "서비스 유지 기간 동안 평생"],
    ["기기", "제한 없음 (로그인 기반)"],
    ["환불", "에피소드 재생 전, 구매 후 7일 이내 전액 환불"],
  ],
  subscription: [
    ["제공 형태", "구독 기간 중 모든 활성 익스텐션 이용"],
    ["결제 주기", "월간 또는 연간"],
    ["기기", "익스텐션당 1대 바인딩"],
    ["해지", "마이페이지에서 언제든 가능 · 다음 결제일까지 이용"],
    ["환불", "어떤 익스텐션도 활성화하지 않은 경우 구매 후 7일 이내 환불"],
  ],
};

export default function PurchaseInfo({ variant }: { variant: Variant }) {
  const rows = ROWS[variant];

  return (
    <div className="mt-6 border-t border-[#ddd] pt-4">
      <p className="text-[11px] text-[#999] tracking-[0.1em] uppercase mb-3">
        Purchase Info
      </p>
      <div className="flex flex-col gap-1.5 mb-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex text-[12px] leading-[1.6]">
            <span className="w-[80px] shrink-0 text-[#666]">{label}</span>
            <span className="text-[#111]">{value}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#999] leading-[1.7]">
        디지털 콘텐츠 특성상 활성화·시청 이후에는 「전자상거래 등에서의
        소비자보호에 관한 법률」 제17조 제2항 제5호에 따라 청약철회가 제한될
        수 있습니다. 자세한 내용은{" "}
        <Link href="/terms" className="text-[#111] underline">
          이용약관
        </Link>
        을 확인해 주세요.
      </p>
    </div>
  );
}
