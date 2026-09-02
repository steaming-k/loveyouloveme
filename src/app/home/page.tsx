'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BottomNavigation } from '@/components/common/BottomNavigation';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { SectionLabel } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { Lovy } from '@/components/lovy/Lovy';
import { BRAND, HOME_COPY } from '@/data/copy';
import { clearAiCache } from '@/services/ai/aiClient';
import { clearDeepReportUt } from '@/lib/deepReportUtStore';
import { clearPremiumIntents } from '@/lib/premiumIntentStore';
import { ROUTES } from '@/lib/routes';
import { useHistoryReport, useHomeHighlights, useMirror } from '@/hooks/useAnalysis';
import { useHistory } from '@/state/HistoryProvider';
import { useSession } from '@/state/SessionProvider';

/**
 * S29 분석 후 홈
 * Dashboard처럼 만들지 않는다. '지금 러비가 알고 있는 나' 한 문장이 화면의 중심이다.
 */
export default function HomePage() {
  const router = useRouter();
  const { answers, deleteAllData } = useSession();
  const { showToast } = useToast();
  const mirror = useMirror();
  const highlights = useHomeHighlights();
  const { entries, latest, clearAll: clearHistory } = useHistory();
  const report = useHistoryReport();
  const [deleteOpen, setDeleteOpen] = useState(false);
  /**
   * §30은 '전체 데이터 삭제 = Session + History'를 요구한다. 다만 축적된 관찰 기록을
   * 되돌릴 수 없게 지우는 건 무게가 다르므로, 기본값을 켠 상태로 두고 선택만 남겨뒀다.
   */
  const [alsoDeleteHistory, setAlsoDeleteHistory] = useState(true);

  /** §27 — History 0개 / 1개 / 2개 이상 */
  const historyCta = (() => {
    if (entries.length === 0) {
      return {
        title: '아직 저장된 관찰이 없어.',
        preview: 'Relationship Mirror를 저장하면 여기에 쌓여.',
        action: '시작',
        href: ROUTES.mirror,
      };
    }
    if (entries.length === 1) {
      return {
        title: '러비가 기억하고 있는 관찰 1개',
        preview: latest?.coreInsight.userCorrection?.trim() || latest?.coreInsight.original || '',
        action: '보기',
        href: ROUTES.history,
      };
    }
    return {
      title: report.headline
        ? '지난 관찰과 달라진 신호가 있어.'
        : `러비가 기억하고 있는 관찰 ${entries.length}개`,
      preview: report.headline?.note ?? report.summary,
      action: '보기',
      href: report.headline ? ROUTES.historyReport : ROUTES.history,
    };
  })();

  const summary =
    answers.coreCorrection.trim() ||
    (answers.completed.profile ? (mirror.core?.summary ?? HOME_COPY.fallbackProfile) : HOME_COPY.fallbackProfile);

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

          {/* §27 — History 상태를 실제로 보여준다. COMING SOON은 제거됐다. */}
          <button
            type="button"
            onClick={() => router.push(historyCta.href)}
            className="flex items-center justify-between gap-3 rounded-row border border-line bg-surface p-[15px] text-left active:bg-sunken"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                RELATIONSHIP HISTORY
              </span>
              <span className="text-[13.5px] font-medium keep-all">{historyCta.title}</span>
              {historyCta.preview ? (
                <span className="text-[12px] keep-all leading-relaxed text-ink-sub">
                  {historyCta.preview}
                </span>
              ) : null}
            </span>
            <span className="flex-none rounded-[6px] bg-brand-tint px-2 py-1.5 text-label font-semibold text-brand-pressed">
              {historyCta.action}
            </span>
          </button>

          <div className="flex flex-col gap-2 pt-0.5">
            <Button onClick={() => router.push(ROUTES.target)}>새로운 사람과 궁합 보기</Button>
            <Button variant="secondary" onClick={() => router.push(ROUTES.mirror)}>
              Relationship Mirror 다시 보기
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="flex min-h-11 items-center justify-center text-meta text-ink-faint"
          >
            내 관찰 데이터 삭제
          </button>
        </div>
      </div>

      <BottomNavigation />

      <ConfirmModal
        open={deleteOpen}
        title="관찰 데이터를 모두 삭제할까?"
        description="사진 선택 기록, 관계 답변, 상대 정보와 분석 결과를 모두 삭제해. 되돌릴 수 없어."
        confirmLabel="전체 삭제"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteAllData();
          // 결제 의향 기록·Deep Report UT 응답·AI 캐시도 함께 지운다 — 사용자 데이터를
          // 남겨둘 이유가 없다(v1.10 §57/§58). deepAnswers/deepInsightFeedback은
          // SessionAnswers 안에 있어서 deleteAllData()가 이미 지운다.
          clearPremiumIntents();
          clearDeepReportUt();
          clearAiCache();
          if (alsoDeleteHistory) clearHistory();
          setDeleteOpen(false);
          showToast(
            alsoDeleteHistory
              ? '관찰 데이터와 기록을 모두 삭제했어'
              : '현재 관찰 데이터를 삭제했어',
          );
          router.push(ROUTES.splash);
        }}
      >
        {entries.length > 0 ? (
          <label className="mt-1 flex items-start gap-2.5 rounded-chip bg-sunken px-3.5 py-3 text-left">
            <input
              type="checkbox"
              checked={alsoDeleteHistory}
              onChange={(event) => setAlsoDeleteHistory(event.target.checked)}
              className="mt-0.5 h-4 w-4 flex-none accent-[#8F74F0]"
            />
            <span className="text-meta keep-all leading-relaxed text-ink-sub">
              저장된 관찰 기록 {entries.length}개도 함께 삭제
              <span className="block text-ink-faint">
                끄면 지금 진행 중인 답변만 지우고, 쌓인 기록은 남겨둬.
              </span>
            </span>
          </label>
        ) : null}
      </ConfirmModal>
    </div>
  );
}
