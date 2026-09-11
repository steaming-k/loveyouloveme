import { applyNavEntry, type NavKind } from '@/lib/navTrail';

/**
 * POST /api/dev/nav-test — **개발 전용** Navigation Trail Fixture 실행기 (v1.46.2)
 *
 * `tests/run-nav-fixtures.mjs`가 부른다. 브라우저 없이 고정할 수 있는 것은
 * "이 이동 뒤에 back은 어디로 가는가"의 **판정**뿐이다 — 실제 스크롤 복원과
 * 브라우저 back은 Browser QA가 본다.
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** 화면이 쓰는 `applyNavEntry`를 그대로
 * 부른다(`run-lens-fixtures`의 dev route와 같은 원칙).
 *
 * 요청: `{ steps: [{ href, kind }] }` — kind는 push · replace · pop.
 * 응답: 각 단계 뒤의 trail과, 마지막 상태의 `depth` · `previous` · `hasInAppHistory`.
 */

interface NavStep {
  href: string;
  kind: NavKind;
}

const KINDS: readonly NavKind[] = ['push', 'replace', 'pop'];

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, error: 'dev only' }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const rawSteps = (body as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(rawSteps)) {
    return Response.json({ ok: false, error: 'steps must be an array' }, { status: 400 });
  }

  const steps: NavStep[] = [];
  for (const raw of rawSteps) {
    const step = raw as { href?: unknown; kind?: unknown };
    if (typeof step?.href !== 'string' || !KINDS.includes(step?.kind as NavKind)) {
      return Response.json({ ok: false, error: 'invalid step' }, { status: 400 });
    }
    steps.push({ href: step.href, kind: step.kind as NavKind });
  }

  let entries: string[] = [];
  const timeline: { step: NavStep; entries: string[] }[] = [];
  for (const step of steps) {
    entries = applyNavEntry(entries, step.href, step.kind);
    timeline.push({ step, entries: [...entries] });
  }

  return Response.json({
    ok: true,
    data: {
      entries,
      depth: entries.length,
      current: entries.length > 0 ? entries[entries.length - 1] : null,
      previous: entries.length >= 2 ? entries[entries.length - 2] : null,
      /** `useContextualBack`의 분기 — true면 `router.back()`, false면 fallback */
      hasInAppHistory: entries.length > 1,
      timeline,
    },
  });
}
