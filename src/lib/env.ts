/**
 * Demo AI 정직성 플래그 (표시용 힌트).
 *
 * ⚠️ v1.6부터 **실제 동작 모드는 서버가 결정한다**(`AI_MODE`, server-only). 이 클라이언트 값은
 * 첫 호출 이전에 배지를 어떻게 그릴지 정하는 힌트일 뿐이고, 분석 결과의 진짜 모드는 응답의
 * `meta.mode`(real | demo | fallback | legacy-demo)를 따른다.
 *
 * 서버가 real이어도 이 값이 true로 남아 있으면 배지가 어긋나므로,
 * real 배포에서는 `NEXT_PUBLIC_AI_MODE=real`을 함께 설정한다.
 */
export const IS_DEMO_AI = process.env.NEXT_PUBLIC_DEMO_AI !== 'false';

/** 클라이언트가 참고하는 모드 힌트. 실제 판단은 서버·응답 meta가 한다 */
export const AI_MODE_HINT: 'demo' | 'real' =
  process.env.NEXT_PUBLIC_AI_MODE === 'real' ? 'real' : 'demo';

/** 개발용 AI Debug 패널 (§80). 일반 사용자에게 노출하지 않는다 */
export const AI_DEBUG = process.env.NEXT_PUBLIC_AI_DEBUG === 'true';

/** UT Mode — 분석 결과에 '나와 비슷한가' 평가 UI를 붙인다 (§81). 기본 off */
export const UT_MODE = process.env.NEXT_PUBLIC_UT_MODE === 'true';

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

/**
 * GA4 Measurement ID (v1.10 · §27~§28). 값이 없으면 `null` — 이 세션에는 아직 없다
 * (`GA4 = NOT CONNECTED`, 기능명세서 §12.3 참고). 있을 때만 `createGa4Adapter`가 실제로
 * 이벤트를 보낸다. Key가 없어도 앱 동작은 그대로다 — Analytics 때문에 Core Funnel이
 * 막히면 안 된다(§29).
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null;
