import { resolvePremiumAccess, type PremiumAccessInput } from '@/lib/premiumAccess';
import { resolveUtMode } from '@/lib/utMode';

/**
 * POST /api/dev/ut-premium-test — **개발 전용** Premium UT Visibility Fixture
 *
 * `tests/run-ut-premium-fixtures.mjs`가 부른다. 화면이 쓰는 두 판정 함수(`resolveUtMode` ·
 * `resolvePremiumAccess`)를 **그대로** 불러 조합별 결과를 돌려준다 — 판정을 복제하지 않는다.
 *
 * ⚠️ Provider를 부르지 않는다. ⚠️ Production에서는 404.
 */
export const runtime = 'nodejs';

const UT_CASES: Record<string, { envFlag: boolean; queryMode: string | null; stored: string | null }> = {
  freshWithQuery: { envFlag: false, queryMode: 'ut', stored: null },
  refreshWithoutQuery: { envFlag: false, queryMode: null, stored: '1' },
  envOnly: { envFlag: true, queryMode: null, stored: null },
  normalUser: { envFlag: false, queryMode: null, stored: null },
  otherQuery: { envFlag: false, queryMode: 'UT', stored: null },
  lookalikeQuery: { envFlag: false, queryMode: 'utx', stored: null },
  staleStoredValue: { envFlag: false, queryMode: null, stored: 'true' },
};

const ACCESS_CASES: Record<string, PremiumAccessInput> = {
  utFlagsOn: { utMode: true, fakeDoorEnabled: true, previewEnabled: true, paymentConfirmed: false },
  utFlagsOff: { utMode: true, fakeDoorEnabled: false, previewEnabled: false, paymentConfirmed: false },
  utPaymentClaimed: { utMode: true, fakeDoorEnabled: false, previewEnabled: false, paymentConfirmed: true },
  prodDefault: { utMode: false, fakeDoorEnabled: true, previewEnabled: false, paymentConfirmed: false },
  prodFlagOff: { utMode: false, fakeDoorEnabled: false, previewEnabled: false, paymentConfirmed: false },
  prodPreview: { utMode: false, fakeDoorEnabled: true, previewEnabled: true, paymentConfirmed: false },
  prodPaid: { utMode: false, fakeDoorEnabled: true, previewEnabled: false, paymentConfirmed: true },
};

export async function POST(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }
  const utMode = Object.fromEntries(
    Object.entries(UT_CASES).map(([key, input]) => [key, resolveUtMode(input)]),
  );
  const access = Object.fromEntries(
    Object.entries(ACCESS_CASES).map(([key, input]) => [key, resolvePremiumAccess(input)]),
  );
  return Response.json({ ok: true, utMode, access });
}
