'use client';

import { useState } from 'react';

import { ComparePair } from '@/components/common/primitives';
import { trackEvent } from '@/lib/analytics';
import type { CompatibilityDimension } from '@/types';
import { SignalGauge, ToneBadge } from './SignalGauge';

/**
 * Why (S22) — 항목별 근거 드릴다운
 * 점수만 보여주지 않고, 나 / 상대 / 근거 / 상황을 함께 펼친다.
 */
export function DimensionAccordion({
  dimensions,
  defaultOpenKey,
}: {
  dimensions: CompatibilityDimension[];
  defaultOpenKey?: string;
}) {
  /**
   * undefined = 아직 사용자가 아무것도 누르지 않은 상태.
   * 이때는 defaultOpenKey를 그대로 따른다. useState 초기값으로 박아두면
   * localStorage 복원 전(답변이 비어 있는 상태)에 계산된 값이 그대로 굳어버린다.
   */
  const [openKey, setOpenKey] = useState<string | null | undefined>(undefined);
  const activeKey = openKey === undefined ? (defaultOpenKey ?? null) : openKey;

  return (
    <ul className="flex flex-col gap-2">
      {dimensions.map((dimension) => {
        const open = activeKey === dimension.key;

        return (
          <li key={dimension.key} className="rounded-row border border-line bg-surface">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => {
                const next = open ? null : dimension.key;
                setOpenKey(next);
                if (next) {
                  trackEvent('compatibility_dimension_expand', { dimension: dimension.key });
                }
              }}
              className="flex min-h-11 w-full items-center justify-between gap-2.5 px-[15px] py-3.5 text-left"
            >
              <span className="min-w-0 text-[14.5px] font-medium tracking-[-0.2px]">
                {dimension.label}
              </span>
              <span className="flex flex-none items-center gap-2">
                <SignalGauge
                  alignment={dimension.alignment}
                  tone={dimension.tone}
                  label={dimension.label}
                />
                <span className="w-3 text-right text-[13px] leading-none text-ink-muted" aria-hidden>
                  {open ? '−' : '+'}
                </span>
              </span>
            </button>

            {/* grid-template-rows 전환은 SSR 마크업을 바꾸지 않으면서 높이를 부드럽게 늘린다 */}
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
              style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
              aria-hidden={!open}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-2.5 border-t border-line-soft px-[15px] pt-3 pb-3.5">
                  <div className="flex items-center justify-between">
                    <ToneBadge tone={dimension.tone} />
                    {dimension.alignment === null ? (
                      <span className="text-[11.5px] text-ink-muted">
                        상대 정보를 알려주면 비교할 수 있어요
                      </span>
                    ) : null}
                  </div>

                  <ComparePair mine={dimension.minePhrase} theirs={dimension.theirsPhrase} />

                  <DetailRow label="근거" text={dimension.evidence} />
                  <DetailRow label="상황" text={dimension.scene} />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DetailRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-7 flex-none pt-0.5 text-[10.5px] font-semibold text-brand-pressed">
        {label}
      </span>
      <span className="text-[12.5px] keep-all leading-relaxed text-[#555]">{text}</span>
    </div>
  );
}
