'use client';

import { useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionProvider';
import type { Verdict } from '@/types';

/**
 * 관찰을 되묻는 블록 — `맞아 / 조금 달라 / 잘 모르겠어` (v1.45에서 분리)
 *
 * ══ 왜 별 파일로 뺐는가 ═══════════════════════════════════════════════════
 *
 * v1.26이 `DeepInsightCard` → `DeepConnectionCard`로 갈 때 이 블록을 손으로 이식했고,
 * 그 파일 주석이 이렇게 경고했다: "두 이벤트의 **유일한 호출부가 사라질 뻔했다** —
 * 사용자가 관찰을 되짚을 수 있는 기능을 조용히 없애지 않는다."
 *
 * v1.45에서 렌더 단위가 연결 카드 → Chapter Accordion으로 다시 바뀌었으므로 **같은
 * 위험이 두 번째로 왔다.** 이번에는 이식하지 않고 분리한다 — 렌더 단위가 또 바뀌어도
 * 이 블록은 옮겨 붙일 필요가 없다.
 *
 * ⚠️ 피드백 키는 여전히 **Insight id**다(`answers.deepInsightFeedback`). Chapter id로
 * 바꾸지 않는다 — 이미 저장된 사용자 피드백이 있고, 그 값의 주어는 판정 단위(Insight)다.
 * Chapter는 표현 단위라 다음 버전에서 다시 묶일 수 있다.
 *
 * ⚠️ 자유서술 원문은 이벤트로 보내지 않는다 — id만 남긴다(§48).
 */
export function DeepInsightVerdict({
  insightId,
  funnelAnalysisId,
}: {
  /** 이 관찰의 결정론 Insight id. Chapter에서는 대표(첫) Insight를 쓴다 */
  insightId: string;
  funnelAnalysisId?: string | null;
}) {
  const { answers, setDeepInsightFeedback } = useSession();
  const feedback = answers.deepInsightFeedback[insightId];
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState('');

  const submitVerdict = (verdict: Verdict) => {
    setDeepInsightFeedback(insightId, verdict);
    if (verdict === 'no') setCorrectionOpen(true);
  };

  const submitCorrection = () => {
    const text = correctionDraft.trim();
    setDeepInsightFeedback(insightId, 'no', text || undefined);
    trackEvent('deep_insight_correction_submit', {
      ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
      insight: insightId,
    });
    setCorrectionOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 연결은 판정이 아니라 관찰이다 — 항상 되물을 수 있어야 한다 */}
      <div className="flex gap-[7px] border-t border-line-soft pt-3">
        <VerdictButton
          label="맞아"
          selected={feedback?.verdict === 'ok'}
          onClick={() => submitVerdict('ok')}
        />
        <VerdictButton
          label="조금 달라"
          muted
          selected={feedback?.verdict === 'no'}
          onClick={() => submitVerdict('no')}
        />
        <VerdictButton
          label="잘 모르겠어"
          muted
          selected={Boolean(feedback) && feedback?.verdict === null}
          onClick={() => submitVerdict(null)}
        />
      </div>

      {correctionOpen ? (
        <div className="flex flex-col gap-2 rounded-[10px] bg-sunken p-3">
          <textarea
            value={correctionDraft}
            onChange={(event) => setCorrectionDraft(event.target.value)}
            placeholder="실제로는 어떻게 다른지 짧게 적어줘 (선택)"
            rows={2}
            className="w-full resize-none rounded-[8px] border border-line bg-surface p-2.5 text-[12.5px] keep-all outline-none"
          />
          <button
            type="button"
            onClick={submitCorrection}
            className="min-h-11 rounded-[8px] bg-brand text-caption font-semibold text-white"
          >
            저장
          </button>
        </div>
      ) : null}

      {feedback?.correctedText ? (
        <p className="text-[11.5px] keep-all text-ink-muted">
          네가 고친 내용: {feedback.correctedText}
        </p>
      ) : null}
    </div>
  );
}

function VerdictButton({
  label,
  selected,
  muted = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-11 flex-1 rounded-[9px] border py-2 text-[11.5px] transition-colors duration-200',
        selected
          ? 'border-brand bg-brand-tint font-semibold text-ink'
          : cn('border-line bg-surface active:bg-sunken', muted ? 'text-ink-sub' : 'text-ink'),
      )}
    >
      {label}
    </button>
  );
}
