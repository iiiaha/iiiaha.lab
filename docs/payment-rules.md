# iiiaha.lab — Payment & License Rules

이 문서는 iiiahalab.com의 결제·주문·라이선스 정책의 단일 진실이다.
관련 코드를 수정하거나 새 기능을 추가할 때 **반드시 이 문서를 먼저 확인**한다.
법적 문서(`/terms`)와 충돌하면 먼저 이 문서를 업데이트한 뒤 약관도 같이 갱신한다.

---

## 1. 통화 & 가격

- **통화는 KRW 단일**. 다중 통화 지원 안 함.
- 모든 가격은 `formatPrice()` (`src/lib/types.ts`)로 표시 — `₩39,000` 형식.
- DB의 `products.price`는 정수 원(₩) 단위. 소수점, 부가세 분리 컬럼 없음. 표시 가격 = 결제 금액.
- 할인은 `original_price` + `discount_percent`로 표현. `price`는 항상 **할인 적용 후** 최종 가격이어야 한다.
- 가격 변경은 미래 주문에만 적용. **확정된 주문은 절대 소급 변경 금지** (약관 §3과 일치).

---

## 2. 결제 흐름 (단건 구매)

진실의 출처: `src/app/api/payment/confirm/route.ts`

```
[클라이언트: /cart]
   ↓ Toss 결제창 → paymentKey, orderId, amount 획득
[POST /api/payment/confirm]
   1. 인증된 유저인지 확인 (없으면 401)
   2. Toss /v1/payments/confirm 호출 → 실패 시 400 반환, 이후 단계 진행 금지
   3. products 조회 (없으면 404)
   4. orders insert (status: "paid")
   5. licenses insert (license_key 발급)
   6. 쿠폰 사용 기록 (있을 때만)
   7. { license_key, order_id } 반환
```

**불변 규칙**
- **순서 엄수**: Toss 승인이 성공하기 전에는 절대 order/license를 만들지 않는다.
- **검증된 가격**: `amount`는 클라이언트가 보낸 값을 그대로 Toss에 넘기고, 같은 값을 `orders.amount`에 저장한다. 향후 위·변조 방지를 위해 서버에서 `products.price`와 (할인+쿠폰 적용 후) 재계산해 비교하는 검증을 추가해야 한다 — **현재는 미구현, 우선 보강 대상**.
- **DB 실패 시**: order는 만들어졌는데 license가 실패하면 사용자는 결제했지만 라이선스가 없다. 현재는 500만 반환하고 끝. → 수동 보정 필요. 다음 개선 항목: 트랜잭션 또는 보상 로직.
- **결제 키 컬럼**: 단건 결제는 Toss `paymentKey` 저장. 구독으로 발급된 무료 주문은 `subscription:{id}` 형식 — 이 구분이 환불/조회 로직의 기준.

---

## 3. 쿠폰

진실의 출처: `src/app/api/coupon/route.ts`, `src/app/cart/page.tsx`

**유효성 검사 순서** (서버):
1. 코드 존재 여부 (`code`는 `toUpperCase().trim()`으로 정규화)
2. `is_active = true`
3. `starts_at` 도래 여부
4. `expires_at` 미경과
5. `max_uses` 미달성 (`used_count < max_uses`)
6. **계정당 1회**: `coupon_uses` 테이블에 같은 user+coupon이 없어야 함

**할인 계산** (클라이언트, `cart/page.tsx`):
- `percent`: `Math.round(total * value/100)`
- `fixed`: `value` 그대로
- 최종 가격: `Math.max(0, total - discount)` (음수 방지)
- `min_amount` 미달이면 적용 거부

**불변 규칙**
- **쿠폰은 한 번에 1개만 적용**. 스택 금지.
- **계정당 1회만**. 같은 사람이 두 번 못 쓴다.
- 코드는 대소문자 무시 (서버에서 uppercase).
- 사용 기록은 결제 성공(`/api/payment/confirm` step 6)에서만 삽입한다. cart에서 'apply'만 한 상태로는 카운트하지 않는다.

**TBD (정책 결정 필요)**
- 결제 실패 후 재시도 시 같은 쿠폰을 다시 쓸 수 있어야 하는가? 현재는 결제 성공 전까지 `coupon_uses` 행이 없으므로 가능 — 의도된 동작이라면 OK.

---

## 4. 라이선스 발급

