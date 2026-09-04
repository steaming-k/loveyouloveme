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
import { UT_MODE } from '@/lib/env';
import { clearPreviewUnlocks } from '@/lib/premiumAccess';
import { clearPremiumIntents } from '@/lib/premiumIntentStore';
import { revisitHref } from '@/lib/resultView';
import { ROUTES } from '@/lib/routes';
import { downloadUtExport } from '@/lib/utExport';
import {
  useCompatibility,
  useHistoryReport,
  useHomeHighlights,
  useMirror,
} from '@/hooks/useAnalysis';
import { useHistory } from '@/state/HistoryProvider';
import { useSession } from '@/state/SessionProvider';

/**
 * S29 분석 후 홈
 * Dashboard처럼 만들지 않는다. '지금 러비가 알고 있는 나' 한 문장이 화면의 중심이다.
 */
export default function HomePage() {
  const router = useRouter();
  const { answers, deleteAllData, resetTargetContext, reset } = useSession();
  const { showToast } = useToast();
  const mirror = useMirror();
  const compatibility = useCompatibility();
  const highlights = useHomeHighlights();
  const { entries, latest, clearAll: clearHistory } = useHistory();
  const report = useHistoryReport();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [utResetOpen, setUtResetOpen] = useState(false);
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

  /**
   * v1.11 §22/§45 — '최근 분석' 카드. 새 저장소를 쓰지 않는다 — Compatibility/Mirror는
   * 세션에서 매번 다시 계산되는 순수 함수라(`useCompatibility`/`useMirror`) 그 결과를
   * 그대로 미리보기로 재사용한다. `completed.*`가 true일 때만, 즉 실제로 한 번은 그
   * 결과 화면에 도달했을 때만 카드를 보여준다.
   */
  const compatibilityPreview =
    answers.completed.compatibility && compatibility.score !== null
      ? {
          score: compatibility.score,
          line: (() => {
            const good = compatibility.goodSignals[0]?.label;
            const friction = compatibility.frictionSignals[0]?.label;
            if (good && friction) return `${good}은 비슷하고, ${friction}에서는 확인이 필요해.`;
            if (good) return `${good}에서 잘 맞는 신호가 보여.`;
            if (friction) return `${friction}에서는 확인이 필요해.`;
            return '지금 입력으로는 뚜렷한 차이를 못 찾았어.';
          })(),
        }
      : null;

  const mirrorPreview =
    answers.completed.mirror && mirror.available && mirror.teaser
      ? {
          axisLabel: mirror.teaser.axisLabel,
          state: mirror.insights.find((insight) => insight.key === mirror.teaser?.axisKey)?.state ?? null,
          note: mirror.core?.summary ?? '',
        }
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pt-2 pb-6">
        <div className="flex flex-col gap-4">
          <header className="flex items-center justify-between px-0.5">
            <h1 className="text-[19px] font-bold tracking-[-0.5px]">{BRAND.name}</h1>
            <button
              type="button"
              onClick={() => {
                if (!answers.completed.profile) {
                  showToast('관찰 기록을 먼저 만들어야 볼 수 있어.', 'warning');
                  return;
                }
                router.push(revisitHref(ROUTES.profileResult, 'home'));
              }}
              aria-label="내 프로필 보기"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-chip text-[11px] font-semibold text-ink-muted active:bg-sunken"
            >
              나
            </button>
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

          {/* v1.11 §22/§45 — Current Result Revisit. History(과거 스냅샷)와 분리한다 */}
          {compatibilityPreview || mirrorPreview ? (
            <section className="flex flex-col gap-2.5">
              <SectionLabel>최근 분석</SectionLabel>
              <ul className="flex flex-col gap-2.5">
                {compatibilityPreview ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => router.push(revisitHref(ROUTES.compatibility, 'home'))}
                      className="flex w-full items-center justify-between gap-3 rounded-row border border-line bg-surface p-[15px] text-left active:bg-sunken"
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                          최근 궁합 · 동기화율 {compatibilityPreview.score}
                        </span>
                        <span className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                          {compatibilityPreview.line}
                        </span>
                      </span>
                      <span className="flex-none rounded-[6px] bg-brand-tint px-2 py-1.5 text-label font-semibold text-brand-pressed">
                        다시 보기
                      </span>
                    </button>
                  </li>
                ) : null}
                {mirrorPreview ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => router.push(revisitHref(ROUTES.mirror, 'home'))}
                      className="flex w-full items-center justify-between gap-3 rounded-row border border-line bg-surface p-[15px] text-left active:bg-sunken"
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                          최근 Relationship Mirror · {mirrorPreview.state ?? '관찰'} ·{' '}
                          {mirrorPreview.axisLabel}
                        </span>
                        <span className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                          {mirrorPreview.note}
                        </span>
                      </span>
                      <span className="flex-none rounded-[6px] bg-brand-tint px-2 py-1.5 text-label font-semibold text-brand-pressed">
                        다시 보기
                      </span>
                    </button>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

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

          {/* v1.11 §24 — Relationship Profile(S18)도 언제든 다시 볼 수 있어야 한다 */}
          {answers.completed.profile ? (
            <button
              type="button"
              onClick={() => router.push(revisitHref(ROUTES.profileResult, 'home'))}
              className="flex min-h-11 items-center justify-between rounded-row border border-line bg-surface px-4 text-sub active:bg-sunken"
            >
              내 관계 프로필 보기
              <span className="text-ink-faint" aria-hidden>
                →
              </span>
            </button>
          ) : null}

          {/* 새 분석 시작 — Revisit 기능이 생겼다고 이 CTA를 없애지 않는다(§46) */}
          <div className="flex flex-col gap-1.5 pt-0.5">
            <Button
              onClick={() => {
                resetTargetContext();
                router.push(ROUTES.target);
              }}
            >
              새로운 사람과 궁합 보기
            </Button>
            {/* v1.11.1 §9 — 과도한 Confirm Modal 대신 작은 안내 문구로 대체한다 */}
            {compatibilityPreview ? (
              <p className="px-1 text-center text-meta text-ink-faint">
                새로운 사람을 입력하면 최근 궁합 결과가 새 결과로 바뀌어. History는 그대로 남아.
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex min-h-11 items-center justify-center text-meta text-ink-faint"
            >
              내 관찰 데이터 삭제
            </button>
            <span className="text-ink-faint" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={() => router.push(ROUTES.privacy)}
              className="flex min-h-11 items-center justify-center text-meta text-ink-faint"
            >
              Privacy
            </button>
          </div>

          {/* v1.12 §38~§39 — UT_MODE에서만. 개발자 콘솔 없이 참가자 URL 하나로 결과를
              회수하고, 다음 참가자를 위해 데이터를 비울 수 있어야 한다 */}
          {UT_MODE ? (
            <div className="flex items-center justify-center gap-3 rounded-row border border-dashed border-line-strong bg-canvas-warm px-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  downloadUtExport();
                  showToast('UT 결과를 내려받았어');
                }}
                className="flex min-h-11 items-center justify-center text-meta text-ink-muted"
              >
                UT 결과 내보내기
              </button>
              <span className="text-ink-faint" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={() => setUtResetOpen(true)}
                className="flex min-h-11 items-center justify-center text-meta text-ink-muted"
              >
                다음 참가자를 위해 초기화
              </button>
            </div>
          ) : null}
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
          clearPreviewUnlocks();
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

      <ConfirmModal
        open={utResetOpen}
        title="다음 참가자를 위해 초기화할까?"
        description="이 참가자의 세션·UT 응답·History를 모두 지워. 먼저 'UT 결과 내보내기'로 내려받아 뒀는지 확인해."
        confirmLabel="초기화"
        onCancel={() => setUtResetOpen(false)}
        onConfirm={() => {
          reset();
          clearHistory();
          clearDeepReportUt();
          clearPremiumIntents();
          clearPreviewUnlocks();
          clearAiCache();
          setUtResetOpen(false);
          showToast('다음 참가자를 위해 초기화했어');
          router.push(ROUTES.splash);
        }}
      />
    </div>
  );
}
