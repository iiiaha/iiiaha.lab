export default function PrivacyPage() {
  return (
    <div className="max-w-[600px] mx-auto">
      <h1 className="text-[16px] font-bold mb-8">개인정보처리방침</h1>

      <div className="text-[13px] leading-[1.8] text-[#333] flex flex-col gap-6">
        <p>
          이아하랩(이하 &quot;회사&quot;라 함)은 「개인정보 보호법」 등 관련 법령을
          준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같이
          개인정보처리방침을 수립·공개합니다.
        </p>

        <section>
          <h2 className="font-bold mb-2">제1조 (수집하는 개인정보 항목 및 수집 방법)</h2>
          <p>
            회사는 회원가입, 상품 구매, 서비스 이용 과정에서 다음과 같은
            개인정보를 수집합니다.
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-2">
            <li>회원가입 시: 이메일 주소, 이름 (Google 로그인 시 Google 계정의 이메일·프로필 정보)</li>
            <li>상품 구매 시: 주문 내역, 결제 수단 정보. 카드번호·계좌번호 등 민감 결제정보는 토스페이먼츠를 통해 처리되며 회사는 이를 저장하지 않습니다.</li>
            <li>라이선스 활성화 시: 하드웨어 식별자(HWID) — 기기 고유 정보를 일방향 해시(SHA-256)로 처리한 값으로, 이를 통해 개인을 직접 식별할 수 없습니다.</li>
            <li>서비스 이용 과정에서 자동 수집: 접속 IP, 쿠키, 접속 기록</li>
          </ul>
          <p className="mt-2">
            수집 방법: 웹사이트 회원가입, 서비스 이용, 결제 과정에서 자동 수집
          </p>
          <p className="mt-2">
            회사는 만 14세 미만 아동의 회원가입을 허용하지 않습니다. 가입 과정에서
            만 14세 미만으로 확인된 경우 가입을 제한하며, 가입 후 만 14세 미만으로
            확인되는 경우 즉시 회원자격을 정지하고 관련 정보를 파기합니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제2조 (개인정보의 수집 및 이용 목적)</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>회원 관리: 회원제 서비스 이용, 본인 확인, 부정 이용 방지</li>
            <li>서비스 제공: 상품 구매·결제, 라이선스 발급·검증, 주문 내역 관리</li>
            <li>고객 지원: 문의 응대, 공지사항 전달, 업데이트 알림</li>
            <li>서비스 개선: 이용 통계 분석</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">제3조 (개인정보의 보유 및 이용 기간)</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>회원 정보: 회원 탈퇴 시까지 (탈퇴 시 지체 없이 파기)</li>
            <li>주문 및 결제 기록: 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 5년</li>
            <li>소비자 불만 및 분쟁 처리 기록: 3년</li>
            <li>접속 기록: 「통신비밀보호법」에 따라 3개월</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">제4조 (개인정보의 제3자 제공)</h2>
          <p>
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만
            다음의 경우에는 예외로 합니다.
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-2">
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정한 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">제5조 (개인정보 처리의 위탁)</h2>
          <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-2">
            <li>Supabase Inc. — 회원·주문·라이선스 데이터 저장 및 관리 (AWS 기반)</li>
            <li>Vercel Inc. — 웹사이트 호스팅 및 운영</li>
            <li>Cloudflare, Inc. — 영상 콘텐츠 스트리밍</li>
            <li>㈜토스페이먼츠 — 전자결제 처리</li>
            <li>Google LLC — Google 계정 로그인 연동</li>
            <li>Resend, Inc. — 회원·서비스 알림 이메일 발송</li>
          </ul>
          <p className="mt-3 font-bold">개인정보의 국외 이전</p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-2">
            <li>이전 받는 자: 위 위탁업체들 (소재 국가: 미국)</li>
            <li>이전 항목: 회원 정보(이메일·이름), 주문·결제 정보, 라이선스 정보, 접속 기록</li>
            <li>이전 일시 및 방법: 회원가입·구매·서비스 이용 시점에 인터넷 회선을 통한 암호화 전송, 위탁업체의 미국 소재 데이터센터에 저장</li>
            <li>이전 받는 자의 보호조치: 각 업체는 GDPR / SOC 2 / ISO 27001 등 국제 보안 표준을 준수합니다.</li>
            <li>이전 거부 권리: 이용자는 개인정보 국외 이전을 거부할 수 있으나, 이 경우 본 서비스 이용이 제한될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">제6조 (개인정보의 파기 절차 및 방법)</h2>
          <p>
            회사는 개인정보 보유 기간이 경과하거나 처리 목적이 달성된 경우
            지체 없이 해당 개인정보를 파기합니다. 이용자가 회원 탈퇴를
            요청하면 즉시 데이터베이스에서 삭제하며, 법령에 의해 보존해야
            하는 정보는 별도 분리·저장 후 보유기간 만료 시 파기합니다. 전자적
            파일 형태의 정보는 복구 불가능한 방법으로 영구 삭제합니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제7조 (이용자의 권리와 그 행사 방법)</h2>
          <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-2">
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리 정지 요구</li>
          </ul>
          <p className="mt-2">
            권리 행사는 마이페이지에서 직접 하시거나, contact@iiiahalab.com으로
            문의하시면 지체 없이 조치하겠습니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제8조 (쿠키 등 자동 수집 장치의 운영)</h2>
          <p>
            회사는 서비스 제공을 위해 필수적인 쿠키(인증·세션)만 사용합니다.
            광고·추적 쿠키는 사용하지 않습니다. 이용자는 브라우저 설정을 통해
            쿠키 저장을 거부할 수 있으나, 이 경우 일부 서비스 이용에 제한이
            있을 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제9조 (개인정보의 안전성 확보 조치)</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>기술적 조치: HTTPS 암호화 통신, 데이터베이스 접근 제한, 비밀번호 암호화 저장</li>
            <li>관리적 조치: 개인정보 처리 최소화, 접근 권한 관리</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">제10조 (개인정보 보호책임자)</h2>
          <p>
            회사는 개인정보 처리에 관한 업무를 총괄하고, 이용자의 불만 처리
            및 피해 구제를 위해 다음과 같이 개인정보 보호책임자를 지정하고
            있습니다.
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-2">
            <li>성명: 이상훈</li>
            <li>이메일: contact@iiiahalab.com</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">제11조 (개인정보처리방침의 변경)</h2>
          <p>
            이 개인정보처리방침은 시행일로부터 적용되며, 법령·정책 또는 보안
            기술의 변경에 따라 내용의 추가·삭제 및 수정이 있을 시에는 변경사항의
            시행 7일 전부터 웹사이트 공지사항을 통해 고지합니다.
          </p>
        </section>

        <p className="text-[11px] text-[#999] mt-4">시행일: 2026년 4월 13일</p>
      </div>
    </div>
  );
}
