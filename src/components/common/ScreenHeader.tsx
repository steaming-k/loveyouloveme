'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface ScreenHeaderProps {
  /** 뒤로 갈 경로. 생략하면 브라우저 히스토리를 사용한다. */
  backHref?: string;
  onBack?: () => void;
  /** 진행률 0~100. 값이 있으면 progress bar를 보여준다. */
  progress?: number;
  /** progress 우측 카운터 (예: '질문 2/4') */
  counter?: string;
  /** back 옆 제목 (progress 대신 사용) */
  title?: string;
  /** 오른쪽 액션 */
  action?: ReactNode;
  /** 가운데 라벨 (Relationship Mirror 등) */
  centerLabel?: string;
  className?: string;
}

export function ScreenHeader({
  backHref,
  onBack,
  progress,
  counter,
  title,
  action,
  centerLabel,
  className,
}: ScreenHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
    router.back();
  };

  return (
    <div className={cn('flex items-center gap-3 px-gutter pt-1 pb-2', className)}>
      <button
        type="button"
        onClick={handleBack}
        aria-label="이전 화면으로"
        className="-ml-2 flex h-11 w-11 flex-none items-center justify-center text-[19px] text-ink"
      >
        ←
      </button>

      {typeof progress === 'number' ? (
        <div className="h-[3px] min-w-0 flex-1 rounded-sm bg-track">
          <div
            className="h-[3px] rounded-sm bg-brand transition-[width] duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="프로필 만들기 진행률"
          />
        </div>
      ) : null}

      {title ? <h2 className="min-w-0 flex-1 truncate text-sub font-medium">{title}</h2> : null}

      {centerLabel ? (
        <p className="min-w-0 flex-1 text-center text-label text-brand-pressed">{centerLabel}</p>
      ) : null}

      {/* progress·title·centerLabel이 없으면 오른쪽 액션이 back 버튼에 붙지 않도록 여백을 만든다 */}
      {typeof progress !== 'number' && !title && !centerLabel ? (
        <div className="min-w-0 flex-1" />
      ) : null}

      {counter ? <span className="flex-none text-meta text-ink-sub">{counter}</span> : null}
      {action ? <div className="flex-none">{action}</div> : null}
      {!counter && !action && (title || centerLabel) ? <div className="w-11 flex-none" /> : null}
    </div>
  );
}

/** back 없이 오른쪽 텍스트 액션만 있는 헤더 (온보딩 건너뛰기 등) */
export function ScreenHeaderAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-end px-gutter">
      <button
        type="button"
        onClick={onClick}
        className="flex h-11 items-center px-2 text-caption text-ink-muted"
      >
        {label}
      </button>
    </div>
  );
}
