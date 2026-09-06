'use client';

import { useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { useSession } from '@/state/SessionProvider';
import { cn } from '@/lib/cn';
import type { DeepConnection, Verdict } from '@/types';

/**
 * 하나의 **연결**을 보여주는 블록 (v1.26 · P3-3)
 *
 * Premium이 파는 것은 '더 긴 문장'이 아니라 '따로 있던 것들이 이어진다는 사실'이다.
 * 그래서 이 블록의 시각 구조 자체가 연결을 말한다:
 *
 *   동기화율 비교 ─┐
 *                 ├─ 연결
 *   관계 경험    ─┘
 *
 * ⚠️ Visual Direction — gold/black/glow/gradient를 쓰지 않는다. Premium은 '더 화려함'이
 * 아니라 **더 촘촘하고 연결된 문서**처럼 보여야 한다. 그래서 여기서 쓰는 것은
 * divider · 좌측 rule · 작은 metadata · 얇은 connector line뿐이다. chart library 없음.
 *
 * ⚠️ 근거는 숨기지 않는다(§23). 다만 리포트가 길어지므로 **핵심 연결은 기본 노출**하고
 * 근거만 접어둔다 — 모든 걸 accordion으로 숨기지 않는다(§44).
 */

/**
 * 연결선. **장식이므로 `aria-hidden`이고**, 같은 정보가 위 source 라벨과 아래 문장에
 * 텍스트로 이미 존재한다(§55 text alternative).
 */
function Connector({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="relative flex w-3 flex-none items-center self-stretch"
      style={{ minHeight: count * 18 }}
    >
      {/* 위·오른쪽·아래를 잇는 대괄호 — 여러 source가 한 지점으로 모이는 모양 */}
      <span className="absolute inset-y-[7px] left-0 w-full rounded-r-[4px] border-y border-r border-line-strong" />
      {/* 모인 지점에서 오른쪽으로 나가는 짧은 선 */}
      <span className="absolute right-[-6px] top-1/2 h-px w-[6px] bg-line-strong" />
    </span>
  );
}

export function DeepConnectionCard({
  connection,
  /** 첫 viewport의 CORE PATTERN이면 더 강한 위계로 그린다 */
  variant = 'default',
  funnelAnalysisId,
}: {
  connection: DeepConnection;
  variant?: 'core' | 'default';
  funnelAnalysisId?: string | null;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState('');
  const isCore = variant === 'core';

  /**
   * v1.26 — 구 `DeepInsightCard`에 있던 User Correction을 그대로 이식했다.
   * 그 컴포넌트가 이 카드로 대체되면서 `deep_insight_feedback` /
   * `deep_insight_correction_submit` 두 이벤트의 **유일한 호출부가 사라질 뻔했다** —
   * 사용자가 관찰을 되짚을 수 있는 기능을 조용히 없애지 않는다.
   *
   * Deep Report의 연결은 판정이 아니라 관찰이라 **항상 되물어야 한다.**
   */
  const { answers, setDeepInsightFeedback } = useSession();
  const feedback = answers.deepInsightFeedback[connection.id];

  const submitVerdict = (verdict: Verdict) => {
    setDeepInsightFeedback(connection.id, verdict);
    if (verdict === 'no') setCorrectionOpen(true);
  };

  const submitCorrection = () => {
    const text = correctionDraft.trim();
    setDeepInsightFeedback(connection.id, 'no', text || undefined);
    // ⚠️ 자유서술 원문은 보내지 않는다 — id만 남긴다(§48).
    trackEvent('deep_insight_correction_submit', {
      ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
      insight: connection.id,
    });
    setCorrectionOpen(false);
  };

  const handleExpand = () => {
    const next = !evidenceOpen;
    setEvidenceOpen(next);
    if (next) {
      /**
       * §47 — **새 이벤트를 만들지 않는다.** 근거 펼치기는 이미
       * `deep_insight_evidence_expand`가 담당하고 있어서 그대로 재사용한다.
       * ⚠️ property는 개수·축·id뿐이다 — 근거 원문·답변은 보내지 않는다(§48).
       */
      trackEvent('deep_insight_evidence_expand', {
        ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
        insight: connection.id,
        axis: connection.axis,
        evidence_count: connection.evidence.length,
        source_count: connection.sourceCount,
      });
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        isCore ? 'rounded-card border border-line bg-surface p-4' : 'border-t border-line-soft pt-4',
      )}
    >
      {/* 무엇과 무엇을 이었는지 — 작은 metadata로만. badge 남발 금지(§24) */}
      {connection.sourceCount >= 2 ? (
        <div className="flex items-start gap-2">
          <ul className="flex min-w-0 flex-col gap-1">
            {connection.sourceLabels.map((label) => (
              <li
                key={label}
                className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted"
              >
                {label}
              </li>
            ))}
          </ul>
          <Connector count={connection.sourceLabels.length} />
          <span className="ml-1.5 self-center text-[10px] font-semibold tracking-[0.1em] text-mint-ink">
            연결
          </span>
        </div>
      ) : (
        <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
          {connection.sourceLabels.join(' · ')}
        </p>
      )}

      {/* 규칙이 만든 연결 요약 — AI가 이 문장을 바꾸지 못한다 */}
      <p
        className={cn(
          'keep-all leading-relaxed',
          isCore ? 'text-[15px] font-semibold tracking-[-0.2px]' : 'text-[13px] font-medium',
        )}
      >
        {connection.ruleSummary}
      </p>

      {/* AI가 붙인 맥락. 없으면 위 문장만으로 완결된다 — AI가 없어도 리포트가 사라지지 않는다 */}
      {connection.narrativeText ? (
        <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
          {connection.narrativeText}
        </p>
      ) : null}

      {/* 이 연결이 말할 수 없는 것 — 항상 있다(인과가 아니라 연관이라는 경계) */}
      <p className="border-l-2 border-line-strong pl-3 text-[11.5px] keep-all leading-relaxed text-ink-muted">
        {connection.limitation}
      </p>

      {connection.evidence.length > 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleExpand}
            aria-expanded={evidenceOpen}
            className="flex min-h-11 items-center gap-1.5 self-start text-[11.5px] font-semibold text-brand-pressed"
          >
            근거 {connection.evidence.length}개 {evidenceOpen ? '접기' : '보기'}
            <span aria-hidden>{evidenceOpen ? '↑' : '↓'}</span>
          </button>

          {evidenceOpen ? (
            <ul className="flex flex-col gap-2 rounded-[10px] bg-sunken px-3.5 py-3">
              {connection.evidence.map((item) => (
                <li key={item.key} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-faint">
                    {item.sourceLabel}
                  </span>
                  {/* 저장된 label/summary 기반 — 자유서술 원문을 그대로 노출하지 않는다(§23) */}
                  <span className="text-[12px] keep-all leading-relaxed text-ink">{item.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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
