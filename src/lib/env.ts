/**
 * Demo AI 정직성 플래그.
 *
 * 실제 AI Vision/LLM 백엔드가 아직 없다. 이 값이 true인 동안은 사용자에게 존재하지 않는
 * 분석을 실제 분석인 것처럼 보여주지 않기 위해, 관찰 화면에 'DEMO AI' 배지를 붙인다.
 * 실제 백엔드가 붙으면 NEXT_PUBLIC_DEMO_AI=false로 배지를 끌 수 있다.
 */
export const IS_DEMO_AI = process.env.NEXT_PUBLIC_DEMO_AI !== 'false';
