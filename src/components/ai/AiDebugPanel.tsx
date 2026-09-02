'use client';

import { useEffect, useState } from 'react';

import { AI_DEBUG } from '@/lib/env';
import { reportPersonalizationDiagnostics } from '@/lib/logic/insightDiagnostics';
import { getAiDebugLog, type AiDebugEntry } from '@/services/ai/aiClient';
import { useCrossSourceInsights } from '@/hooks/useAiNarrative';

/**
 * AI Debug Panel (v1.10 · §30~§32 · §43~§44 · §54)
 *
 * `NEXT_PUBLIC_AI_DEBUG=true`일 때만 렌더한다 — 그 외에는 DOM에 흔적도 남기지 않는다.
 *
 * ⚠️ 절대 보여주지 않는 것(§31): API Key, System Prompt 원문, 사용자 사진, 자유서술 전문,
 * 상대 정보 전문, Provider Raw Response. 여기 보이는 건 요청 메타데이터뿐이다.
 * ⚠️ mock을 real처럼 보여주지 않는다(§32) — mode를 항상 있는 그대로 표시한다.
 */
export function AiDebugPanel() {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<readonly AiDebugEntry[]>([]);
  const insights = useCrossSourceInsights();

  useEffect(() => {
    if (!open) return;
    setLog(getAiDebugLog());
    const timer = setInterval(() => setLog(getAiDebugLog()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!AI_DEBUG) return null;

  const callCounts = log.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.task] = (acc[entry.task] ?? 0) + 1;
    return acc;
  }, {});

  const diagnostics = reportPersonalizationDiagnostics(insights);

  return (
    <div className="absolute bottom-16 right-2 z-50">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-[10px] font-bold text-white shadow-lg"
        aria-label="AI Debug Panel 열기/닫기"
      >
        AI
      </button>

      {open ? (
        <div className="absolute bottom-11 right-0 flex max-h-[70vh] w-[300px] flex-col gap-2 overflow-y-auto rounded-[12px] bg-black/90 p-3 text-[10.5px] text-white shadow-xl">
          <p className="font-semibold tracking-[0.04em] text-white/70">AI DEBUG · dev only</p>

          <div className="flex flex-col gap-1 border-b border-white/15 pb-2">
            <p className="text-white/60">Task 호출 횟수 (최근 {log.length}건)</p>
            {Object.entries(callCounts).length === 0 ? (
              <p className="text-white/40">아직 호출 없음</p>
            ) : (
              Object.entries(callCounts).map(([task, count]) => (
                <p key={task}>
                  {task}: <span className="tnum font-semibold">{count}</span>
                </p>
              ))
            )}
          </div>

          <div className="flex flex-col gap-1 border-b border-white/15 pb-2">
            <p className="text-white/60">Insight Personalization 진단 (dev only)</p>
            <p>insights: {diagnostics.insightCount} · cross-source: {diagnostics.crossSourceCount}</p>
            <p>unique sources: {diagnostics.uniqueEvidenceSources} · generic fallback: {diagnostics.genericFallbackCount}</p>
            <p>history: {diagnostics.historyInsightCount} · target: {diagnostics.targetInsightCount}</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-white/60">최근 호출 (최신 위)</p>
            {log.length === 0 ? (
              <p className="text-white/40">아직 없음</p>
            ) : (
              [...log].reverse().map((entry, index) => (
                <div key={index} className="flex flex-col gap-0.5 rounded-[8px] bg-white/10 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{entry.task}</span>
                    <ModeTag mode={entry.mode} />
                  </div>
                  <p>duration: {entry.durationMs}ms</p>
                  {entry.model ? <p>model: {entry.model}</p> : null}
                  {entry.promptVersion ? <p>prompt: {entry.promptVersion}</p> : null}
                  {entry.evidenceCount !== null ? <p>evidence: {entry.evidenceCount}</p> : null}
                  {entry.fallbackReason ? <p className="text-amber-300">reason: {entry.fallbackReason}</p> : null}
                  <p className="truncate text-white/50">fp: {entry.fingerprint}</p>
                  {entry.requestId ? <p className="truncate text-white/50">req: {entry.requestId}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModeTag({ mode }: { mode: AiDebugEntry['mode'] }) {
  const color =
    mode === 'real'
      ? 'bg-emerald-500'
      : mode === 'mock'
        ? 'bg-amber-500'
        : mode === 'error'
          ? 'bg-red-500'
          : 'bg-slate-500';
  return (
    <span className={`rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase text-black ${color}`}>
      {mode}
    </span>
  );
}
