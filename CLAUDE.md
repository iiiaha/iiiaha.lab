# iiiaha.lab — Agent Guide

이 파일은 Claude 및 다른 코딩 에이전트가 이 저장소에서 일관되게 작업할 수 있도록 하는 진입점이다.
**작업을 시작하기 전에 이 문서를 끝까지 한 번 읽고**, 관련 규칙 문서를 함께 연다.

---

## 1. 프로젝트 개요

**iiiaha.lab** (iiiahalab.com) — SketchUp용 익스텐션과 강의를 판매하는 1인 운영 커머스 사이트.
운영자가 직접 개발한 익스텐션을 라이선스 모델로 판매하고, 강의는 영상 호스팅으로 제공한다.

- **스택**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **백엔드**: Supabase (Auth + Postgres + Storage)
- **결제**: Toss Payments
- **영상**: Cloudflare Stream
- **호스팅**: Vercel (main 브랜치 push 시 자동 배포)
- **라이선스 클라이언트**: `ruby-license/license.rb` — SketchUp 플러그인에 임베드되는 Ruby gem

---

## 2. ⚠️ Next.js 주의

**이 버전의 Next.js는 학습 데이터의 Next.js와 다르다.** API, 컨벤션, 파일 구조 모두 깨질 수 있다.
- 새 기능을 작성하기 전에 `node_modules/next/dist/docs/` 안의 관련 가이드를 먼저 읽는다.
- Deprecation 경고는 무시하지 않는다.

---

## 3. 규칙 문서 (반드시 먼저 읽기)

작업 도메인에 해당하는 문서를 **편집 전에** 연다. 이 문서들이 코드보다 우선한다.

| 도메인 | 문서 | 언제 |
|---|---|---|
| UI / 시각 / 컴포넌트 / 색·여백·타이포 | [docs/design-rules.md](docs/design-rules.md) | 페이지·컴포넌트·CSS를 만들거나 수정할 때 |
| 결제 / 주문 / 쿠폰 / 라이선스 / 구독 / 환불 | [docs/payment-rules.md](docs/payment-rules.md) | `/api/payment`, `/api/license/*`, `/api/coupon`, `/api/subscribe`, `ruby-license/`를 건드릴 때 |

규칙을 어겨야 하는 경우는 (a) 그 이유를 PR/커밋에 남기고 (b) 가능하면 규칙 문서를 먼저 갱신한다.

---

## 4. 디렉토리 빠른 지도

```
src/
  app/                  Next.js App Router
    api/                서버 라우트 (license, payment, coupon, subscribe, stream, ...)
    admin/              관리자 페이지 (products, orders, licenses, courses, coupons, users, openlab, bugs)
    extensions/         익스텐션 마켓플레이스
    courses/            강의 카탈로그 + 시청 페이지
    openlab/            R&D 포럼
    cart/, subscribe/, mypage/, login/, signup/, terms/, privacy/
  components/           재사용 컴포넌트 (Header, Footer, ProductCard)
  lib/                  supabase 클라이언트, auth, license-utils, cart 컨텍스트, types, stream

ruby-license/           SketchUp 익스텐션에 임베드되는 라이선스 검증 Ruby gem
  license.rb            HMAC 서명 검증, HWID 생성, 7일 토큰 + 3일 grace
  html/license.html     라이선스 입력 다이얼로그 UI

docs/                   에이전트와 운영자가 따라야 할 규칙 문서
public/                 정적 자산 (cursor, profile, thumbnails)
```

---

## 5. 작업 시작 시 체크리스트

1. `git pull origin main` — 항상 먼저. 메모리에 저장된 운영자 지시.
2. 작업이 어느 도메인인지 파악 → 위 §3의 규칙 문서를 연다.
3. 변경 범위가 큰 경우 plan을 먼저 잡고 운영자에게 보여준다.
4. 작은 작업이라도 다음 원칙을 지킨다:
   - 요청 범위 밖으로 리팩터하지 않는다.
   - 가설적 미래를 위한 추상화를 만들지 않는다.
   - 코멘트는 *왜*가 비자명할 때만 한 줄.
   - 사용 안 되는 기존 코드는 호환 shim 없이 깨끗이 지운다.

---

## 6. 작업 끝나면

- UI 변경: 가능하면 `npm run dev`로 직접 브라우저에서 확인. 못 했으면 그 사실을 명시한다.
- 결제·라이선스 흐름 변경: `docs/payment-rules.md` §8 보안 체크리스트 확인.
- 변경이 끝나면 묻지 말고 commit + push (운영자 지시 — 메모리 참조).

---

## 7. 금기 / 자주 하는 실수

- 가격을 `₩{n}`처럼 직접 쓰지 않는다. 항상 `formatPrice()` 사용.
- 새 회색 hex를 도입하지 않는다. `globals.css`의 토큰을 쓴다.
- `LICENSE_HMAC_SECRET` fallback 문자열에 의존하지 않는다.
- Toss 승인 전에 order/license를 만들지 않는다.
- 환불 후 라이선스를 `revoked`로 바꾸는 것을 잊지 않는다.
- 800px 컨테이너 폭을 깨지 않는다.
- 둥근 모서리(rounded-lg/xl)와 box-shadow를 추가하지 않는다 (Subscription CTA 예외).
- `node_modules/next/dist/docs/`를 읽지 않고 Next.js API를 추측하지 않는다.

---

## 8. 추가 컨텍스트

운영자 개인 지시·메모리는 `~/.claude/projects/.../memory/`에 자동으로 로드된다.
이 파일은 코드와 함께 버전 관리되는 *공개* 가이드이고, 메모리는 사적인 컨텍스트다. 두 곳을 혼동하지 않는다.
