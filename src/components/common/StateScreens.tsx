'use client';

import type { ReactNode } from 'react';

import { Lovy } from '@/components/lovy/Lovy';
import { STATE_COPY } from '@/data/copy';

/**
 * Empty / Error 상태 화면
 * 둘 다 러비 화법으로 쓰고, 사용자가 다음에 무엇을 할 수 있는지 함께 보여준다.
 */

export function EmptyStateView({
  actions,
  children,
}: {
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const copy = STATE_COPY.empty;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-3.5 pb-10 text-center">
      <Lovy pose={copy.pose} size={120} decorative />
      <h2 className="text-section keep-all">{copy.title}</h2>
      <p className="text-sub leading-relaxed text-ink-sub">
        {copy.body.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
      {children}
      {actions ? <div className="mt-1.5 w-full">{actions}</div> : null}
    </div>
  );
}

export function ErrorStateView({ actions }: { actions?: ReactNode }) {
  const copy = STATE_COPY.error;

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-3.5 pb-10 text-center"
      role="alert"
    >
      <Lovy pose={copy.pose} size={140} decorative />
      <h2 className="text-section keep-all">{copy.title}</h2>
      <p className="text-sub leading-relaxed text-ink-sub">
        {copy.body.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
      <code className="rounded-tag bg-sunken px-2.5 py-1.5 font-mono text-[11px] text-ink-faint">
        {copy.code}
      </code>
      {actions ? <div className="mt-1.5 w-full">{actions}</div> : null}
    </div>
  );
}

/** 관측 기록을 더 채우도록 안내하는 행 */
export function FillDataRow({
  label,
  actionLabel = '시작',
  onClick,
}: {
  label: string;
  actionLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-between rounded-chip border border-line bg-surface px-3.5 py-3 text-left active:bg-sunken"
    >
      <span className="text-[13.5px] keep-all">{label}</span>
      <span className="flex-none text-meta font-semibold text-brand">{actionLabel}</span>
    </button>
  );
}
