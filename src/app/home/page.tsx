'use client';

import { useRouter } from 'next/navigation';

import { BottomNavigation } from '@/components/common/BottomNavigation';
import { Button } from '@/components/common/Button';
import { SectionLabel } from '@/components/common/primitives';
import { Lovy } from '@/components/lovy/Lovy';
import { BRAND, HOME_COPY } from '@/data/copy';
import { ROUTES } from '@/lib/routes';
import { useHomeHighlights, useMirror } from '@/hooks/useAnalysis';
import { useSession } from '@/state/SessionProvider';

/**
 * S29 분석 후 홈
 * Dashboard처럼 만들지 않는다. '지금 러비가 알고 있는 나' 한 문장이 화면의 중심이다.
 */
export default function HomePage() {
  const router = useRouter();
  const { answers } = useSession();
  const mirror = useMirror();
  const highlights = useHomeHighlights();

  const summary =
    answers.coreCorrection.trim() ||
    (answers.completed.profile ? mirror.core.summary : HOME_COPY.fallbackProfile);

  const answeredDeclared = Object.values(answers.declared).filter((value) => value !== null).length;
  const experienceCount = answers.experience.skipped
    ? 0
    : answers.experience.important.length + (answers.experience.hardest ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pt-2 pb-6">
        <div className="flex flex-col gap-4">
          <header className="flex items-center justify-between px-0.5">
            <h1 className="text-[19px] font-bold tracking-[-0.5px]">{BRAND.name}</h1>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-chip text-[11px] font-semibold text-ink-muted"
              aria-label="내 프로필"
            >
              나
            </span>
          </header>

          <section className="flex flex-col gap-3 rounded-card border border-line bg-surface px-4 py-[18px]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-2.5">
                <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
                  {HOME_COPY.heroLabel}
                </p>
                <p className="text-[18px] font-semibold leading-[1.5] tracking-[-0.4px] keep-all">
                  {summary}
                </p>
              </div>
              <Lovy pose="heart" size={56} decorative />
            </div>

            <ul className="flex flex-wrap gap-1.5 border-t border-line-soft pt-3">
              <li className="rounded-[6px] bg-mint-tint px-2.5 py-1.5 text-[11px] font-semibold text-mint-text">
                사진 {answers.photos.length}장
              </li>
              <li className="rounded-[6px] bg-brand-tint px-2.5 py-1.5 text-[11px] font-semibold text-brand-pressed">
                질문 {answeredDeclared}개
              </li>
              <li className="rounded-[6px] bg-brand-tint px-2.5 py-1.5 text-[11px] font-semibold text-brand-pressed">
                관계 경험 {experienceCount}
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionLabel>{HOME_COPY.recentLabel}</SectionLabel>
            <ul className="flex flex-col gap-2.5">
              {highlights.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-chip border border-line bg-surface px-[15px] py-3.5"
                >
                  <span className="flex-none text-sub font-medium">{item.key}</span>
                  <span className="text-right text-caption keep-all text-ink-sub">{item.value}</span>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            onClick={() => router.push(ROUTES.history)}
            className="flex items-center justify-between gap-3 rounded-row border border-dashed border-line-strong bg-canvas-warm p-[15px] text-left"
          >
            <span className="text-[13.5px] leading-relaxed keep-all text-[#555]">
              {HOME_COPY.futureTeaser.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </span>
            <span className="flex-none rounded-[6px] bg-chip px-2 py-1.5 text-label text-ink-muted">
              COMING SOON
            </span>
          </button>

          <div className="flex flex-col gap-2 pt-0.5">
            <Button onClick={() => router.push(ROUTES.target)}>새로운 사람과 궁합 보기</Button>
            <Button variant="secondary" onClick={() => router.push(ROUTES.mirror)}>
              Relationship Mirror 다시 보기
            </Button>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
