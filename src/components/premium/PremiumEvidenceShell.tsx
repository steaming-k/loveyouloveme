'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { PageHeading, SectionLabel } from '@/components/common/primitives';
import { Lovy } from '@/components/lovy/Lovy';
import type { PremiumEvidenceGap } from '@/lib/logic/premiumEvidenceState';
import { rememberPremiumReturn } from '@/lib/premiumReturn';

/**
 * Premium 입력 보완 화면 (v1.47 UT-2 Stability)
 *
 * UT 참가자의 근거가 아직 부족할 때 Premium을 **숨기지 않고** 이 화면을 연다.
 *
 * ```
 * Premium 진입 → 이 화면(무엇이 더 필요한지) → 정보 채우기 → 입력 화면 → 결과 화면 도착 시 근거가 채워졌으면 Premium으로 자동 복귀
 * ```
 *
 * ⚠️ **리포트를 만들지 않는다.** 가격 · unlock · 빈 Chapter를 보여주지 않는다 — 빈 분석을 Premium 결과로 덮지 않는다.
 * ⚠️ 채우면 반드시 열린다고 약속하지 않는다('이 화면으로 다시 데려올게'까지만).
 */
export const PREMIUM_EVIDENCE_SHELL_COPY = {
  title: ['정밀 분석을 위해', '몇 가지 정보가 더 필요해'],
  caption: '아래 정보를 채우면 이 화면으로 다시 데려올게.',
  listLabel: '채우면 좋은 정보',
  fillCta: '정보 채우기',
} as const;

/** '정보 채우기' — 지금 Premium 주소를 기억하고 입력 화면으로 간다 */
export function usePremiumEvidenceFill(): (href: string) => void {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      rememberPremiumReturn(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      router.push(href);
    },
    [router],
  );
}

export function PremiumEvidenceShell({
  gap,
  onFill,
}: {
  gap: PremiumEvidenceGap;
  onFill: (href: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5" data-testid="premium-evidence-shell" data-evidence-state={gap.state}>
      <div className="flex items-start justify-between gap-3">
        <PageHeading
          lines={[...PREMIUM_EVIDENCE_SHELL_COPY.title]}
          caption={PREMIUM_EVIDENCE_SHELL_COPY.caption}
          className="min-w-0"
        />
        <Lovy pose="ponder" size={72} decorative />
      </div>

      <section className="flex flex-col gap-2">
        <SectionLabel>{PREMIUM_EVIDENCE_SHELL_COPY.listLabel}</SectionLabel>
        <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-row border border-line">
          {gap.fills.map((fill) => (
            <li key={fill.state}>
              <button
                type="button"
                onClick={() => onFill(fill.href)}
                className="press-scale flex min-h-11 w-full items-center justify-between gap-2 bg-surface px-3.5 py-2.5 text-left active:bg-sunken"
              >
                <span className="min-w-0 text-[12.5px] font-medium keep-all">{fill.label}</span>
                <span className="flex-none text-meta font-semibold text-brand" aria-hidden>
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
