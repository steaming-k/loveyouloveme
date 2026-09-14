'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { usePremiumAccess, useUtMode } from '@/hooks/useUtMode';
import { AI_DEBUG, AI_MODE_HINT } from '@/lib/env';
import { resolvePremiumAccess } from '@/lib/premiumAccess';
import { ROUTES } from '@/lib/routes';
import { downloadUtExport } from '@/lib/utExport';
import { UT_REQUIRED_ROUTES, evaluateUtHealth, type UtHealthItem } from '@/lib/utHealth';
import { UT_MODE_DEPLOYMENT } from '@/lib/utMode';
import { clearParticipantStorage } from '@/lib/utReset';

const SESSION_KEY = 'lym.session.v1';

function sessionParsable(): boolean {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

const MARK: Record<UtHealthItem['status'], string> = { pass: '✓', warn: '!', fail: '✗' };

/**
 * UT 운영자 콘솔 (v1.47 UT-2 Stability) — `/ut`
 *
 * 10초 점검: 화면이 열리면 바로 필수 Route를 부르고 `evaluateUtHealth`로 READY/BLOCKED를 정한다.
 * 초기화: 이 브라우저의 럽유럽미 저장값(`lib/utReset.ts` 범위)을 지우고 **새로고침으로** 온보딩을 연다 —
 * 메모리에 남은 세션 · AI 캐시 · 진행 중 요청까지 함께 사라진다.
 */
export function UtOperatorConsole() {
  const utMode = useUtMode();
  const access = usePremiumAccess();
  const [routeStatus, setRouteStatus] = useState<Record<string, number> | null>(null);
  const [parsable, setParsable] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);

  const runCheck = useCallback(async () => {
    setRouteStatus(null);
    setParsable(sessionParsable());
    const entries = await Promise.all(
      UT_REQUIRED_ROUTES.map(async (route) => {
        try {
          const response = await fetch(route, { cache: 'no-store', redirect: 'manual' });
          return [route, response.status] as const;
        } catch {
          return [route, 0] as const;
        }
      }),
    );
    setRouteStatus(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const health = routeStatus
    ? evaluateUtHealth({
        utMode,
        envUtMode: UT_MODE_DEPLOYMENT,
        access,
        overrideAccess: resolvePremiumAccess({
          utMode: true,
          fakeDoorEnabled: false,
          previewEnabled: false,
          paymentConfirmed: false,
        }),
        routeStatus,
        aiModeHint: AI_MODE_HINT,
        aiDebugVisible: AI_DEBUG,
        sessionParsable: parsable,
      })
    : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 overflow-y-auto bg-canvas px-4 py-6">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted">UT OPERATOR</p>

      <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
        <p
          data-testid="ut-health-status"
          className={
            health === null
              ? 'text-section text-ink-muted'
              : health.ready
                ? 'text-section text-mint-ink'
                : 'text-section text-friction-text'
          }
        >
          {health === null ? '점검 중…' : health.ready ? 'UT READY' : 'UT BLOCKED'}
        </p>
        <ul className="flex flex-col gap-1.5">
          {(health?.items ?? []).map((item) => (
            <li
              key={item.id}
              data-testid={`ut-health-${item.id}`}
              data-status={item.status}
              className="flex flex-col text-[12.5px] keep-all"
            >
              <span>
                <span aria-hidden className="mr-1.5 font-semibold">
                  {MARK[item.status]}
                </span>
                {item.label}
              </span>
              {item.detail ? <span className="pl-5 text-[11.5px] text-ink-sub">{item.detail}</span> : null}
            </li>
          ))}
        </ul>
        <Button variant="secondary" onClick={() => void runCheck()}>
          다시 점검
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => downloadUtExport()}>
          UT 결과 내보내기
        </Button>
        <Button onClick={() => setResetOpen(true)}>다음 참가자 준비 (초기화)</Button>
        <p className="text-[11.5px] keep-all leading-relaxed text-ink-sub">
          이 브라우저에 남은 참가자 답변 · 기록 · Premium 상태 · UT 응답 · AI 캐시를 지우고 온보딩을 연다. Supabase에 저장된 데이터는 건드리지 않는다.
        </p>
      </section>

      <ConfirmModal
        open={resetOpen}
        title="다음 참가자를 위해 초기화할까?"
        description="먼저 'UT 결과 내보내기'로 내려받아 뒀는지 확인해. 되돌릴 수 없어."
        confirmLabel="초기화"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          clearParticipantStorage();
          window.location.replace(ROUTES.onboarding);
        }}
      />
    </main>
  );
}
