import type { PremiumAccess } from '@/lib/premiumAccess';

/**
 * UT Health Check 판정 (v1.47 UT-2 Stability) — **운영자 전용**(`/ut`)
 *
 * 화면이 모은 사실(UT 판정 · Premium 접근 · Route 응답 · AI 모드 힌트 · 저장 상태)을 받아
 * `UT READY` / `UT BLOCKED`를 정한다. 순수 함수라 fixture가 조합별로 고정한다.
 *
 *   fail  참가자가 Premium을 못 보거나 결제가 일어날 수 있다 → BLOCKED
 *   warn  테스트는 되지만 운영자가 알아야 한다(쿼리만으로 UT · demo AI · 참가자에게 보이는 AI Debug · 읽을 수 없는 저장 세션)
 */
export const UT_REQUIRED_ROUTES = [
  '/onboarding',
  '/compatibility',
  '/mirror',
  '/premium?source=compatibility',
  '/premium-preview/relationship_deep_report',
  '/lens/mbti',
  '/lens/saju',
  '/lens/astrology',
] as const;

export type UtHealthStatus = 'pass' | 'warn' | 'fail';

export interface UtHealthItem {
  id: string;
  label: string;
  status: UtHealthStatus;
  detail?: string;
}

export interface UtHealthInput {
  utMode: boolean;
  /** `NEXT_PUBLIC_UT_MODE=true` 배포인가 — 아니면 새 탭에서 UT가 풀릴 수 있다 */
  envUtMode: boolean;
  access: PremiumAccess;
  /** flag를 전부 끈 상태의 UT 판정 — override가 실제로 작동하는지 */
  overrideAccess: PremiumAccess;
  routeStatus: Record<string, number>;
  aiModeHint: 'demo' | 'real';
  aiDebugVisible: boolean;
  sessionParsable: boolean;
}

export function evaluateUtHealth(input: UtHealthInput): { ready: boolean; items: UtHealthItem[] } {
  const items: UtHealthItem[] = [];
  const add = (id: string, label: string, status: UtHealthStatus, detail?: string) =>
    items.push(detail ? { id, label, status, detail } : { id, label, status });

  add(
    'ut_mode',
    'UT mode',
    !input.utMode ? 'fail' : input.envUtMode ? 'pass' : 'warn',
    !input.utMode
      ? 'UT가 꺼져 있어 — UT Preview 배포인지, 참가자 링크에 UT 쿼리가 붙어 있는지 확인'
      : input.envUtMode
        ? 'UT 배포(NEXT_PUBLIC_UT_MODE) — 새 탭에서도 유지'
        : '쿼리/탭 기억으로만 UT — 새 탭에서 풀릴 수 있어. UT Preview 배포 권장',
  );
  add('premium_surface', 'Premium CTA · Paywall 노출', input.access.surfaceEnabled ? 'pass' : 'fail');
  add('premium_preview_route', 'Deep Report 통로', input.access.previewRouteOpen ? 'pass' : 'fail');
  add(
    'fake_door_override',
    'feature flag가 꺼져도 UT에서 열림',
    input.overrideAccess.surfaceEnabled && input.overrideAccess.previewRouteOpen ? 'pass' : 'fail',
  );
  add(
    'payment',
    '실제 결제 불가',
    input.access.mode !== 'payment' && !input.access.paymentExecuted ? 'pass' : 'fail',
    `access mode ${input.access.mode}`,
  );

  const badRoutes = UT_REQUIRED_ROUTES.filter((route) => input.routeStatus[route] !== 200);
  add(
    'routes',
    `필수 화면 ${UT_REQUIRED_ROUTES.length}개 응답`,
    badRoutes.length === 0 ? 'pass' : 'fail',
    badRoutes.length === 0 ? undefined : badRoutes.map((route) => `${route} → ${input.routeStatus[route] ?? '응답 없음'}`).join(' · '),
  );
  add(
    'ai_mode',
    'AI 모드',
    input.aiModeHint === 'real' ? 'pass' : 'warn',
    input.aiModeHint === 'real' ? 'real' : 'demo — AI 문장 없이 규칙 리포트만 보여',
  );
  add(
    'participant_meta',
    '참가자 화면에 개발 도구 없음',
    input.aiDebugVisible ? 'warn' : 'pass',
    input.aiDebugVisible ? 'AI Debug 버튼이 보여 — Preview env에서 NEXT_PUBLIC_AI_DEBUG=false' : undefined,
  );
  add(
    'local_state',
    '저장된 세션 읽기',
    input.sessionParsable ? 'pass' : 'warn',
    input.sessionParsable ? undefined : '저장된 세션을 읽지 못해 — 참가자 시작 전 초기화 권장',
  );

  return { ready: items.every((item) => item.status !== 'fail'), items };
}
