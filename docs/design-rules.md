# iiiaha.lab — Design Rules

이 문서는 iiiahalab.com의 시각적·UX 일관성을 보장하기 위한 단일 진실(Single Source of Truth)이다.
새 페이지/컴포넌트를 만들거나 기존 것을 수정할 때 **반드시 이 문서를 먼저 확인**한다.
규칙을 어기는 경우는 의식적인 결정이어야 하며, 그 이유를 PR/커밋에 남긴다.

---

## 1. 디자인 철학

- **블랙 & 화이트, 미니멀**. 색은 의미를 전달할 때만 쓴다 (할인 = red-600, 성공 = green-600).
- **활자 우선(Type-first)**. 장식 요소를 더하기 전에 타이포그래피와 여백으로 위계를 만든다.
- **얇은 선(Hairline) 분할**. 박스 그림자, 둥근 모서리, 그라데이션은 기본적으로 쓰지 않는다 (예외: Subscription CTA).
- **조용한 인터랙션**. 호버는 underline 또는 미세한 색 반전. 크게 움직이지 않는다.

---

## 2. 컬러 토큰

`src/app/globals.css`의 CSS 변수를 단일 출처로 사용한다. 새 색을 추가하기 전에 기존 토큰으로 해결할 수 있는지 본다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--background` | `#ffffff` | 페이지 배경 |
| `--foreground` | `#111111` | 본문, 제목, 1차 버튼 배경, 진한 보더 |
| `--muted` | `#666666` | 보조 텍스트 (가격 일반, 모바일 비활성 메뉴) |
| `--caption` | `#999999` | 캡션, 메타정보, placeholder, 빈 상태 |
| `--border` | `#111111` | 강조 보더 (섹션 구분, 1차 버튼 외곽) |
| `--border-light` | `#dddddd` | 일반 보더 (카드, 입력창, 리스트 행 구분) |

**시맨틱 컬러** (Tailwind 기본값 사용)
- 할인/오류: `text-red-600`
- 성공: `text-green-600`
- 옅은 배경: `bg-[#f5f5f5]` (썸네일 백플레이트, 미디어 컨테이너)

**금지**
- 위 토큰 외의 회색 hex 직접 입력 금지. 새 회색이 필요하면 토큰을 추가하라.
- 파스텔, 채도 높은 컬러 금지 (단, Subscription Aurora CTA는 예외).

---

## 3. 타이포그래피

- **폰트**: Pretendard Variable (CDN에서 로드, `src/app/layout.tsx`)
- **기본**: `font-size: 14px`, `line-height: 1.5`, `letter-spacing: -0.01em`
- 한글/영문 혼용 시에도 동일한 폰트로 처리. 별도 한글 폰트 추가 금지.

**크기 스케일**

| 용도 | 크기 | 비고 |
|---|---|---|
| 페이지 H1 | `text-[16px] font-bold tracking-[0.03em]` | 모든 페이지 헤더 통일 |
| 카드 제목 (ProductCard) | `text-[14px] font-bold` | hover 시 underline |
| 본문 / 폼 입력 | `text-[13px]` | 기본 텍스트 |
| 보조 / 가격 라인 | `text-[12px]` | 부제, 메뉴 라벨 |
| 캡션 / 메타 | `text-[11px]` | 안내문, 라스트 업데이트 |
| Subscription 가격 강조 | `text-[17px] font-bold` | 예외, CTA에서만 |
| 카운트 배지 | `text-[9px] font-bold` | 카트 카운트, 코너 리본 |

**굵기**: `font-bold`만 사용. `font-medium`/`font-semibold` 금지(시각적 노이즈).

**자간(letter-spacing)**
- 헤더 H1: `tracking-[0.03em]`
- 메뉴/로고/CTA 버튼: `tracking-[0.02em]` ~ `tracking-[0.05em]`
- 본문: 글로벌 `-0.01em`

---

## 4. 레이아웃 & 여백

**컨테이너**
```
max-w-[800px] mx-auto px-10 max-sm:px-5
```
- 페이지 메인, 헤더, 푸터 모두 동일한 800px 컨테이너 위에 정렬한다.
- 모바일(`max-sm`, <640px)에서는 좌우 패딩 20px.
- 800px를 벗어나는 와이드 레이아웃은 만들지 않는다.

**브레이크포인트** (Tailwind 기본)
- `max-sm`: <640px (모바일)
- `max-md`: <768px (작은 태블릿/모바일)
- `md`: ≥768px (데스크톱 메뉴 표시 기준)

**페이지 헤더 패턴**
```tsx
<div className="flex items-baseline justify-between mb-[10px]">
  <h1 className="text-[16px] font-bold tracking-[0.03em]">{Title}</h1>
  <span className="text-[12px] text-[#999]">{meta}</span>
</div>
<div className="border-b border-[#111] mb-8 sticky-divider" />
```
모든 페이지가 이 패턴을 따른다. 헤더 아래 검은 1px 라인과 `sticky-divider`는 필수.

**섹션 간 수직 간격**
- 페이지 헤더 → 본문: `mb-8` (32px) 또는 `mb-[72px]` (빈 상태처럼 강조 시)
- 컴포넌트 간: `gap-3` ~ `gap-6` 사이에서 선택. 임의 값(`gap-[7px]` 등) 금지.

---

## 5. 컴포넌트 패턴

