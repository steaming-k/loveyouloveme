'use client';

import type { ReactNode } from 'react';

import { useContextualBack } from '@/hooks/useContextualBack';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

interface ScreenHeaderProps {
  /**
   * **직접 진입 fallback**이다. 돌아갈 곳이 아니라, 돌아갈 곳이 없을 때 갈 곳이다.
   *
   * v1.46.2 §Navigation — 예전에는 이 값으로 `router.push()`를 했다. 그래서 앱 안에서
   * 들어온 사용자도 항상 **고정된 부모 Route**로 떨어졌다(`/compatibility/lenses`에서
   * 연 사주 렌즈가 `/lens`로 가는 식). 이제 앱 안에서 온 back은 실제 직전 화면으로
   * 돌아가고, 이 값은 주소창으로 바로 들어온 경우에만 쓰인다.
   */
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
  /** fallback이 선언되지 않은 화면은 Home으로 — 앱 안에서는 어차피 쓰이지 않는다 */
  const goBack = useContextualBack(backHref ?? ROUTES.home);

  const handleBack = () => {
    if (onBack) return onBack();
    goBack();
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
