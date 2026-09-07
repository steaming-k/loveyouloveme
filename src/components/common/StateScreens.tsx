'use client';

import type { ReactNode } from 'react';

import { Lovy } from '@/components/lovy/Lovy';
import { STATE_COPY } from '@/data/copy';

/**
 * Empty / Error 상태 화면
 * 둘 다 러비 화법으로 쓰고, 사용자가 다음에 무엇을 할 수 있는지 함께 보여준다.
 */

/**
 * ⚠️ v1.36 A11y — 제목을 `h1`로 올렸다.
 *
 * 이 화면들은 페이지 **전체**를 차지하는 상태 화면이라 다른 heading이 없다. `h2`였을 때
 * `/mirror`(관측 정보 부족)·`/profile/result`(빈 상태)·`/compatibility/analyzing`(오류)에
 * **h1이 아예 없었다**(실측: 헤딩이 `H2 > H2`로만 나왔다) — 스크린리더 사용자에게
 * 이 화면이 무엇에 대한 화면인지 알려주는 첫 지표가 없던 것이다.
 * 이 컴포넌트를 쓰는 세 화면 모두 자체 `h1`이 없으므로 중복도 생기지 않는다.
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
      <h1 className="text-section keep-all">{copy.title}</h1>
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
      <h1 className="text-section keep-all">{copy.title}</h1>
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