### 5.1 Header (`src/components/Header.tsx`)
- `sticky top-0 z-50 bg-white`로 상단 고정
- 좌측: 80px 원형 프로필 이미지(`profile.png`), 모바일 50px
- 우측 데스크톱 nav: `text-[12px]` 메뉴 + 카트 아이콘. 활성 경로는 `font-bold`
- 모바일: 햄버거 메뉴, 펼치면 세로 리스트(`text-[13px]`)

### 5.2 Footer (`src/components/Footer.tsx`)
- 컨테이너 폭에 맞는 검은 1px 보더 위에 배치
- 좌: 브랜드명 + 이메일, 우: 외부 링크/약관/개인정보
- `text-[13px]`, 메타 `text-[#999]`

### 5.3 ProductCard (`src/components/ProductCard.tsx`)
- 썸네일: `aspect-square bg-[#f5f5f5] border border-[#ddd]`
- 썸네일 내부 패딩 `p-[20%]` — 이미지가 카드 안에서 충분히 떨어져 보이게
- 호버: 이미지 `opacity-85` (느린 trans 200ms)
- 가격 표시 규칙: 할인 시 원가는 `text-[#ccc] line-through`, 판매가는 `text-red-600 font-bold`. 할인 없으면 `text-[#666]`
- **배지(Badge)**: 우상단 45° 회전 코너 리본, `bg-[#111] text-white text-[9px] font-bold`. 다른 위치/모양 금지

### 5.4 버튼

| 종류 | 클래스 | 용도 |
|---|---|---|
| 1차 (Primary) | `w-full bg-[#111] text-white text-[14px] font-bold tracking-[0.05em] py-3` | 결제, 회원가입, 주요 CTA |
| 2차 (Outline) | `text-[12px] border border-[#111] bg-transparent px-4 py-2 hover:bg-[#111] hover:text-white transition-colors` | 쿠폰 적용, 보조 액션 |
| 3차 (Ghost) | `text-[11px] text-[#999] bg-transparent border-0 hover:text-[#111]` | 삭제, 취소 등 약한 액션 |

**금지**: 다른 색의 버튼, rounded-lg/xl, 그림자.

### 5.5 폼 입력
```
border border-[#ddd] px-3 py-2 text-[13px] outline-none focus:border-[#111]
```
- 둥근 모서리 없음, 그림자 없음, focus는 보더 색 반전만

### 5.6 리스트 행
- 행 사이 구분: `border-b border-[#ddd]`
- 행 내부 패딩: `py-3`
- 좌측 썸네일 40×40, `bg-[#f5f5f5]`, `object-contain`

### 5.7 Sticky Divider
`globals.css`의 `.sticky-divider` 클래스. `top: 144px`로 헤더 바로 아래 붙는다.
헤더 높이가 바뀌면 이 값도 같이 바꿔야 한다 (현재: `py-8(32+32) + logo 80 = 144`).

### 5.8 Subscription CTA (예외 영역)
- 다크 배경 `#080810` + Aurora 그라데이션 (`globals.css`의 `.sub-cta-aurora`)
- **유일하게** 어두운 배경과 컬러 그라데이션이 허용되는 곳
- 다른 곳에서 이 패턴을 복제하지 않는다

---

## 6. 가격 표시 규칙

- **모든 가격은 KRW**, `formatPrice()` (`src/lib/types.ts`) 사용. 직접 `₩{n}` 쓰지 않는다.
- 포맷: `₩{toLocaleString("ko-KR")}` → `₩39,000`
- 할인 가격은 항상 **원가(취소선)** + **판매가(red-600 굵게)** 두 줄/한 줄로 같이 표기한다.
- 무료 또는 0원은 그냥 `₩0`으로 표시 (구독 내 추가 라이선스 등).

---

## 7. 커서

전역 커서가 SketchUp 선택 커서로 교체되어 있다 (`globals.css`).
- 일반: `cursor.png` (9, 6 hotspot)
- 상호작용 요소(a, button 등): 동일 이미지지만 hover 의미로 사용
- 새로운 인터랙티브 요소를 만들 때 `cursor-default` 등으로 덮어쓰지 않는다.

---

## 8. 보이스 & 톤

- **언어**: 헤더/네비/UI 라벨은 영문 소문자 위주(예: "Extensions", "Cart", "My Page"). 콘텐츠 본문(상품 설명, 약관 등)은 한국어 또는 영문.
- **간결**. 한 문장 = 하나의 의미. 마케팅적 과장 금지.
- **버튼 라벨**: 동사 또는 동사+목적어 (`Apply`, `Browse Extensions`, `Checkout — ₩39,000`)
- **빈 상태**: 짧은 한 문장 + 다음 행동 유도 버튼 한 개. (예: "Your cart is empty." + "Browse Extensions")
- **에러 메시지**: 사용자 행동 가능한 형태로 ("Minimum order amount: ₩X"), 기술 용어 노출 금지.

---

## 9. 변경 절차

이 문서는 코드보다 먼저 바뀐다. 디자인 결정을 바꿀 때는:
1. `docs/design-rules.md`를 먼저 수정 (또는 본인이 안 한다면 PR에 메모)
2. `globals.css`의 토큰 또는 컴포넌트 변경
3. 영향 받는 페이지를 한 번씩 브라우저로 열어 확인

규칙을 일시적으로 어겨야 한다면 그 컴포넌트 위에 한 줄 주석으로 이유를 남긴다.
