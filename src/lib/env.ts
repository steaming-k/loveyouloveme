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
