'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/common/Button';
import { NoticeBox, SectionLabel } from '@/components/common/primitives';
import { AiNarrativeNotice, AiSourceLabel } from '@/components/ai/AiModeNotice';
import { PremiumActionPlanSection } from '@/components/premium/PremiumActionPlanSection';
import { PremiumCandidateSection } from '@/components/premium/PremiumCandidateSection';
import { PremiumChapterAccordion } from '@/components/premium/PremiumChapterAccordion';
import { PremiumLensSection } from '@/components/premium/PremiumLensSection';
import type { PremiumLensAi } from '@/hooks/usePremiumLensAi';
import { Lovy } from '@/components/lovy/Lovy';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { DEEP_REPORT_NARRATIVE_LOADING } from '@/data/premium';
import { hasCompletedDeepReport, markDeepReportCompleted } from '@/lib/deepReportUtStore';
import { LOVY_REPORT_POSE, LOVY_SIZE } from '@/lib/premiumLovy';
import type { AiFailureReason, AiMode, AiNarrativeStatus, RelationshipDeepReport } from '@/types';

/**
 * Relationship Deep Report — "러비의 정밀 관찰 리포트"
 *
 * v1.26 P3-3 — **연결(Connection) 중심으로 재편했다.**
 *
 * 왜: 무료가 v1.25에서 깊어지면서 "왜 ₩1,900을 내야 하지?"가 실제 제품 질문이 됐다.
 * Audit해보니 예전 IA의 두 섹션이 무료 문장을 **글자 그대로** 다시 보여주고 있었다 —
 * `궁합 심화 비교`(무료 SignalCard와 같은 `dimension.evidence`/`scene`)와
 * `실제로 일어날 수 있는 상황`(같은 `scene.watch`). 둘 다 제거했다.
 *
 * ══ v1.45 — **Chapter 구조로 다시 재편했다** ═══════════════════════════════
 *
 * v1.26의 IA(아래 예전 순서)를 고데이터 세션으로 실측한 결과가 재편의 근거다:
 *
 * ```
 * 예전 순서               실측 결과
 * 01 CORE PATTERN         유닛 12개가 제목 없이 한 줄로 나열됐다
 * 02 CONNECTIONS          같은 축이 최대 4번 반복됐다 (contact ×4 · conflict ×4)
 * 03 SINGLE NOTES         cs_history_change_* 3개가 04 HISTORY와 중복이었다
 * 04 HISTORY              (같은 비교를 두 번 보여줬다)
 * 05 TRY THIS
 * 06 FINAL                overview.topSummaries는 계산만 되고 그려지지 않았다
 * ```
 *
 * 즉 문제는 분량이 아니라 **구조**였다. 지금 순서:
 *
 * ```
 * 01 HEADER      리포트 규모 — 펼치기 전에 Chapter N개가 보인다
 * 02 SUMMARY     가장 중요한 연결 1~3개 (새로 만들지 않는다 — Chapter Top의 preview)
 * 03 CHAPTERS    Accordion. 각 Chapter = 근거 + 본문 + 강조 + 확인해볼 것 + 경계
 * 04 OMITTED     이번에 만들지 않은 연결 (Chapter 수에 포함하지 않는다)
 * 05 LIMITS      이 리포트의 한계
 * ```
 *
 * 데이터가 없는 섹션은 만들어내지 않고 **숨긴다** — 그래서 이 파일은 각 섹션을
 * 조건부로만 렌더한다.
 *
 * ⚠️ **이 파일은 문장을 만들지 않는다.** 제목·본문·강조·근거·경계 전부
 * `report.chapters`에 이미 들어 있다(`logic/premiumChapters.ts`). 화면이 문장을
 * 만들면 fixture가 볼 수 없는 자리가 생기고, v1.41 §39.9가 정확히 그 자리에서
 * 시제를 놓쳤다.
 *
 * `analysisId`는 Deep Report UT 응답을 이 분석에 묶어두는 키다(§20) — Compatibility/Mirror/
 * History 계산에는 전혀 쓰이지 않는다.
 */