진실의 출처: `src/lib/license-utils.ts`

**키 형식**: `XXXX-XXXX-XXXX-XXXX`
- 4 segment, 각 2바이트 hex 대문자 (총 32비트 × 2 = 16 hex chars + 3 hyphens)
- `crypto.randomBytes`로 생성. 충돌 방지 검사는 없음 (확률적으로 무시 가능하지만 unique 인덱스는 DB에 걸려 있어야 함 — `licenses.license_key UNIQUE` 보장 필요)

**HMAC 서명**
- 알고리즘: HMAC-SHA256
- 시크릿: `process.env.LICENSE_HMAC_SECRET`
- **프로덕션에서는 절대 fallback `"iiiaha-license-secret-change-me"`를 쓰지 않는다.** Vercel 환경변수에 반드시 설정. 누락 시 빌드/배포 차단 로직을 추가해야 함 — TBD.
- 시크릿 노출 시 모든 발급된 라이선스가 위조 가능. 회전(rotation) 절차 필요 — TBD.

**서명 대상**: 활성화/검증 시 반환되는 `token` 객체 전체 (`JSON.stringify` 후 HMAC)
```ts
{ license_key, product_slug, hwid, activated_at, expires_check }
```

---

## 5. 라이선스 활성화·검증·해제

진실의 출처: `src/app/api/license/{activate,verify,deactivate}/route.ts`, `ruby-license/license.rb`

### 5.1 모델
- **1 라이선스 = 1 디바이스 (HWID)**. 동시 다중 디바이스 금지.
- HWID는 클라이언트(Ruby gem)가 생성: Win은 BaseBoard SerialNumber, Mac은 IOPlatformExpertDevice UUID, SHA256 후 32자.
- DB는 `licenses.hwid`에 바인딩 저장. `null`이면 미활성 상태.

### 5.2 Activate (`POST /api/license/activate`)
입력: `{ license_key, product_slug, hwid }`
1. 라이선스 조회 → 없으면 404
2. `products.slug` 일치 확인 → 다르면 403
3. `status === "revoked"`면 403
4. **분기**:
   - `hwid === null`: 첫 활성화 → DB에 hwid·activated_at 기록, `status: "activated"` + token 반환
   - `hwid === 요청 hwid`: 재활성화 → `status: "already_active"` + token 반환
   - 그 외: 다른 디바이스 → 403 "already activated on another device"

### 5.3 Verify (`POST /api/license/verify`)
입력: 동일
- 모든 검증 통과 시 `status: "valid"` + 새 token 반환 (`expires_check`만 갱신)
- `revoked` → 403, 클라이언트는 캐시 삭제
- HWID 불일치 → 403

### 5.4 Deactivate (`POST /api/license/deactivate`)
입력: `{ license_key, hwid }`
- HWID 일치하는 경우에만 `licenses.hwid = null, activated_at = null`
- 해제 후 같은 라이선스로 다른 디바이스에서 재활성화 가능

### 5.5 Token TTL & Grace Period
- 서버가 발급하는 `expires_check`: **현재 시각 + 7일**
- Ruby 클라이언트:
  - 캐시가 유효 (`Time.now < expires_check`) → 오프라인으로 통과
  - 만료 → 온라인 verify 시도
  - 온라인 실패(서버 다운/네트워크 끊김) → **3일 grace** (`GRACE_DAYS = 3`)
  - 3일 grace 초과 → 라이선스 다이얼로그 강제
- **revoked는 grace 적용 안 함**. 즉시 차단되고 캐시 삭제.

**불변 규칙**
- 서버 측 verify 응답에 `revoked`가 포함되면 클라이언트는 즉시 캐시 삭제. 이 동작을 깨면 해지된 라이선스가 grace로 살아남는 버그가 생긴다.
- HWID 변경(메인보드 교체 등)은 사용자가 직접 deactivate → activate 해야 한다. 자동 전환 없음.

### 5.6 TBD (정책 결정 필요)
- **재활성화 횟수 제한**: 현재 무제한. 악용 방지를 위해 N회/월 제한이 필요할 수 있음.
- **HWID 충돌**: VM, 가상 보드는 같은 hwid가 나올 수 있음. 무대응 상태.
- **Rate limiting**: activate/verify 엔드포인트에 무차별 대입 방어 없음. 향후 미들웨어 추가 필요.

