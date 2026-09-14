'use client';

import { useEffect, useRef } from 'react';

import { useAccount } from '@/state/AccountProvider';
import type { AiNarrativeState, DeepNarrativeBundle, RelationshipDeepReport } from '@/types';

/**
 * v1.47 Integration — 렌더된 Deep Report를 **저장한 관계**의 analysis_run으로 남긴다. 화면에는 아무것도 그리지 않는다.
 *
 * ⚠️ `useEffect`는 결과가 화면에 커밋된 **뒤**에 돈다 — 렌더 전에 저장하지 않는다(`rendered: true`의 근거).
 * ⚠️ 저장할지는 `persistDeepReportSnapshot`이 정한다(Guest · 저장 안 한 관계 · 실패 · 게이트 거부 · verify_only는 저장 안 함).
 * ⚠️ 같은 logical run(generationRequestId)은 한 번만 시도한다. 서버도 idempotency key로 한 번 더 막는다.
 */
export function DeepReportSnapshotSaver({
  report,
  narrative,
}: {
  report: RelationshipDeepReport;
  narrative: AiNarrativeState<DeepNarrativeBundle>;
}) {
  const { status: accountStatus, activeRelationshipSaved, persistDeepReportSnapshot } = useAccount();
  const attempted = useRef<string | null>(null);
  const { status, mode, data } = narrative;

  useEffect(() => {
    if (accountStatus !== 'signed_in' || !activeRelationshipSaved) return;
    if (status !== 'ready' || !data?.generationRequestId) return;
    const key = `${data.generationRequestId}:${data.meta.inputFingerprint}`;
    if (attempted.current === key) return;
    attempted.current = key;
    void persistDeepReportSnapshot({ rendered: true, status, mode, bundle: data, report });
  }, [accountStatus, activeRelationshipSaved, status, mode, data, report, persistDeepReportSnapshot]);

  return null;
}
