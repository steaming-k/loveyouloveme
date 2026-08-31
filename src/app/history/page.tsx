'use client';

import { useRouter } from 'next/navigation';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, Tag } from '@/components/common/primitives';
import { HISTORY_COPY } from '@/data/copy';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

const DOT_CLASS = {
  declared: 'border-2 border-ink-faint bg-surface',
  experience: 'border-2 border-mint bg-mint-tint',
  shift: 'bg-brand',
  future: 'border-2 border-dashed border-dash bg-surface',
} as const;

/**
 * F1 Relationship History — Future Concept
 * MVP의 실제 기능처럼 구현하지 않는다. 연애 일기가 아니라 '기준의 변화' 기록이라는
 * 개념만 보여준다.
 */
export default function HistoryPage() {
  const router = useRouter();

  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={ROUTES.home}
          action={<Tag tone="neutral">{HISTORY_COPY.badge}</Tag>}
        />
      }
      bodyClassName="pt-1.5 pb-6"
    >
      <div className="flex flex-col gap-[18px]">
        <PageHeading lines={HISTORY_COPY.title} caption={HISTORY_COPY.caption} />

        <ol className="relative flex flex-col pl-[22px]">
          <span className="absolute top-2 bottom-3.5 left-[5px] w-px bg-rule" aria-hidden />

          {HISTORY_COPY.timeline.map((entry, index) => (
            <li
              key={entry.date}
              className={cn(
                'relative flex flex-col gap-1.5',
                index < HISTORY_COPY.timeline.length - 1 && 'pb-[22px]',
              )}
            >
              <span
                className={cn(
                  'absolute top-[5px] -left-[22px] h-[11px] w-[11px] rounded-full',
                  DOT_CLASS[entry.kind],
                )}
                aria-hidden
              />
              <p
                className={cn(
                  'text-[11px] tnum',
                  entry.kind === 'shift' ? 'font-semibold text-brand-pressed' : 'text-ink-muted',
                )}
              >
                {entry.date}
              </p>
              <p
                className={cn(
                  'keep-all leading-relaxed',
                  entry.kind === 'declared' || entry.kind === 'shift'
                    ? 'text-body'
                    : 'text-sub text-[#555]',
                  entry.kind === 'shift' && 'font-medium',
                )}
              >
                {entry.text}
              </p>
            </li>
          ))}
        </ol>

        <figure className="m-0 flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface p-4">
          <figcaption className="text-meta font-semibold text-ink-muted">
            연락 중요도의 변화
          </figcaption>
          <svg viewBox="0 0 300 90" className="h-[90px] w-full" role="img" aria-label="연락 중요도가 2026년 3월 이후 꾸준히 높아지는 추이 그래프">
            <line x1="0" y1="70" x2="300" y2="70" stroke="#EDEBE6" strokeWidth="1" />
            <line x1="0" y1="40" x2="300" y2="40" stroke="#EDEBE6" strokeWidth="1" />
            <line x1="0" y1="10" x2="300" y2="10" stroke="#EDEBE6" strokeWidth="1" />
            <polyline
              points="10,66 105,60 200,26 290,18"
              fill="none"
              stroke="#8F74F0"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {[
              [10, 66],
              [105, 60],
              [200, 26],
              [290, 18],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.6" fill="#8F74F0" />
            ))}
          </svg>
          <div className="flex justify-between text-[10.5px] text-ink-faint tnum">
            <span>2026.03</span>
            <span>2026.06</span>
            <span>2026.09</span>
            <span>2027.02</span>
          </div>
        </figure>

        <button
          type="button"
          onClick={() => router.push(ROUTES.historyReport)}
          className="flex min-h-11 items-center justify-between rounded-row border border-line bg-surface p-[15px]"
        >
          <span className="text-sub font-medium">변화 리포트 보기</span>
          <span className="text-[15px] text-ink-muted" aria-hidden>
            →
          </span>
        </button>
      </div>
    </ScreenLayout>
  );
}
