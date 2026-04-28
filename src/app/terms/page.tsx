export default function TermsPage() {
  return (
    <div className="max-w-[600px] mx-auto">
      <h1 className="text-[16px] font-bold mb-8">이용약관</h1>

      <div className="text-[13px] leading-[1.8] text-[#333] flex flex-col gap-6">
        <section>
          <h2 className="font-bold mb-2">제1조 (목적)</h2>
          <p>
            본 약관은 이아하랩(이하 &quot;회사&quot;라 함)이 운영하는 iiiaha.lab
            (iiiahalab.com, 이하 &quot;사이트&quot;)에서 제공하는 디지털
            콘텐츠(SketchUp·AutoCAD용 익스텐션 및 온라인 강의)
            판매 서비스(이하 &quot;서비스&quot;)의 이용조건 및 절차, 회사와 이용자의
            권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제2조 (사업자 정보)</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>상호: 이아하랩</li>
            <li>대표자: 이상훈</li>
            <li>사업자등록번호: 367-02-03753</li>
            <li>통신판매업 신고번호: 2026-서울강남-02400</li>
            <li>사업장 소재지: 서울특별시 강남구 언주로135길 32-8, 103호 (논현동)</li>
            <li>연락처: 010-4005-7606</li>
            <li>이메일: contact@iiiahalab.com</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">제3조 (약관의 효력과 변경)</h2>
          <p>
            본 약관은 사이트에 게시함으로써 효력이 발생합니다. 회사는 필요한
            경우 관련 법령을 위배하지 않는 범위 내에서 본 약관을 변경할 수
            있으며, 변경된 약관은 시행일 7일 전 사이트에 공지합니다. 이용자가
            변경된 약관에 동의하지 않는 경우 회원 탈퇴를 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제4조 (서비스의 내용)</h2>
          <p>회사는 다음의 서비스를 제공합니다.</p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-2">
            <li>익스텐션(플러그인)의 판매 및 라이선스 발급</li>
            <li>온라인 강의 콘텐츠의 판매 및 스트리밍 제공</li>
            <li>익스텐션 전체 이용을 위한 월간·연간 멤버십 서비스</li>
            <li>이용자 커뮤니티(Open Lab) 운영</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">제5조 (상품 및 라이선스)</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>모든 익스텐션 라이선스 키는 <strong>기기 1대</strong>에 대해서만 유효합니다.</li>
            <li>기기 변경이 필요한 경우 contact@iiiahalab.com으로 문의해 주시면 이전 기기 바인딩을 해제해 드립니다.</li>
            <li>라이선스 키의 공유, 재판매, 양도, 유상·무상 배포는 금지됩니다.</li>
            <li>단건 구매한 익스텐션 라이선스는 영구 사용권이며, 업데이트는 서비스가 유지되는 동안 지속적으로 무상 제공됩니다.</li>
            <li>멤버십 상품은 멤버십 유지 기간 동안 회사가 제공하는 모든 활성 익스텐션을 이용할 수 있으며, 멤버십 해지 시 라이선스 이용이 중지됩니다.</li>
            <li>강의 콘텐츠는 구매 후 평생 시청이 가능합니다(서비스가 유지되는 동안).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">제5조의2 (회원자격)</h2>
          <ol className="list-decimal pl-5 flex flex-col gap-1">
            <li>본 서비스의 회원가입은 만 14세 이상에게 허용됩니다.</li>
            <li>이용자는 본인의 정보로 회원가입해야 하며, 타인의 정보를 도용하여 가입할 수 없습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="font-bold mb-2">제6조 (결제)</h2>
          <p>
            모든 가격은 대한민국 원화(KRW, ₩)로 표시되며, 표시 가격이 곧 결제
            금액입니다. 결제는 ㈜토스페이먼츠를 통해 안전하게 처리됩니다.
            가격은 사전 고지 없이 변경될 수 있으나, 이미 확정된 주문에는
            영향을 주지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제7조 (청약철회 및 환불)</h2>
          <p>
            본 서비스가 제공하는 익스텐션 및 강의는 「전자상거래 등에서의
            소비자보호에 관한 법률」 제17조 제2항 제5호에 따른 <strong>디지털
            콘텐츠</strong>에 해당합니다.
          </p>
          <p className="mt-3">
            이용자는 구매한 상품에 대해 다음과 같이 청약철회를 요청할 수
            있습니다.
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-2">
            <li>
              <strong>익스텐션</strong>: 설치파일을 <strong>다운로드하기 전</strong>이고
              구매 후 7일 이내인 경우 마이페이지에서 직접 환불 요청이 가능합니다.
              설치파일을 다운로드한 경우(= 디지털 콘텐츠의 제공이 개시된 경우)에는
              관련 법령에 따라 청약철회가 제한됩니다.
            </li>
            <li>
              <strong>강의</strong>: 어떠한 영상도 <strong>시청하기 전</strong>이고
              구매 후 7일 이내인 경우 전액 환불이 가능합니다. 1개 이상의
              에피소드를 재생한 경우에는 관련 법령에 따라 청약철회가 제한됩니다.
            </li>
            <li>
              <strong>멤버십</strong>: 멤버십 개시 후 어떠한 익스텐션도 활성화하지
              않은 경우 구매 후 7일 이내에 환불이 가능합니다. 멤버십 기간 중에는
              월할/일할 계산에 의한 부분 환불을 제공하지 않으며, 해지 시점부터
              다음 결제일까지는 계속 이용이 가능합니다.
            </li>
            <li>
              상품에 <strong>중대한 하자</strong>가 있어 정상적인 사용이
              불가능한 경우, 활성화 여부와 무관하게 환불 또는 교체가
              가능합니다.
            </li>
            <li>
              <strong>버전 호환성</strong>: 각 익스텐션이 지원하는 호스트
              프로그램 버전(예: SketchUp 2021 이상, AutoCAD 2020 이상 등)은
              상품 상세페이지 및 결제 과정에서 고지됩니다. 이용자의 호스트
              프로그램 버전이 요구 사양에 미달하여 익스텐션을 사용할 수 없는
              경우, 이는 환불 사유에 해당하지 않습니다.
            </li>
          </ul>
          <p className="mt-3">
            환불을 원하시는 경우 contact@iiiahalab.com으로 주문번호와 함께
            요청해 주시면 영업일 기준 3일 이내에 처리해 드립니다. 환불은 원
            결제수단으로 이루어집니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제8조 (지적재산권)</h2>
          <p>
            사이트에서 제공하는 모든 익스텐션, 코드, 디자인, 강의 영상, 텍스트
            콘텐츠 등의 저작권 및 지적재산권은 회사에 귀속됩니다. 이용자는
            회사의 사전 서면 동의 없이 이를 복제·배포·전송·출판·방송하거나
            제3자에게 제공할 수 없으며, 리버스 엔지니어링, 디컴파일, 라이선스
            보호 우회를 시도해서는 안 됩니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제8조의2 (이용자의 의무 및 금지 행위)</h2>
          <p>
            이용자는 다음 행위를 해서는 안 되며, 위반 시 회사는 사전 통지 없이
            회원자격을 박탈하고 관련 라이선스를 즉시 해지할 수 있습니다.
          </p>
          <ol className="list-decimal pl-5 flex flex-col gap-1 mt-2">
            <li>라이선스 키의 공유, 재판매, 양도, 유상·무상 배포</li>
            <li>강의 영상의 녹화·캡처·제3자 전송 또는 외부 게시</li>
            <li>익스텐션의 리버스 엔지니어링, 디컴파일, 라이선스 보호 우회 시도</li>
            <li>타인의 개인정보·계정 도용</li>
            <li>서비스의 정상 운영을 방해하는 행위(자동화 도구 사용, 비정상 트래픽 발생 등)</li>
            <li>법령 또는 본 약관에 위반되는 행위</li>
          </ol>
          <p className="mt-3">
            위반으로 인해 회사 또는 제3자에게 손해가 발생한 경우 이용자는 그
            손해를 배상할 책임이 있습니다. 회원자격 박탈로 인한 라이선스·결제
            금액의 환불은 제공되지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제9조 (회사의 의무)</h2>
          <p>
            회사는 안정적인 서비스 제공을 위해 최선을 다하며, 이용자의
            개인정보를 보호하기 위해 별도의 개인정보처리방침을 수립·준수합니다.
            또한 이용자의 정당한 의견이나 불만에 대해 신속히 대응할 의무를
            부담합니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제10조 (책임의 제한)</h2>
          <p>
            서비스는 &quot;있는 그대로(as-is)&quot; 제공되며, 회사는 천재지변,
            전쟁, 불가항력 또는 이용자의 귀책사유로 인한 서비스 이용 장애에
            대해서는 책임을 지지 않습니다. 회사는 이용자가 서비스를 이용하여
            기대하는 수익을 얻지 못하거나 상실한 것에 대하여 책임을 지지
            않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">제11조 (분쟁 해결 및 관할)</h2>
          <p>
            회사와 이용자 사이에 발생한 분쟁은 상호 협의로 해결함을 원칙으로
            하며, 협의가 이루어지지 않을 경우 「전자상거래 등에서의
            소비자보호에 관한 법률」에 따른 분쟁 조정 절차 또는 관련 법령에
            따라 해결합니다. 소송이 제기되는 경우 회사의 주된 사무소 소재지를
            관할하는 법원을 합의관할로 합니다.
          </p>
        </section>

        <p className="text-[11px] text-[#999] mt-4">시행일: 2026년 4월 13일</p>
      </div>
    </div>
  );
}
