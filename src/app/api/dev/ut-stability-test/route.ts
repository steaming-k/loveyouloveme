import { resolvePremiumAccess } from '@/lib/premiumAccess';
import { PREMIUM_RETURN_MAX_AGE_MS, parsePremiumReturn } from '@/lib/premiumReturn';
import { UT_REQUIRED_ROUTES, evaluateUtHealth, type UtHealthInput } from '@/lib/utHealth';
import { resolveUtMode } from '@/lib/utMode';
import { participantKeysToClear } from '@/lib/utReset';

/**
 * POST /api/dev/ut-stability-test — **개발 전용** UT-2 Stability Fixture
 *
 * `tests/run-ut-stability-fixtures.mjs`가 부른다. 화면이 쓰는 순수 판정 함수
 * (`resolveUtMode` · `resolvePremiumAccess` · `parsePremiumReturn` · `participantKeysToClear` · `evaluateUtHealth`)를
 * **그대로** 부른다 — 판정을 복제하지 않는다.
 *
 * ⚠️ Provider를 부르지 않는다. ⚠️ Production에서는 404.
 */
export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }

  const now = Date.UTC(2026, 8, 14, 12, 0, 0);
  const stamp = (href: unknown, at: number) => JSON.stringify({ href, at });

  const utOn = resolvePremiumAccess({ utMode: true, fakeDoorEnabled: true, previewEnabled: true, paymentConfirmed: false });
  const utFlagsOff = resolvePremiumAccess({ utMode: true, fakeDoorEnabled: false, previewEnabled: false, paymentConfirmed: false });
  const allRoutesOk = Object.fromEntries(UT_REQUIRED_ROUTES.map((route) => [route, 200]));
  const healthBase: UtHealthInput = {
    utMode: true,
    envUtMode: true,
    access: utOn,
    overrideAccess: utFlagsOff,
    routeStatus: allRoutesOk,
    aiModeHint: 'real',
    aiDebugVisible: false,
    sessionParsable: true,
  };
  const health = (patch: Partial<UtHealthInput>) => evaluateUtHealth({ ...healthBase, ...patch });

  return Response.json({
    ok: true,
    utMode: {
      /** UT Preview 배포(env) — 새 탭 · 쿼리 없음 · 탭 기억 없음 */
      deploymentNewTab: resolveUtMode({ envFlag: true, queryMode: null, stored: null }),
      /** env 없는 배포에서 쿼리로만 들어온 뒤 새 탭 — 풀린다(운영 문서가 UT 배포를 권장하는 이유) */
      queryOnlyNewTab: resolveUtMode({ envFlag: false, queryMode: null, stored: null }),
    },
    access: {
      utFlagsOff,
      prodDefault: resolvePremiumAccess({ utMode: false, fakeDoorEnabled: true, previewEnabled: false, paymentConfirmed: false }),
    },
    premiumReturn: {
      paywall: parsePremiumReturn(stamp('/premium?source=compatibility&hook=friction_why#lens-saju', now - 1000), now),
      previewRoute: parsePremiumReturn(stamp('/premium-preview/relationship_deep_report', now - 1000), now),
      external: parsePremiumReturn(stamp('https://example.com/premium', now - 1000), now),
      protocolRelative: parsePremiumReturn(stamp('//example.com/premium', now - 1000), now),
      nonPremium: parsePremiumReturn(stamp('/home', now - 1000), now),
      lookalike: parsePremiumReturn(stamp('/premiumx', now - 1000), now),
      expired: parsePremiumReturn(stamp('/premium?source=mirror', now - PREMIUM_RETURN_MAX_AGE_MS - 1), now),
      future: parsePremiumReturn(stamp('/premium?source=mirror', now + 10 * 60_000), now),
      garbage: parsePremiumReturn('{not json', now),
      empty: parsePremiumReturn(null, now),
    },
    resetKeys: participantKeysToClear([
      'lym.session.v1',
      'lym.history.v1',
      'lym.targets.v1',
      'lym.premium-preview-unlock.v1',
      'lym.premium-intent.v1',
      'lym.premium-return.v1',
      'lym.ut.deep.v1',
      'lym.ai.session',
      'lym.scroll.v1:premium:compatibility:abc',
      'lym.consent.v1',
      'lym.ut-mode.v1',
      'lym.cloudLinks.v1',
      'sb-project-auth-token',
      'other-app.key',
    ]),
    health: {
      allGood: health({}),
      utOff: health({ utMode: false, access: resolvePremiumAccess({ utMode: false, fakeDoorEnabled: false, previewEnabled: false, paymentConfirmed: false }) }),
      queryOnly: health({ envUtMode: false }),
      routeDown: health({ routeStatus: { ...allRoutesOk, '/premium-preview/relationship_deep_report': 404 } }),
      paymentPossible: health({ access: { ...utOn, mode: 'payment', paymentExecuted: true } }),
      demoAi: health({ aiModeHint: 'demo' }),
      aiDebugVisible: health({ aiDebugVisible: true }),
      brokenSession: health({ sessionParsable: false }),
    },
  });
}
