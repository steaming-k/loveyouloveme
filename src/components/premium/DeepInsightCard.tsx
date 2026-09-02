'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Tag } from '@/components/common/primitives';
import { cn } from '@/lib/cn';
import { resolveEvidenceRefs, type EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import { trackEvent } from '@/lib/analytics';
import { axisLabel } from '@/services/premiumService';
import { useSession } from '@/state/SessionProvider';
import type { DeepReportInsightCard, Verdict } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  MATCH: '일치',
  GAP: '차이',
  CONTRADICTION: '엇갈림',
  CHANGE: '변화',
  REPEATED_SIGNAL: '반복 신호',
  UNKNOWN: '관찰 부족',
};

/**
 * Deep Insight 카드 (v1.9 · §16/§30~§33)
 *
 * 정보 위계: Headline → (근거 보기 펼치면) Evidence → Interpretation → Situation/Question.
 * AI Narrative가 Quality Gate를 통과했으면 그 문장을 쓰고, 아니면(또는 없으면)
 * `insight.ruleSummary`를 그대로 쓴다 — 화면에서 실패를 감추지 않는다(§27).
 */
export function DeepInsightCard({
  card,
  resolverContext,
  analysisId,
}: {
  card: DeepReportInsightCard;
  resolverContext: EvidenceResolverContext;
  /** v1.10 §25 — Deep Value Funnel을 다른 이벤트와 조인할 수 있게 함께 보낸다 */
  analysisId?: string;
}) {
  const { insight, narrative } = card;
  const { answers, setDeepInsightFeedback } = useSession();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState('');

  const feedback = answers.deepInsightFeedback[insight.id];
  const headline = narrative?.headline ?? insight.ruleSummary;
  const interpretation = narrative?.interpretation;
  const evidence = resolveEvidenceRefs(insight.evidenceRefs, resolverContext);

  const handleExpand = () => {
    const next = !evidenceOpen;
    setEvidenceOpen(next);
    if (next) {
      trackEvent('deep_insight_evidence_expand', {
        analysis_id: analysisId,
        insight: insight.id,
        type: insight.type,
        axis: insight.axis,
        evidence_count: insight.evidenceRefs.length,
      });
    }
  };

  const submitVerdict = (verdict: Verdict) => {
    setDeepInsightFeedback(insight.id, verdict);
    if (verdict === 'no') setCorrectionOpen(true);
  };

  const submitCorrection = () => {
    const text = correctionDraft.trim();
    setDeepInsightFeedback(insight.id, 'no', text || undefined);
    trackEvent('deep_insight_correction_submit', { analysis_id: analysisId, insight: insight.id });
    setCorrectionOpen(false);
  };

  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2.5">
        <p className="min-w-0 text-body font-medium keep-all">{headline}</p>
        <Tag tone="neutral">{TYPE_LABEL[insight.type] ?? insight.type}</Tag>
      </div>

      {interpretation ? (
        <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{interpretation}</p>
      ) : null}

      {narrative?.situation ? (
        <div className="flex flex-col gap-1 rounded-[10px] bg-sunken px-3 py-2.5">
          <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
            일어날 수 있는 상황
          </p>
          <p className="text-[12.5px] keep-all leading-relaxed text-ink">{narrative.situation}</p>
        </div>
      ) : null}

      {insight.axis ? (
        <p className="text-[11px] text-ink-muted">{axisLabel(insight.axis)} 축</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-line-soft pt-2.5">
        <button
          type="button"
          onClick={handleExpand}
          aria-expanded={evidenceOpen}
          className="flex min-h-11 items-center gap-1 text-[11.5px] font-semibold text-brand-pressed"
        >
          근거 보기
          <ChevronDown
            size={13}
            className={cn('transition-transform duration-200', evidenceOpen && 'rotate-180')}
            aria-hidden
          />
        </button>
        {narrative?.conversationQuestion ? (
          <span className="text-[11px] text-ink-muted">확인 질문 있음</span>
        ) : null}
      </div>

      {evidenceOpen ? (
        <div className="rounded-[10px] bg-sunken px-3 py-2.5">
          {evidence.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {evidence.map((item) => (
                <li key={item.key} className="flex gap-2.5">
                  <span className="flex-none text-[10px] font-semibold tracking-[0.05em] text-brand-pressed">
                    {item.sourceLabel}
                  </span>
                  <span className="min-w-0 text-[12.5px] keep-all leading-relaxed text-[#555]">
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">
              {narrative?.uncertainty ?? '이 연결의 근거를 지금은 표시할 수 없어.'}
            </p>
          )}
        </div>
      ) : null}

      {narrative?.conversationQuestion ? (
        <p className="border-t border-line-soft pt-2.5 text-[12px] keep-all leading-relaxed text-ink-sub">
          확인해볼 질문 · {narrative.conversationQuestion}
        </p>
      ) : null}

      {/* §33 User Correction — Deep Insight는 판정이 아니라 관찰이라 항상 되물어야 한다 */}
      <div className="flex gap-[7px] border-t border-line-soft pt-2.5">
        <VerdictButton label="맞아" selected={feedback?.verdict === 'ok'} onClick={() => submitVerdict('ok')} />
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
        <p className="text-[11.5px] keep-all text-ink-muted">네가 고친 내용: {feedback.correctedText}</p>
      ) : null}
    </li>
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