export function RelationshipDeepReportView({
  report,
  analysisId,
  funnelAnalysisId,
  accessMode = 'preview',
  header,
  reveal = false,
  aiNarrative,
  lensAi,
}: {
  report: RelationshipDeepReport;
  /**
   * v1.26 — `resolverContext`를 더 이상 받지 않는다. 근거 해석은
   * `buildConnections`(리포트 조립 시점)가 끝내고 `DeepConnection.evidence`에 담아준다 —
   * 화면이 근거를 다시 해석하지 않는다.
   */
  analysisId: string;
  /**
   * v1.19 §3 — Premium Funnel(entry_view → … → purchase_intent)이 쓰는 것과 같은 키.
   * Hook에서 시작한 Funnel과 이 리포트의 열람/완독/사후 평가를 GA4에서 이어 붙이려면
   * 두 구간이 같은 값을 갖고 있어야 한다. 위 analysisId는 declared/experience 기반
   * deterministic fingerprint라 의미가 다르므로 대체하지 않고 나란히 보낸다.
   */
  funnelAnalysisId?: string | null;
  /**
   * v1.10 §72 — 실제 Payment로 오해되지 않도록 어느 경로로 이 화면에 왔는지 남긴다.
   * vNext — `payment`를 추가했다. **아직 도달 경로가 없다**(PG 미연결) — 실제 결제가
   * 붙었을 때 `access_mode`로 preview/UT와 구분하기 위한 자리다(`lib/premiumAccess.ts`).
   */
  accessMode?: 'payment' | 'demo_unlock' | 'preview' | 'beta_ut';
  /**
   * vNext — 리포트 맨 위에 놓을 Report Header 슬롯. Unlock 직후의 `/premium`에서
   * v1.20 `ReportShell`의 `ReportHeader`를 넘겨, 무료 관찰 보고서와 같은 디자인 언어로
   * '러비가 만든 산출물'처럼 읽히게 한다. 넘기지 않으면 기존 동작 그대로다.
   */
  header?: ReactNode;
  /**
   * vNext — 섹션을 위에서부터 짧게 stagger해서 등장시킨다(`.report-reveal`).
   * ⚠️ 콘텐츠를 늦게 만들거나 늦게 가져오지 않는다 — 렌더 순서만 조절한다.
   */
  reveal?: boolean;
  /**
   * v1.17 — Cross-source Insight Narrative 생성 상태. 무료 화면(S22/S27/S28/F2)의
   * `AiNarrativeNotice`/`AiSourceLabel`와 같은 컴포넌트를 재사용한다 — 대가를 지불한
   * 화면이라 실패 시에는(§10) `retry`로 재시도 버튼까지 보여준다는 점만 다르다.
   * 넘기지 않으면(개발용 Preview 등) 배지·안내를 그리지 않는다 — 기존 동작 그대로다.
   */
  aiNarrative?: {
    status: AiNarrativeStatus;
    reason: AiFailureReason | null;
    mode: AiMode | null;
    retry: () => void;
  };
  /**
   * v1.46 AI Lens §30 — 렌즈별 AI 해석 상태.
   *
   * ⚠️ **optional이다.** 넘기지 않으면 렌즈 섹션은 v1.46 PremiumLens와 똑같이
   * 결정론 결과만 그린다 — `aiNarrative`가 v1.17에 들어올 때 세운 것과 같은 규칙이다.
   */
  lensAi?: PremiumLensAi;
}) {
  /**
   * §45 — `deep_report_view`/`deep_report_complete`의 의미(분모/분자)는 바꾸지 않는다.
   * `insight_count`가 세는 대상만 새 구조에서 다시 센다.
   *
   * v1.45 — **Chapter 수를 센다.** v1.26이 `relationshipSelf`+`crossSourceInsights`에서
   * `corePattern`+`connections`+`singleSourceNotes`로 세는 대상을 옮긴 것과 같은
   * 종류의 변경이다: 이벤트의 의미('이 리포트에 유닛이 몇 개였나')는 그대로이고
   * **화면에 실제로 그려지는 단위**가 Chapter로 바뀌었다.
   */
  const chapterTotal = report.chapters.length;

  /**
   * 화면에 실제로 그려진 AI 문장이 있는가 (v1.28)
   *
   * `PremiumChapterAccordion`은 `chapter.narrativeText`가 null이면 그 문단을 아예
   * 그리지 않는다. 그러니 배지의 근거도 같은 값이어야 한다 — `mode`만 보고 붙이면
   * Quality Gate가 문장을 전부 떨어뜨린 경우에 **없는 것을 있다고 표시**한다.
   */
  const hasRenderedAiNarrative = report.chapters.some((chapter) =>
    Boolean(chapter.narrativeText),
  );

  const viewSent = useRef(false);
  const [completed, setCompleted] = useState(false);
  const scrollDepthSent = useRef<{ 50: boolean; 100: boolean }>({ 50: false, 100: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const attribution: Record<string, string> = funnelAnalysisId
    ? { funnel_analysis_id: funnelAnalysisId }
    : {};

  useEffect(() => {
    // v1.19 §13 — UT 5문항 완료(`completedAt`)가 아니라 **리포트 완독**을 복원한다.
    // Production에는 UT 5문항이 없어서 예전 조건으로는 새로고침마다 완독이 초기화됐고,
    // 그러면 `deep_report_complete`가 중복 발생해 Completion Rate가 부풀었다.
    setCompleted(hasCompletedDeepReport(analysisId));
  }, [analysisId]);

  /**
   * Release Gate §3 — `deep_report_view`의 의미를 좁힌다.
   *   "사용자가 **유효한 Deep Report 콘텐츠를 볼 수 있는 상태**에서 리포트가 렌더됐다"
   *
   * 이전에는 이 effect가 아래 `if (!report.available) return`보다 **위**에 있어서, 연결할
   * 신호가 부족해 안내 문구만 보여주는 경우에도 view가 1건 발생했다. 그러면 Completion
   * Rate(`deep_report_complete / deep_report_view`)의 분모에 **완독할 콘텐츠가 애초에 없던
   * 세션**이 섞여서 완독률이 실제보다 낮게 나온다. 분모와 분자가 같은 eligible population을
   * 쓰도록 available일 때만 보낸다.
   *
   * 새 이벤트(예: deep_report_unavailable)는 만들지 않는다 — 그 상태는 이미 Paywall 쪽
   * `premiumFeatureState`의 unavailable 분기(가격·CTA 미노출)로 관측할 수 있고, 이벤트를
   * 늘리는 것보다 기존 Funnel을 깨끗하게 두는 편이 낫다.
   *
   * ⚠️ Release Gate §1 — `analysis_id`(deterministic fingerprint)를 더 이상 보내지 않는다.
   * 분석 단위 연결은 opaque한 `funnel_analysis_id`(attribution)가 맡는다.
   */
  useEffect(() => {
    if (!report.available) return;
    if (viewSent.current) return;
    viewSent.current = true;
    trackEvent('deep_report_view', {
      access_mode: accessMode,
      // §45 — 이벤트의 의미(분모/분자)는 그대로다. 세는 대상만 새 구조에서 다시 센다.
      insight_count: chapterTotal,
      ...attribution,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.available, chapterTotal, accessMode, funnelAnalysisId]);

  // §49 — 50/100 두 단계만. 이 화면의 스크롤 조상(ScreenLayout의 overflow-y-auto body)을 찾는다.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let scrollParent: HTMLElement | null = root.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      const style = window.getComputedStyle(scrollParent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent || scrollParent === document.body) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollParent as HTMLElement;
      if (scrollHeight <= clientHeight) return;
      const percent = ((scrollTop + clientHeight) / scrollHeight) * 100;
      if (percent >= 100 && !scrollDepthSent.current[100]) {
        scrollDepthSent.current[100] = true;
        trackEvent('deep_report_scroll', { ...attribution, depth: 100 });
      } else if (percent >= 50 && !scrollDepthSent.current[50]) {
        scrollDepthSent.current[50] = true;
        trackEvent('deep_report_scroll', { ...attribution, depth: 50 });
      }
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollParent?.removeEventListener('scroll', handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelAnalysisId]);

  if (!report.available) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        {/*
          ⚠️ v1.45 — 예전에는 이 자리에 `limitations[0]`(일반 면책 문구)만 있었다.
          Sparse 세션 실측에서 화면에 남은 문장이 "이 리포트는 네가 입력한 데이터를
          서로 연결해 본 관찰이야"뿐이었다 — **왜 아무것도 없는지를 말하지 않았다.**

          이제 헤드라인(= 연결이 부족하다)과 `omissions`(= 무엇이 더 쌓이면 열리는지)를
          함께 보여준다. 없는 것을 팔지 않으면서, 없는 이유는 알려준다(§14.1).
        */}
        {/*
          §28 — Sparse에는 **자료를 모아 든 러비(`connect`)를 쓰지 않는다.** 근거가
          부족한 화면에 자료 뭉치를 든 그림을 놓으면 '많이 찾았다'로 읽힌다. 축하·하트
          계열은 애초에 이 리포트 어디에도 쓰지 않는다.
        */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Lovy pose="question" size={LOVY_SIZE.reportHeader} decorative />
            <h2 className="min-w-0 text-section keep-all font-semibold">
              {report.overview.headline}
            </h2>
          </div>
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
            {report.overview.subcopy}
          </p>
          {/* §11 — 없는 것을 채우지 않는다는 약속을 러비의 말로 남긴다(고정 문구) */}
          <p className="text-[12px] keep-all leading-relaxed text-ink-muted">
            모르는 건 억지로 채우지 않을게.
          </p>
        </section>
        {report.omissions.length > 0 ? (
          <ul className="flex flex-col gap-2 rounded-card border border-dashed border-line-strong bg-sunken p-4">
            {report.omissions.map((item) => (
              <li key={item.id} className="text-[12px] keep-all leading-relaxed text-ink-sub">
                {item.text}
              </li>
            ))}
          </ul>
        ) : null}
        <NoticeBox>
          {report.limitations[0] ?? '아직 연결해서 볼 수 있는 신호가 부족해.'}
        </NoticeBox>
      </div>
    );
  }

  const handleReportComplete = () => {
    // 이미 완독으로 기록된 분석이면 이벤트를 다시 쏘지 않는다(§13/§14 C).
    if (!hasCompletedDeepReport(analysisId)) {
      trackEvent('deep_report_complete', { access_mode: accessMode, ...attribution });
      markDeepReportCompleted(analysisId);
    }
    setCompleted(true);
  };

  return (
    <div ref={rootRef} className={cn('flex flex-col gap-6', reveal && 'report-reveal')}>
      {header}

      {/*
        01 Overview — §11 · §12 **러비가 리포트를 시작한다.**

        ⚠️ 헤드라인 숫자는 그대로 `report.overview.headline`이다(실제 Chapter 수).
        여기서 새로 세지 않는다 — v1.45가 고친 '헤더 숫자와 화면 개수 불일치'를
        화면에서 되살리지 않는다.

        ⚠️ 캐릭터는 `flex-none` 84px이고 텍스트가 남은 폭을 전부 쓴다. 393px에서
        제목이 캐릭터보다 시각적으로 우선이어야 한다(§12 · §26).
      */}
      {/*
        ══ v1.46.4 §6 — 첫 viewport는 **Executive SO WHAT**이다 ═══════════════

        v1.46.3까지 이 자리의 첫 문장은 `러비가 이번 관찰에서 연결한 이야기 8개`
        (= 규모)였고, 그 아래 요약 3줄도 전부 `자료 4종을 나란히 놓고 본 결과야`처럼
        **어떻게 봤는지**를 말했다. 실측에서 첫 화면에 '그래서 이 관계에서 무엇이
        중요한가'가 한 줄도 없었다 — 1,900원의 값이 첫 화면에서 보이지 않는다는
        사후 검토 지적이 정확히 이 자리다.

        지금 순서: **SO WHAT 3줄 → 규모 → 근거(Chapter)**.

        ⚠️ 여기서 문장을 만들지 않는다. `report.executive`는 `premiumService`가
        `lib/premiumSoWhat.ts`로 만든 값이고 화면은 배치만 한다.
        ⚠️ 재료가 없으면 이 블록이 통째로 없다 — 3줄을 채우려고 빈칸을 만들지 않는다.
      */}
      {/*
        ══ v1.46.4 §22 — **주인공은 Candidate다** ═════════════════════════════

        v1.46.4 초안은 이 자리에 Executive 3줄(`strength` / `watch` / `ask`)을 뒀다.
        방향은 맞았지만 그 3줄은 여전히 **kind 고정문**에서 나왔다 — 근거가 8종인
        사용자와 2종인 사용자가 같은 문장을 받았다(§15 · §48).

        지금 이 자리는 `report.candidates`다. 같은 축·같은 판정이어도 근거 조합과
        연결된 장면이 다르면 문장이 다르다.

        ⚠️ Executive는 **지우지 않고 아래로 내렸다.** 없앨 이유가 없다 — `strength`
        (잘 맞는 지점)는 Candidate가 다루지 않는 정보이고, Candidate가 하나도 없는
        세션에서는 Executive가 첫 자리를 지킨다.
      */}
      {report.candidates.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Lovy
              pose={LOVY_REPORT_POSE}
              size={LOVY_SIZE.reportHeader}
              decorative
              priority
              float
            />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[11px] font-semibold keep-all leading-snug text-mint-ink">
                이번엔 한 조각씩 보는 게 아니라, 서로 연결해봤어.
              </p>
              <h2 className="text-section keep-all font-semibold">이번 관계에서 먼저 볼 것</h2>
            </div>
          </div>
          <PremiumCandidateSection
            candidates={report.candidates}
            chapters={report.chapters}
            scenes={report.reportedScenes?.scenes ?? []}
            lenses={report.lensBundle.lenses}
          />
        </div>
      ) : null}

      {/*
        v1.46.4 Action Layer §18 · §19 — Top 3 **아래 단일 블록.** 카드마다 붙이지 않는다.
        ⚠️ 문장을 만들지 않는다 — `report.actionPlan`은 `buildPremiumActionPlan`이 조립한 값이다.
      */}
      {report.actionPlan && report.candidates.length > 0 ? (
        <PremiumActionPlanSection plan={report.actionPlan} />
      ) : null}

      {/*
        ══ Executive는 **Candidate가 없을 때의 자리**다 ═════════════════════

        ⚠️ 처음에는 둘을 나란히 뒀고, 브라우저 실측에서 첫 화면이 이렇게 됐다:

        ```
        이번엔 한 조각씩 보는 게 아니라, 서로 연결해봤어.
        이번 관계에서 먼저 볼 것          ← Candidate 헤더
        이번 관계에서 중요한 것
        먼저 볼 것부터 정리했어
        … 카드 3개 …
        이번엔 한 조각씩 보는 게 아니라, 서로 연결해봤어.   ← 같은 줄이 또
        이번 관계에서 먼저 볼 것                            ← 같은 제목이 또
        ```

        같은 도입부가 한 화면에 두 번 있었다. 둘 다 '먼저 볼 것'을 말하니 당연한
        결과다 — 역할이 겹쳤다.

        Candidate가 이 역할을 더 잘한다(근거 조합에서 조립되고, 질문과 근거 토글을
        함께 들고 있다). 그래서 Executive는 **재료가 없어 Candidate를 만들지 못한
        세션의 대체 블록**으로 내렸다. 지우지 않은 이유는 그 세션에서도 첫 화면이
        비어 있으면 안 되기 때문이다.
      */}
      {report.candidates.length === 0 && report.executive ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Lovy
              pose={LOVY_REPORT_POSE}
              size={LOVY_SIZE.reportHeader}
              decorative
              priority
              float
            />
            <div className="flex min-w-0 flex-col gap-1">
              {/* 고정 문구 — 이 리포트가 무료와 다른 점을 한 줄로 말한다(새 판정 아님) */}
              <p className="text-[11px] font-semibold keep-all leading-snug text-mint-ink">
                이번엔 한 조각씩 보는 게 아니라, 서로 연결해봤어.
              </p>
              <h2 className="text-section keep-all font-semibold">{report.executive.title}</h2>
            </div>
          </div>

          <ol className="flex flex-col gap-2">
            {report.executive.items.map((item, index) => (
              <li
                key={item.slot}
                className="flex flex-col gap-1.5 rounded-card border border-line bg-surface px-4 py-3.5"
              >
                <div className="flex items-baseline gap-2">
                  <span className="flex-none text-[11px] font-semibold tnum text-ink-faint">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="min-w-0 text-[10.5px] font-semibold tracking-[0.04em] text-mint-ink">
                    {item.label}
                  </p>
                </div>
                {/* ① SO WHAT — 이 화면에서 가장 큰 글자다. 근거보다 먼저 온다 */}
                <p className="text-[13.5px] font-semibold keep-all leading-relaxed">{item.text}</p>
                {/* ② WHY IT MATTERS — 없으면(ask) 이 줄이 없다 */}
                {item.whyItMatters ? (
                  <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                    {item.whyItMatters}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/*
        01 Overview — **규모는 SO WHAT 다음이다.**

        ⚠️ 숫자는 그대로 `report.overview.headline`(실제 Chapter 수)이다. 여기서 새로
        세지 않는다 — v1.45가 고친 '헤더 숫자와 화면 개수 불일치'를 되살리지 않는다.
        ⚠️ Executive가 없을 때(= 재료 부족)는 이 블록이 러비와 함께 첫 자리에 선다.
      */}
      <section className="flex flex-col gap-2">
        {report.executive ? (
          /*
            ⚠️ Executive가 있으면 **헤드라인을 다시 적지 않는다.** 화면 맨 위
            `ReportHeader`가 이미 `이야기 8개를 연결한 관찰 기록`으로 같은 규모를
            말하고 있어서, 여기 한 번 더 적으면 한 화면에 같은 숫자가 세 번 나온다
            (실측). 규모의 근거인 subcopy(어떤 자료를 이었는지)만 남긴다.
          */
          null
        ) : (
          <div className="flex items-center gap-3">
            <Lovy
              pose={LOVY_REPORT_POSE}
              size={LOVY_SIZE.reportHeader}
              decorative
              priority
              float
            />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[11px] font-semibold keep-all leading-snug text-mint-ink">
                이번엔 한 조각씩 보는 게 아니라, 서로 연결해봤어.
              </p>
              <h2 className="text-section keep-all font-semibold">{report.overview.headline}</h2>
            </div>
          </div>
        )}
        <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
          {report.overview.subcopy}
        </p>
      </section>

      {/*
        v1.17 — AI 상태 배지/실패 안내는 §02/§03 어느 한쪽에 종속시키지 않는다.
        `deepNarrative`는 relationshipSelf·crossSourceInsights 카드 전부에 공통으로 적용되는데,
        표본에 따라 모든 Insight가 §02(Relationship Self)로만 분류돼 §03이 통째로 숨는
        경우가 있다(Target을 가로지르는 연결이 하나도 없을 때) — 그 상태에서 실패 배지를
        §03 안에만 두면 실패해도 화면에 **아무 표시도 없이** 조용히 규칙 요약만 보여주게
        된다. Insight 카드가 하나라도 있으면(§02 또는 §03) 항상 여기서 보여준다.
      */}
      {aiNarrative && chapterTotal > 0 ? (
        <div className="flex flex-col gap-2">
          {/*
            ⚠️ v1.27 — **화면에 AI 문장이 실제로 있을 때만 라벨을 붙인다.**

            `mode`만 보고 붙이면 안 된다. Provider는 성공했지만 Quality Gate가 문장을
            전부 떨어뜨린 경우(v1.27 (F) 중복 게이트 · 안전 검사) `mode`는 'real'인데
            화면에는 규칙 문장만 남는다. 그 상태에서 'AI 설명' 라벨만 떠 있으면 **없는
            것을 있다고 표시하는 것**이다 — 이 제품에서 가장 하면 안 되는 종류의 거짓이다.

            `status === 'ready'`는 narratives가 1개 이상일 때만 된다(`deepReportHasItems`).
            전부 떨어졌으면 status는 'unavailable'이고 reason은 null이라 아래 Notice도
            조용하다 — demo와 같은 결말이다. 규칙 리포트만으로 완결되므로 그게 맞다.
          */}
          {/*
            v1.28 — 판정을 `status`가 아니라 **화면에 실제로 그려진 문장**으로 바꿨다.
            `status === ready`는 narrative가 1개 이상 돌아왔다는 뜻일 뿐이라, 그 문장이
            지금 그려지는 연결에 붙지 못하면 여전히 배지만 남는다. Compatibility와
            같은 규칙을 쓴다 — 배지는 `지금 여기 AI 문장이 있다`를 뜻한다.
          */}
          <AiSourceLabel
            mode={aiNarrative.mode}
            hasNarrative={hasRenderedAiNarrative}
            className="self-end"
          />
          <AiNarrativeNotice
            task="deep-report-narrative"
            status={aiNarrative.status}
            reason={aiNarrative.reason}
            onRetry={aiNarrative.retry}
            loadingCopy={DEEP_REPORT_NARRATIVE_LOADING}
          />
        </div>
      ) : null}

      {/*
        ══ v1.46.4 §17 — 02 REPORT SUMMARY를 **제거했다** ════════════════════

        v1.45의 이 자리는 `이번 리포트에서 가장 중요한 연결` 3줄이었고, 내용은 앞쪽
        Chapter 3개의 `deterministicTakeaway`를 그대로 옮긴 preview였다. 고데이터
        실측에서 그 3줄은 이런 문장이었다:

        ```
        네가 말한 기준과 관계에서 나타난 연락은 서로 다른 방향을 가리켰어
          — 자료 4종을 나란히 놓고 본 결과야.
        따로 물어본 두 기준인데 서로 다른 방향을 가리켰어 …(자료 5종).
        ```

        즉 **무엇을 알게 됐는지가 아니라 몇 종을 어떻게 봤는지**였고, 바로 아래
        Accordion을 펼치면 같은 문장이 한 번 더 나왔다(중복). 그 역할은 이제 위의
        Executive SO WHAT이 가져갔고, '리포트에 무엇이 들어 있는지'는 Accordion
        헤더(`01/8 · 연락 · 자료 4종`)가 접힌 상태에서 이미 보여준다.

        ⚠️ 정보를 줄인 게 아니라 **같은 말을 두 번 하지 않게 한 것**이다.
      */}
      {/*
        02.5 네가 알려준 장면 (v1.46 §12) — **관계 맥락.**

        ⚠️ **Chapter가 아니다.** 섹션 라벨 옆에 개수를 붙이지 않고, `전체 N개`
        (Chapter 수)와 나란히 세지 않는다. 이 블록이 하는 일은 사용자가 직접 알려준
        기억을 그대로 되짚는 것뿐이고, 서로 독립적인 자료 2종을 이은 연결이 아니다
        (`approachInsight`와 같은 위계 · §8).

        ⚠️ Chapter **앞**에 둔다. 연결 리포트를 읽기 전에 '내가 알려준 맥락'이 먼저
        보여야 그 뒤 문장들이 무엇을 배경으로 하는지 알 수 있다. 반대로 뒤에 두면
        사용자가 이미 다 읽은 다음에 자기 입력을 확인받는 순서가 된다.

        ⚠️ **여기서 문장을 만들지 않는다.** `fact`·`interpretation`·`limitation`·
        `lovyNote` 전부 `buildReportedScenes`(logic)가 만든 값이고 화면은 배치만 한다.
      */}
      {report.reportedScenes ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel>{report.reportedScenes.title}</SectionLabel>

          <ul className="flex flex-col gap-2">
            {report.reportedScenes.scenes.map((scene) => (
              <li
                key={scene.id}
                className="flex flex-col gap-1.5 rounded-card border border-line bg-surface px-4 py-3.5"
              >
                <p className="text-[10.5px] font-semibold tracking-[0.04em] text-mint-ink">
                  {scene.typeLabel}
                </p>
                {/*
                  FACT — 사용자가 입력한 문장 **그대로**. 다듬지 않는다(§10).
                  따옴표는 이것이 인용이라는 표시다.
                */}
                <p className="text-[13.5px] font-semibold keep-all leading-snug">
                  {`'${scene.fact}'`}
                </p>
                {scene.myReaction ? (
                  <p className="text-[12px] keep-all leading-relaxed text-ink-sub">
                    그때 나는 · {scene.myReaction}
                  </p>
                ) : null}
                {/* INTERPRETATION — 주어가 항상 사용자다. 상대의 의도로 넘어가지 않는다 */}
                <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                  {scene.interpretation}
                </p>
              </li>
            ))}
          </ul>

          {/* 러비 체크포인트 (§12 우선순위 3) */}
          <div className="flex items-center gap-2.5 rounded-card bg-mint-tint px-4 py-3">
            <Lovy pose="note" size={36} decorative />
            <p className="text-[11.5px] keep-all leading-relaxed text-mint-ink">
              {report.reportedScenes.lovyNote}
            </p>
          </div>

          {/* 경계 — **항상 보인다.** 이 블록에서 가장 중요한 한 줄이다(§35) */}
          <p className="text-[11px] keep-all leading-relaxed text-ink-faint">
            {report.reportedScenes.limitation}
          </p>
        </section>
      ) : null}

      {/*
        03 CHAPTERS (§13.1) — Accordion.

        ⚠️ **전체 N개가 사용자가 펼치기 전에 보여야 한다.** 섹션 라벨 옆의 `N개 챕터`와
        각 header의 `02/8`이 그 역할을 한다. 숫자는 하드코딩이 아니라 실제 배열 길이다.
      */}
      {report.chapters.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <SectionLabel>관계 연결 리포트</SectionLabel>
            <span className="text-[11px] font-semibold tnum text-ink-muted">
              전체 {report.chapters.length}개
            </span>
          </div>
          <PremiumChapterAccordion
            chapters={report.chapters}
            tense={report.tense}
            allowsOutwardAction={report.allowsOutwardAction}
            funnelAnalysisId={funnelAnalysisId}
          />
        </section>
      ) : null}

      {/*
        Target Preference × 상대 축 × 내 축 (v1.15 §5).

        ⚠️ Chapter로 만들지 않았다. 이 문장은 cross-source **연결**이 아니라 무료 힌트가
        왜 지금 이 관계 맥락에서 의미가 있는지를 말하는 보조 블록이고, Chapter로 올리면
        근거 2종 규칙을 만족하지 못한 것을 Chapter라고 부르게 된다(§8).
        `ended`에서는 애초에 null이다(`allowsOutwardAction`).
      */}
      {report.approachInsight ? (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>상대 정보 · 관계 신호 연결</SectionLabel>
          <p className="text-[13px] font-medium keep-all">{report.approachInsight.title}</p>
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
            {report.approachInsight.text}
          </p>
        </section>
      ) : null}

      {/*
        v1.46 PremiumLens §36 — **관계 렌즈 3종 + Cross-Lens.**

        ⚠️ 자리가 곳 자체가 제품 결정이다. 렌즈는 Chapter·상대 정보 연결 **다음**이고
        가장 위가 아니다 — Core를 대체하지 않는다는 §3을 IA로 지키는 방법이다.
        반대로 '리포트의 한계'보다는 위다 — 마무리 문구 뒤에 내용이 또 나오면 끝이 두 번이 된다.

        ⚠️ `available` 게이트에 걸지 않는다 — 이 화면이 그려지는 순간 이미 리포트가 열린
        상태고, 번들은 그 결제 하나로 함께 열린다(§2 · LENS-01).
      */}
      {/*
        v1.46.2 §Navigation — 펼쳐둔 렌즈는 돌아왔을 때도 펼쳐져 있어야 한다.
        스크롤 위치만 되돌리고 카드가 접혀 있으면 그 위치의 내용이 달라진다.
        `funnelAnalysisId`가 없는 개발용 화면에서는 보관하지 않는다.
      */}
      <PremiumLensSection
        bundle={report.lensBundle}
        ai={lensAi}
        stateKey={funnelAnalysisId ? `premium-lens:${funnelAnalysisId}` : undefined}
      />
      {/*
        04 이번에 만들지 않은 것 (§14.1)

        ⚠️ **Chapter 수에 포함하지 않는다.** 그리고 locked teaser가 아니다 — 결제로
        열리는 것이 아니라 데이터가 쌓이면 열린다. 그래서 자물쇠 아이콘도, 개수도
        붙이지 않는다.
      */}
      {report.omissions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>아직 만들지 않은 연결</SectionLabel>
          <ul className="flex flex-col gap-2 rounded-card border border-dashed border-line-strong bg-sunken p-4">
            {report.omissions.map((item) => (
              <li key={item.id} className="text-[12px] keep-all leading-relaxed text-ink-sub">
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.limitations.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>이 리포트의 한계</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {report.limitations.map((item) => (
              <li key={item} className="flex gap-2 text-[12px] keep-all leading-relaxed text-ink-sub">
                <span className="flex-none text-ink-faint" aria-hidden>
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* v1.10 §48 — 여기가 '리포트를 다 봤다'의 정의다(explicit CTA, viewport 노출 아님). */}
      <Button variant="secondary" onClick={handleReportComplete} disabled={completed}>
        {completed ? '확인 완료' : '다 봤어'}
      </Button>

      {/*
        ══ v1.48.1 — **리포트 뒤 설문을 참가자 화면에서 걷어냈다** ═══════════════

        여기 두 가지가 있었다.

        ```
        DeepReportValueCheck  1~5 가치 평가 + 3지선다 지불 의향.
                              `UT_MODE` 게이트가 **없어서 일반 사용자에게도 보였다**
        DeepReportUtFlow      BottomSheet 5문항 설문. 완독 CTA를 누르면 자동으로 떴다
        ```

        둘 다 제품 기능이 아니라 연구 계측이다. 특히 후자는 리포트를 다 읽은 순간
        설문지가 화면을 덮는 구조여서, 제품의 마지막 인상이 '평가해 주세요'였다.

        ⚠️ **완독 자체는 그대로다.** 위 `다 봤어` CTA와 `deep_report_complete`
        이벤트는 제품 지표라 남겼다 — 사라진 것은 그 뒤에 따라오던 설문뿐이다.
        ⚠️ 가격/가치 문항은 운영자 화면(`/ut`)에 같은 이벤트 이름으로 있다.
        ⚠️ 두 컴포넌트는 삭제했고, 문항은 `ut_deep_report_missing_value`(자유서술)
        하나만 빼고 전부 운영자 화면으로 옮겨 **이벤트 이름 그대로** 남아 있다.
      */}
    </div>
  );
}
