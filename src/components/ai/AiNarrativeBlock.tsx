'use client';

import { ChevronDown, Sparkle } from 'lucide-react';
import { useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import type { ResolvedEvidence } from '@/lib/aiEvidenceResolver';
import type { AiTask } from '@/types';

/**
 * AI 설명 블록 (v1.7 · §13 · §33 · §73)
 *
 * 지키는 것:
 *   - AI 문장은 '러비가 이렇게 봤어' 수준으로만 제시한다. 판정처럼 보이게 하지 않는다.
 *   - **근거 또는 한계 중 하나를 반드시 동반한다**(§13). 둘 다 없으면 호출자가 이 블록을
 *     아예 렌더하지 않는다(`narrativeIsShowable`).
 *   - 근거는 AI가 쓴 문장이 아니라 `aiEvidenceResolver`가 **실제 세션 데이터로** 만든 것이다(§34).
 *   - AI raw prompt는 어디에도 노출하지 않는다.
 */
export function AiNarrativeBlock({
  task,
  headline,
  explanation,
  scenario,
  uncertainty,
  evidence,
  question,
  className,
}: {
  task: AiTask;
  headline?: string;
  explanation: string;
  /** 실제 관계에서 나타날 수 있는 상황 (Compatibility) */
  scenario?: string;
  uncertainty?: string;
  evidence: readonly ResolvedEvidence[];
  question?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('flex flex-col gap-2 rounded-card bg-canvas-warm px-4 py-3.5', className)}>
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-muted">
        <Sparkle size={11} aria-hidden />
        러비가 이렇게 봤어
      </p>

      {headline ? (
        <p className="text-[13.5px] font-semibold keep-all leading-relaxed">{headline}</p>
      ) : null}

      <p className="text-caption keep-all leading-relaxed text-[#555]">{explanation}</p>

      {scenario ? (
        <p className="rounded-chip bg-surface px-3 py-2.5 text-caption keep-all leading-relaxed text-[#555]">
          {scenario}
        </p>
      ) : null}

      {/* 불확실성을 접어 숨기지 않는다 — 근거보다 먼저 보이는 위치에 둔다(§13) */}
      {uncertainty ? (
        <p className="text-meta keep-all leading-relaxed text-ink-muted">{uncertainty}</p>
      ) : null}

      {question ? (
        <p className="text-meta keep-all leading-relaxed text-brand-pressed">{question}</p>
      ) : null}

      {evidence.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              const next = !open;
              setOpen(next);
              // 펼칠 때만 기록한다. 개수만 보내고 근거 문장은 보내지 않는다(§53).
              if (next) {
                trackEvent('ai_evidence_expand', { task, source_count: evidence.length });
              }
            }}
            className="flex min-h-11 items-center gap-1 self-start text-meta text-ink-muted"
          >
            왜 이렇게 봤는지
            <ChevronDown
              size={13}
              aria-hidden
              className={cn('transition-transform duration-200', open && 'rotate-180')}
            />
          </button>

          {open ? (
            <ul className="flex flex-col gap-1.5">
              {evidence.map((item) => (
                <li
                  key={item.key}
                  className="flex flex-col gap-0.5 rounded-chip border border-line bg-surface px-3 py-2.5"
                >
                  <span className="text-[10px] font-semibold tracking-[0.04em] text-ink-faint">
                    {item.sourceLabel}
                  </span>
                  <span className="text-meta keep-all leading-relaxed text-[#555]">{item.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Narrative가 준비되는 동안의 자리 표시 — Core UI를 막지 않는다(§16) */
export function AiNarrativeSkeleton({ label = '러비가 이 차이를 조금 더 정리하고 있어…' }) {
  return (
    <p
      aria-live="polite"
      className="rounded-card bg-canvas-warm px-4 py-3.5 text-meta keep-all text-ink-muted"
    >
      {label}
    </p>
  );
}