---

## 6. 구독 (Subscription)

진실의 출처: `src/app/api/subscribe/activate/route.ts`, `/subscribe` 페이지

- **가격: ₩39,000 / month** (cart CTA에 하드코딩됨 — 변경 시 cart 코드와 DB 둘 다 갱신)
- **혜택**: 활성화 시점에 `products` 중 `type=extension AND is_active=true`인 **모든 익스텐션**에 대해 주문 + 라이선스가 자동 생성됨 (강의는 포함 안 됨)
- **idempotent**: 이미 같은 `subscription_id`로 만들어진 주문이 있으면 스킵. 재호출해도 중복 라이선스 안 생김.
- 무료 발급 주문의 표식: `orders.amount = 0`, `orders.payment_key = "subscription:{id}"`, `orders.subscription_id = {id}`
- 새 익스텐션이 출시되면 활성 구독자에게 자동 배포되는가? — `/api/subscribe/activate`를 다시 호출하면 새 항목만 추가됨. 자동 트리거는 없으므로 **신규 익스텐션 출시 시 운영자가 활성 구독에 대해 재실행하는 절차 필요**. → TBD: 출시 시 자동 fan-out 잡 검토.

**TBD (정책 결정 필요)**
- 결제 게이트웨이: 구독 결제(반복 결제)는 어떻게 처리하는가? 현재 코드에는 Toss 정기결제 연동이 없음. 첫 가입만 처리하고 갱신 흐름은 미구현으로 보임.
- 구독 해지 흐름: `/api/subscribe/cancel` 같은 엔드포인트가 없음. 해지 시 발급된 라이선스를 어떻게 처리할지 (즉시 revoke vs 기간 만료까지 유지)?
- 강의는 구독 대상이 아님 — 의도된 정책인지 확인.

---

## 7. 환불 정책

진실의 출처: `/terms` §4 + 운영 규칙

- **활성화 전 7일 이내**: 환불 가능. license.hwid가 null이면 자동 판별 가능.
- **활성화 후**: 케이스 바이 케이스 (현재는 수동, contact@iiiahalab.com)
- **운영 절차**:
  1. 사용자 메일 수신 → order/license 확인
  2. 활성화 여부 확인 → 정책 적용
  3. Toss 콘솔에서 환불 처리
  4. `orders.status`를 `refunded`로 업데이트 (현재 enum에 있는지 확인 필요 — TBD)
  5. 해당 라이선스 `status: "revoked"`로 변경 → 다음 verify 사이클에서 클라이언트 캐시 자동 삭제됨

**불변 규칙**
- 환불 처리 시 라이선스를 **반드시 revoke**한다. 환불 후 라이선스가 살아있으면 사용자가 무료로 계속 쓰게 됨.

**TBD**
- 환불 자동화 엔드포인트(`/api/admin/refund` 등)가 있어야 수동 실수를 줄일 수 있음. 현재는 없음.
- 부분 환불 (구독 중도 해지) 정책 — 미정.

---

## 8. 보안 체크리스트

코드 수정 전·후 다음을 확인한다:

- [ ] `LICENSE_HMAC_SECRET`이 환경변수로 설정되어 있는가? Fallback 문자열을 쓰고 있지 않은가?
- [ ] `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 라우트에서만 import되는가? 클라이언트 번들에 새지 않는가?
- [ ] 결제 금액은 서버 측에서 재계산해 검증하는가? (현재 미구현 — 추가 시 이 항목 갱신)
- [ ] 라이선스/결제 관련 라우트에 rate limiting이 걸려 있는가? (현재 없음)
- [ ] 새 결제 흐름을 만들 때 토스 승인 → DB 쓰기 순서를 지켰는가?
- [ ] 환불 후 라이선스를 `revoked`로 표시했는가?

---

## 9. 변경 절차

이 문서는 결제·라이선스 코드보다 먼저 갱신한다.
1. 정책 변경을 결정 → 이 문서 수정
2. 영향 받는 코드 수정 (API 라우트, ruby-license, 약관 페이지)
3. 약관(`src/app/terms/page.tsx`)과 정합성 확인
4. (가능하면) Supabase에서 한 건 테스트 결제·활성화·해제 사이클 실행

이 문서의 **TBD** 항목은 미해결 정책 결정. 시간 날 때마다 하나씩 결정해 줄여 나간다.
