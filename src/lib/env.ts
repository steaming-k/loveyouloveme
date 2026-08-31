/**
 * Demo AI 정직성 플래그.
 *
 * 실제 AI Vision/LLM 백엔드가 아직 없다. 이 값이 true인 동안은 사용자에게 존재하지 않는
 * 분석을 실제 분석인 것처럼 보여주지 않기 위해, 관찰 화면에 'DEMO AI' 배지를 붙인다.
 * 실제 백엔드가 붙으면 NEXT_PUBLIC_DEMO_AI=false로 배지를 끌 수 있다.
 */
export const IS_DEMO_AI = process.env.NEXT_PUBLIC_DEMO_AI !== 'false';

/**
 * 사주 계산 엔진 연결 여부.
 *
 * 사주 명식 계산은 음력 환산만으로 끝나는 문제가 아니다(절입 시각·진태양시·지역 경도 보정 등).
 * 검증된 계산 엔진/라이브러리/API가 붙기 전까지는 **false**로 두고, 실제 명식을 계산한 것처럼
 * 사용자에게 보여주지 않는다. 숫자 더하기·띠·랜덤 테이블로 명식을 만들어내지 않는다.
 *
 * 엔진이 연결되면 `NEXT_PUBLIC_SAJU_ENGINE_READY=true`로 켠다.
 * 정확도 없는 Fake Saju보다 Incomplete but Honest 상태가 낫다.
 */
export const SAJU_ENGINE_READY = process.env.NEXT_PUBLIC_SAJU_ENGINE_READY === 'true';

/* ------------------------------------------- Premium Fake Door (v1.5) */

/**
 * Premium Fake Door 노출 여부.
 *
 * ⚠️ 실제 결제(PG)는 붙이지 않는다. 이 플래그는 '사용자가 상세 분석을 위해 결제 행동까지
 * 시도하는가'를 관찰하기 위한 것이다. 결제가 가능한 것처럼 허위 표시하지 않고, 구매 시도
 * 직후 '준비 중'임을 명확히 알린다.
 *
 * false면 Premium CTA가 전부 숨고 Paywall Route는 결과 화면으로 돌려보낸다 —
 * v1.4와 동일한 Core Flow가 그대로 동작해야 한다.
 */
export const PREMIUM_FAKE_DOOR = process.env.NEXT_PUBLIC_PREMIUM_FAKE_DOOR !== 'false';

/**
 * 가격 실험 variant. 설문에서 4,900원 이하 구간에 응답이 모였지만 **검증된 가격이 아니다** —
 * 두 후보를 노출해 의향 차이를 관찰하기 위한 테스트 값이다.
 *
 * `A` = 3,900원 · `B` = 4,900원. 지정하지 않으면 A.
 * 같은 세션에서 가격이 바뀌면 안 되므로, 실제 노출 값은 sessionStorage에 고정한다
 * (`src/lib/premiumVariant.ts`).
 */
export const PREMIUM_VARIANT_ENV =
  process.env.NEXT_PUBLIC_PREMIUM_VARIANT === 'B' ? 'B' : 'A';

/** variant를 쓰지 않고 가격을 직접 고정하고 싶을 때만 사용한다 */
export const PREMIUM_TEST_PRICE_ENV = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_PREMIUM_TEST_PRICE);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
})();

/**
 * 개발·UT용 Premium Detail 미리보기.
 * true일 때만 `/premium-preview/[feature]`로 상세 화면 자체를 확인할 수 있다.
 * 일반 사용자는 Fake Door에서 이 화면에 도달하지 못한다.
 */
export const PREMIUM_PREVIEW = process.env.NEXT_PUBLIC_PREMIUM_PREVIEW === 'true';
