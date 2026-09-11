'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BottomNavigation } from '@/components/common/BottomNavigation';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { SectionLabel } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { HomePremiumBundle } from '@/components/premium/HomePremiumBundle';
import { Lovy } from '@/components/lovy/Lovy';
import { BRAND, HOME_COPY, LENS_COPY } from '@/data/copy';
import { clearAiCache } from '@/services/ai/aiClient';
import { trackEvent } from '@/lib/analytics';
import { clearDeepReportUt } from '@/lib/deepReportUtStore';
import { UT_MODE } from '@/lib/env';
import { clearPreviewUnlocks, hasPreviewUnlock } from '@/lib/premiumAccess';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { hasPremiumEvidence } from '@/lib/logic/premiumChapters';
import { premiumFeatureState } from '@/services/premiumService';
import { useCrossSourceInsights } from '@/hooks/useAiNarrative';
import { clearPremiumIntents } from '@/lib/premiumIntentStore';
import { revisitHref } from '@/lib/resultView';
import { displayStateOf } from '@/lib/logic/mirror';
import { homeHeroSummary } from '@/lib/logic/profile';
import {
  jobAllowsOutwardAction,
  resolveRelationshipContext,
  resolveRelationshipStageOf,
} from '@/lib/logic/relationshipStage';
import { soloModeOf } from '@/lib/logic/soloMode';
import { ROUTES } from '@/lib/routes';
import { downloadUtExport } from '@/lib/utExport';
import {
  useCompatibility,
  useHistoryReport,
  useHomeHighlights,
  useMirror,
  useSoloHistoryReport,
} from '@/hooks/useAnalysis';
import { filterHistoryByAudience } from '@/lib/logic/soloHistory';
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
  /**
   * Solo 입구를 보여줄지 (v1.29 P4 §45).
   *
   * 조건 두 개다. **상대를 비교할 수 없고**(`soloModeOf`), **내 기준은 있다**
   * (`completed.profile`). 둘 중 하나만 봐서는 안 된다 — 기준이 없으면 리포트가
   * 만들어지지 않고, 상대가 있으면 궁합 결과와 겹친다.
   */
  const soloEntryVisible = answers.completed.profile && soloModeOf(answers) !== 'couple';
  /**
   * UT-1 P1-A §2 — 지금 **지울 상대 맥락이 있는가**. 하단 CTA의 라벨과 초기화 여부를
   * 이 값 하나로 가른다(판정 source는 `soloModeOf` 하나 — P0-A와 같은 규칙).
   */
  const hasTargetContext = soloModeOf(answers) !== 'no_target';
  /*
    v1.40 §37.16 — `ended`에서도 '새로운 사람과 궁합 보기'를 primary로 두지 않는다.

    v1.36 §17이 Solo에게 적용한 것과 **같은 판단**이다: 관계가 막 끝났다고 답한
    사용자의 Home에서 가장 큰 버튼이 다음 사람을 찾으라는 것이면, 화면이 사용자의
    상태와 반대 방향을 가장 크게 말한다. **버튼을 없애지 않는다** — 그 사이에 마음이
    달라질 수 있고, 새 상대 기능 자체는 그대로다. 위계만 낮춘다.
  */
  const reflecting = resolveRelationshipStageOf(answers) === 'ended';
  const newTargetSecondary = soloEntryVisible || reflecting;
  const { entries, latest, clearAll: clearHistory } = useHistory();
  const report = useHistoryReport();
  /**
   * Solo Retention (v1.35 · §14 ~ §16)
   *
   * ⚠️ **새 대형 카드를 만들지 않는다**(§15). 이미 있는 Solo 입구 행 안에서 caption
   * 한 줄만 실제 데이터로 바꾼다 — Home의 정보량과 시각적 균형을 그대로 둔다.
   *
   * ⚠️ **매일 오게 만드는 앱이 아니다**(§16). streak·연속 기록·'오늘도 기록' 같은
   * 어휘를 쓰지 않고, '생각이 달라졌다면 다시 관찰해볼까?'까지만 말한다.
   */
  const soloReport = useSoloHistoryReport();
  const soloEntryCount = filterHistoryByAudience(entries, 'solo').length;
  const coupleEntryCount = entries.length - soloEntryCount;
  /**
   * v1.46 PremiumLens §32 — Home 하단 Premium Bundle.
   *
   * ⚠️ **자격 판정을 Home이 새로 만들지 않는다.** 결과 화면과 같은
   * `hasPremiumEvidence` · `premiumFeatureState`를 그대로 부른다 — 두 벌이 되면
   * Home에서는 보이고 Paywall은 unavailable인 상태가 조용히 생긴다.
   */
  const crossSourceInsights = useCrossSourceInsights();
  const [priceVariant] = useState(() => resolvePriceVariant());
  const premiumBundleFeature = premiumFeatureState(
    'relationship_deep_report',
    resolvePrice(priceVariant),
    {
      deepReportAvailable: hasPremiumEvidence({
        insights: crossSourceInsights,
        declared: answers.declared,
        mirror,
      }),
      solo: soloModeOf(answers) === 'no_target',
      allowsOutwardAction: jobAllowsOutwardAction(resolveRelationshipContext(answers).job),
    },
  );
  /** CTA 문구만 바꾼다('열기' ↔ '보기'). 접근 권한 자체는 Paywall이 판단한다 */
  const bundleUnlocked = hasPreviewUnlock(
    'relationship_deep_report',
    answers.currentAnalysisMeta?.funnelAnalysisId ?? null,
  );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [utResetOpen, setUtResetOpen] = useState(false);
  /**
   * §30은 '전체 데이터 삭제 = Session + History'를 요구한다. 다만 축적된 관찰 기록을
   * 되돌릴 수 없게 지우는 건 무게가 다르므로, 기본값을 켠 상태로 두고 선택만 남겨뒀다.
   */
  const [alsoDeleteHistory, setAlsoDeleteHistory] = useState(true);

  /**
   * §14 — **실제 데이터가 있을 때만** 다른 문장을 쓴다.
   *
   *   0건       첫 관찰을 권한다
   *   1건       기억해뒀다는 사실만 말한다 (비교는 아직 없다)
   *   2건 이상  달라진 기준이 실제로 있으면 그 개수를 말한다
   *   3건 이상  반복 어휘는 `repeatable`(= `SOLO_REPEAT_MIN_OBSERVATIONS`)이 참일 때만
   *
   * ⚠️ 개수를 세는 것과 반복을 주장하는 것은 다르다(§8). 아래 `stable`은
   * `change.repeatable`을 직접 보므로, 2시점에서 '계속 보인다'고 말하지 않는다.
   */
  const soloRetentionLine = (() => {
    const changed = soloReport.comparable
      ? soloReport.changes.filter((change) => change.state === 'CHANGE').length
      : 0;
    const stable = soloReport.comparable
      ? soloReport.changes.filter((change) => change.state === 'STABLE' && change.repeatable).length
      : 0;

    if (soloEntryCount === 0) {
      return '상대가 없어도 네가 관계를 어떻게 생각하는지는 관찰할 수 있어. 첫 관찰을 남겨볼까?';
    }
    if (soloEntryCount === 1 && changed === 0 && stable === 0) {
      return '이때의 나를 기록해뒀어. 전에 남긴 기준과 비교해볼 수 있어.';
    }
    if (changed > 0) {
      return `지난 관찰과 달라진 기준이 ${changed}개 있어.`;
    }
    if (stable > 0) {
      return '몇 번의 관찰에서 계속 보인 기준이 있어.';
    }
    return '생각이 조금 달라졌다면 다시 관찰해볼까?';
  })();

  /** §27 — History 0개 / 1개 / 2개 이상 */
  const historyCta = (() => {
    if (entries.length === 0) {
      /**
       * ⚠️ v1.35 §30 — **갈 수 없는 길을 알려주지 않는다.** 상대도 관계 경험도 없는
       * 사용자에게 Mirror는 만들어지지 않으므로 "Mirror를 저장하면"은 거짓 안내였다.
       */
      return soloEntryVisible
        ? {
            title: '아직 저장된 관찰이 없어.',
            preview: '첫 관찰을 남기면 여기에 쌓여.',
            action: '시작',
            href: ROUTES.firstContact,
          }
        : {
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
    if (report.headline) {
      return {
        title: '지난 관찰과 달라진 신호가 있어.',
        preview: report.headline.note,
        action: '보기',
        href: ROUTES.historyReport,
      };
    }
    /**
     * ⚠️ v1.35 §10 — **커플 요약을 Solo 기록에 붙이지 않는다.**
     *
     * `report.summary`는 커플 기록만 보므로, Solo 관찰만 2건 저장한 사용자에게는
     * `러비가 기억하고 있는 관찰 2개` 아래에 "아직 저장된 관찰이 없어"가 붙었다(실측).
     */
    return {
      title: `러비가 기억하고 있는 관찰 ${entries.length}개`,
      preview: coupleEntryCount > 0 ? report.summary : soloRetentionLine,
      action: '보기',
      href: ROUTES.history,
    };
  })();

  /**
   * v1.44 NEW-002 — 우선순위 판단은 `homeHeroSummary()` 한 곳에 있다.
   * 근거가 없으면 성격을 단정하지 않고 '아직 근거가 부족하다'고 말한다.
   */
  const summary = homeHeroSummary({
    coreCorrection: answers.coreCorrection,
    profileCompleted: answers.completed.profile,
    mirrorSummary: mirror.core?.summary ?? null,
  });

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
          /**
           * ⚠️ v1.44 R-9 — 비교 근거가 없는 판정을 `CHANGE`라고 부르지 않는다.
           * 이 슬롯에는 **이미 중립 fallback이 있다**(아래 `?? '관찰'`) — 새 문구를
           * 만들지 않고 그 자리로 흘려보낸다.
           */
          state: (() => {
            const focus = mirror.insights.find((insight) => insight.key === mirror.teaser?.axisKey);
            if (!focus) return null;
            const shown = displayStateOf(focus.state, focus.evidenceScope);
            return shown === 'UNKNOWN' ? null : shown;
          })(),
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
              /*
                v1.36 A11y — 히트 영역만 44px로 올린다(§12.1 시각 높이와 터치 영역의 분리).
                아바타 원은 안쪽 span이 그리므로 **시각 크기는 32px 그대로**다 — 실측 32px이었다.
              */
              className="-m-1.5 flex h-11 w-11 items-center justify-center rounded-full"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-full bg-chip text-[11px] font-semibold text-ink-muted"
              >
                나
              </span>
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

          {/*
            v1.29 P4 §45 — Solo 재진입점.

            Home은 최근 궁합·Mirror를 중심으로 만들어져 있어서, 그 두 개가 없는
            사용자에게는 빈 화면처럼 보였다(P4 Audit). 상대가 없어도 다시 올 이유가
            있어야 하므로 여기 First Contact Report 입구를 둔다.

            ⚠️ 새 탭을 만들지 않는다(§46) — Home 안의 행 하나다. 그리고 커플 사용자에게는
            보이지 않는다: 최근 궁합이 있는 사용자에게 Solo 리포트를 권하면 방금 본 결과와
            무엇이 다른지 알 수 없다.
          */}
          {soloEntryVisible ? (
            <section className="flex flex-col gap-2.5">
              <SectionLabel>내 관계 관찰</SectionLabel>
              <button
                type="button"
                onClick={() => router.push(ROUTES.firstContact)}
                className="flex w-full items-center justify-between gap-3 rounded-row border border-line bg-surface p-[15px] text-left active:bg-sunken"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                    FIRST CONTACT REPORT
                  </span>
                  <span className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                    {soloRetentionLine}
                  </span>
                </span>
                <span className="flex-none rounded-[6px] bg-brand px-2.5 py-1.5 text-label font-semibold text-white">
                  보기
                </span>
              </button>
            </section>
          ) : null}

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

          {/*
            UT-1 P1-A §2 · §3 — **자리를 바꿨다. 늘리지 않았다.**

            여기에는 `내 관계 프로필 보기` 행이 있었는데, 그 행은 이 화면 헤더 우상단의
            아바타(`나`)와 **같은 목적지·같은 인자**였고(`revisitHref(profileResult,'home')`
            문자 그대로 동일), 하단 Navigation의 `나` 탭까지 합치면 같은 곳으로 가는
            진입점이 한 화면에 3개였다. 상시 chrome 2개(헤더 아바타 · 하단 탭)를 남기고
            본문 행만 뺀다.

            비워진 자리에 렌즈 허브를 둔다. UT-1에서 렌즈를 '찾기 어렵다'고 한 이유는
            진입점이 **궁합 결과 05 섹션 안**에만 있어서, 결과 화면을 지나쳤거나 상대가
            없는 사용자에게는 존재 자체가 보이지 않았기 때문이다. 이제 Home에서 1탭이다.

            ⚠️ 아래 Premium Bundle과 **파는 것이 다르다.** 이 행은 지금 무료로 볼 수 있는
            렌즈 허브(`/lens`)이고 Bundle은 그 렌즈들의 유료 상세다. 그래서 이 행에는
            가격을 붙이지 않는다 — 가격이 나오는 자리는 Bundle 헤더와 Paywall 둘뿐이다(§35).

            ⚠️ 문구를 새로 쓰지 않고 `LENS_COPY`를 그대로 읽는다. 같은 것을 화면마다 다른
            이름으로 부르지 않는다(P1-A §1 Audit 항목).
          */}
          <button
            type="button"
            onClick={() => {
              trackEvent('lens_hub_entry_click', { source: 'home' });
              router.push(ROUTES.lens);
            }}
            className="flex items-center justify-between gap-3 rounded-row border border-line bg-surface p-[15px] text-left active:bg-sunken"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                {LENS_COPY.badge}
              </span>
              <span className="text-[13.5px] font-medium keep-all">{LENS_COPY.title}</span>
              <span className="text-[12px] keep-all leading-relaxed text-ink-sub">
                {LENS_COPY.caption}
              </span>
            </span>
            <span className="flex-none rounded-[6px] bg-brand-tint px-2 py-1.5 text-label font-semibold text-brand-pressed">
              보기
            </span>
          </button>

          {/*
            v1.46 PremiumLens §32~§35 — Premium Bundle.

            ⚠️ **자리가 제품 결정이다.** History·프로필 다음, 그리고 '새로운 사람과
            궁합 보기' **앞**이다. 무료 결과를 다시 보는 길보다 위에 두면 Home이 상점이 되고,
            primary CTA 아래로 내리면 지금처럼 못 찾는 상태가 그대로 남는다.

            ⚠️ Button이 아니라 카드다 — Home의 primary를 이기지 않는다(§33 Guardrail).
          */}
          <HomePremiumBundle feature={premiumBundleFeature} unlocked={bundleUnlocked} />

          {/*
            새 분석 시작 — Revisit 기능이 생겼다고 이 CTA를 없애지 않는다(§46).

            ⚠️ v1.36 §17 — **Solo 사용자에게는 primary가 아니다.**
            지금 상대가 없다고 답한 사용자의 Home에서 유일한 primary Button이
            '새로운 사람과 궁합 보기'였다. 그 사용자의 다음 걸음은 First Contact
            관찰이고 그건 위의 작은 행에 있었으니, 화면이 사용자의 상태와 반대
            방향을 가장 크게 말하고 있던 것이다(실측). 버튼을 없애지 않고
            **위계만** 낮춘다 — 솔로라고 답했어도 그 사이에 누가 생길 수 있다.
          */}
          <div className="flex flex-col gap-1.5 pt-0.5">
            {/*
              UT-1 P1-A §2 — **라벨이 상태를 따라간다.**

              이 버튼은 지금까지 언제나 `새로운 사람과 궁합 보기`였다. 그런데 상대를 한
              번도 입력하지 않은 사용자에게는 `새로운`이 가리킬 이전 사람이 없다 —
              첫 분석인데 화면이 두 번째인 것처럼 말한다(UT-1 '복잡하다' 응답 지점).

              ⚠️ **그렇다고 항상 `관계 궁합 보기`로 바꾸면 안 된다.** 이 버튼은
              `resetTargetContext()`를 부른다 — 지금 상대를 지우는 파괴적 동작이다.
              상대가 있는 사용자에게 중립적인 라벨을 보여주면, '내 궁합 결과 다시 보기'로
              읽고 눌러서 입력을 잃는다. 그 사용자에게는 경고를 담은 기존 라벨을 유지한다
              (바로 아래 caption도 그 사실을 한 번 더 말한다).

              ⚠️ 그리고 **지울 게 없으면 지우지 않는다.** `no_target`에서 초기화를 부르면
              비우는 것은 없는데 `funnelAnalysisId`만 새로 발급된다 — 상대 없이 Self-only
              근거로 연 Premium 리포트의 entitlement가 그 순간 끊긴다(P0-A에서 고정한
              `hasPreviewUnlock(feature, analysisId)` 키가 바뀐다).
            */}
            <Button
              variant={newTargetSecondary ? 'secondary' : 'primary'}
              onClick={() => {
                if (hasTargetContext) resetTargetContext();
                router.push(ROUTES.target);
              }}
            >
              {hasTargetContext ? '새로운 사람과 궁합 보기' : '관계 궁합 보기'}
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
