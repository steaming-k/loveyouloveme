'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { FillDataRow } from '@/components/common/StateScreens';
import { NoticeBox, PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import {
  MbtiAxisField,
  MbtiAxisSummary,
  MbtiSelfAxisField,
} from '@/components/compatibility/MbtiLensPanel';
import { LensCoreBridge } from '@/components/lens/LensCoreBridge';
import { MbtiBridgeSection } from '@/components/lens/MbtiBridgeSection';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LovyNote } from '@/components/lovy/LovyNote';
import {
  ReportHeader,
  ReportSection,
  ReportSectionEyebrow,
} from '@/components/report/ReportShell';
import { MBTI_LENS_COPY } from '@/data/copy';
import { selectMbtiLensHeadline } from '@/data/lovyNotes';
import { trackEvent } from '@/lib/analytics';
import { buildMbtiSelfLens } from '@/lib/logic/mbtiLens';
import { hasPremiumEvidence } from '@/lib/logic/premiumChapters';
import { soloModeOf } from '@/lib/logic/soloMode';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { premiumFeatureState } from '@/services/premiumService';
import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';
import { useCrossSourceInsights } from '@/hooks/useAiNarrative';
import { useMbtiBridge, useMbtiLens, useMbtiPattern, useMirror } from '@/hooks/useAnalysis';
import {
  jobAllowsOutwardAction,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { useRevealOnceInScreen } from '@/hooks/useRevealOnce';
import { useSession } from '@/state/SessionProvider';
import type {
  MbtiBridgeReport,
  MbtiLensReport,
  MbtiPatternReport,
  MbtiSelfLens,
} from '@/types';

/**
 * X1-a MBTI Lens — Compatibility Lens **Detail** Screen
 *
 * v1.24 P3-1 — **'Hook은 익숙하게, 해석은 다르게.'**
 *
 * 이 화면은 내 MBTI를 처음 입력하는 곳이 아니다(그건 S13 Declared Me 마지막). 여기서는
 * 익숙한 조합(INFP × ESTJ)으로 들어오게 한 다음, 읽어 내려갈수록 **실제 관계 답변**과
 * 나란히 놓여 '성향만으로는 설명되지 않는 지점'이 드러나게 한다:
 *
 *   01 MBTI LENS        조합 · 축 한눈 요약 · 한 문장   ← 익숙한 Hook (첫 viewport)
 *   02 PATTERN          조합 패턴 + 러비 관찰 + 확인해볼 질문 (v1.25 P3-2)
 *   03 BUT IN REAL LIFE 성향 렌즈 vs 네가 답한 관계 신호 ← 차별점(SURPRISE)
 *   LENS → CORE         실제 관계 신호로 돌아가기
 *   04 4 AXES           네 축 관찰표 — 기본 접힘(근거·상세)
 *
 * v1.38 — **순서를 바꿨다. 지운 내용은 없다.** 375px 실측에서 4축 관찰표가 546px(0.9 화면)을
 * 먼저 먹는 바람에 PATTERN이 1.39 화면, 이 화면의 Surprise인 Bridge가 **2.37 화면**,
 * Core로 돌아가는 CTA가 **3.91 화면** 아래였다. Supporting Lens가 Core Report보다 먼저
 * 읽히고, 정작 '그런데 실제 관계에서는?'은 묻혀 있었다.
 *
 * Core(S21R)는 이미 `점수 → 핵심 한 문장 → Surprise → 근거` 순서다. 이 화면도 같은
 * 위계를 따른다 — 4축 관찰표는 **판정의 근거**이므로 Surprise 뒤로 간다. 대신 첫
 * viewport에 축별 같음/다름 한눈 요약을 두어, 아래 PATTERN이 근거 없이 읽히지 않게 한다.
 *
 * v1.25 P3-2 — 실사용 피드백 "구조는 좋아졌는데 정보가 적다"를 반영해 `03 PATTERN`을
 * 신설했다. **축 설명을 늘려서 채우지 않았다**(MBTI 교육 페이지가 되면 실패다) —
 * 무료가 반드시 세 가지를 주도록 만든 블록이다: 조합 패턴 · 러비의 관찰 1개 ·
 * 확인해볼 질문 1개. 전부 MBTI 데이터만으로 만들고 관계 답변을 끌어오지 않는다.
 *
 * ⚠️ 이 화면의 어떤 값도 동기화율에 영향을 주지 않는다. `buildMbtiLens`와
 * `buildCompatibility`는 한 줄도 바뀌지 않았고, 새 Route도 만들지 않았다.
 * ⚠️ Back은 **진입한 화면**으로 돌아간다(v1.46.2 §Navigation). 이 화면은 `/compatibility`·
 * `/mirror`·`/first-contact`·`/lens` 어디서든 열리므로, 돌아갈 곳을 하드코딩하면 그 중
 * 하나를 뺀 나머지 전부가 틀린다. `backHref`는 주소창으로 바로 들어왔을 때의 fallback이다.
 */
export default function MbtiLensPage() {
  return (
    <HydrationGate>
      <MbtiLensView />
    </HydrationGate>
  );
}

function MbtiLensView() {
  const router = useRouter();
  const { answers } = useSession();
  const report = useMbtiLens();
  /**
   * v1.46 PremiumLens §2 — Bundle 자격 판정. **새 기준을 만들지 않고** 결과
   * 화면·Home과 같은 `hasPremiumEvidence`를 그대로 부른다.
   */
  const crossSourceInsights = useCrossSourceInsights();
  const mirror = useMirror();
  const bridge = useMbtiBridge();
  const pattern = useMbtiPattern();

  /* v1.46 §27 — 보고서 섹션 scroll reveal (요소당 1회) */
  useRevealOnceInScreen();
  const [variant] = useState(() => resolvePriceVariant());

  const selfLens = useMemo(() => buildMbtiSelfLens(answers.mbti), [answers.mbti]);
  const targetLens = useMemo(() => buildMbtiSelfLens(answers.target.mbti), [answers.target.mbti]);

  /** 두 유형이 모두 있어 실제로 '비교'를 보여줄 수 있는 상태 */
  const couple = Boolean(report && targetLens);

  const viewSent = useRef(false);
  useEffect(() => {
    // StrictMode 이중 마운트로 두 번 세지 않게 mount 기준 1회만 보낸다.
    if (viewSent.current) return;
    viewSent.current = true;

    // v1.24 P3-1 Audit — `self_mbti`/`target_mbti`(유형 원문)를 뺐다. 지표로 쓰는 것은
    // 보유 여부와 축 개수이지 유형 값이 아니고, 두 값이 한 이벤트에 함께 실리면 두 사람의
    // 유형 쌍이 그대로 남는다. `analytics.ts`의 금지 키 목록은 방어선으로 남겨둔다.
    trackEvent('mbti_lens_view', {
      mode: report ? 'couple' : selfLens ? 'self' : 'empty',
      has_self: Boolean(answers.mbti),
      has_target: Boolean(answers.target.mbti),
      same_axes: report?.sameCount,
      different_axes: report?.differentCount,
    });

    // v1.24 P3-1 — Bridge가 실제로 렌더된 경우에만. 위 이벤트와 같은 조건·같은 시점에
    // 보내므로 Bridge View Rate = 이 이벤트 / mbti_lens_view 로 바로 계산된다.
    // ⚠️ opaque 상태값만 보낸다 — MBTI 원문·답변·문구는 보내지 않는다.
    if (bridge?.available) {
      trackEvent('mbti_relationship_bridge_view', {
        bridge_state: bridge.surprise?.state ?? 'unknown',
        source: 'mbti',
      });
    }
  }, [report, selfLens, bridge, answers.mbti, answers.target.mbti]);

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.lens} action={<Tag tone="neutral">{MBTI_LENS_COPY.badge}</Tag>} />}
      footer={
        <Button variant="secondary" onClick={() => router.push(ROUTES.lens)}>
          렌즈 목록으로
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      {/* STATE — 내 MBTI가 없으면 상대 유무와 무관하게 내 입력부터 유도한다(Self First) */}
      {!selfLens ? (
        <EmptyLensView hasTarget={Boolean(answers.target.mbti)} />
      ) : couple && report && bridge && pattern ? (
        <CoupleLensView
          report={report}
          pattern={pattern}
          bridge={bridge}
          compatibilityDone={answers.completed.compatibility}
        />
      ) : (
        <SelfOnlyLensView lens={selfLens} />
      )}

      <div className="mt-7 flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <SectionLabel>{MBTI_LENS_COPY.editSectionLabel}</SectionLabel>
          <FillDataRow
            label={`내 MBTI${answers.mbti ? ` · ${answers.mbti}` : ' · 없음'}`}
            actionLabel="수정"
            onClick={() => router.push(ROUTES.declared(4))}
          />
          <FillDataRow
            label={`상대 MBTI${answers.target.mbti ? ` · ${answers.target.mbti}` : ' · 없음'}`}
            actionLabel="수정"
            onClick={() => router.push(ROUTES.target)}
          />
        </section>

        {/* MBTI를 강한 유료 Feature로 전면에 두지 않는다 — 상세 안의 한 항목일 뿐(§19) */}
        <PremiumEntryRow
          /*
            v1.40.1 §38.3 — `allowsOutwardAction`이 필수가 됐다. `mbti_detail`의
            `additions`에는 outward 항목이 없어서 지금은 결과가 같지만, **`true`를
            하드코딩하지 않는다** — 나중에 이 feature에 outward 약속이 추가되면
            하드코딩한 곳만 조용히 새기 때문이다. 실제 Job에서 도출한다.
          */
          /*
            v1.46 PremiumLens §2 · §35 — **이 화면은 더 이상 자기 상세를 팔지 않는다.**

            예전에는 여기서 `mbti_detail`·`astrology_detail`을 각각 ₩1,900에 팔았고,
            그러면 렌즈를 둘러본 사용자에게는 같은 가격이 세 번 보였다 — 세 번 결제해야
            하는 상품으로 읽힌다(§35 금지). 이제 세 렌즈가 전부 같은 Bundle을 가리키고,
            그 Bundle 안에 이 렌즈의 **Pair/Self 결과가 실제로 들어 있다**(`logic/premiumLens.ts`).

            ⚠️ `source`는 그대로 남긴다 — 상품은 하나지만 지불 의향이 어디서 생겼는지는
            여전히 구분해야 한다(§31).
          */
          feature={premiumFeatureState('relationship_deep_report', resolvePrice(variant), {
            allowsOutwardAction: jobAllowsOutwardAction(resolveRelationshipContext(answers).job),
            deepReportAvailable: hasPremiumEvidence({
              insights: crossSourceInsights,
              declared: answers.declared,
              mirror,
            }),
            solo: soloModeOf(answers) === 'no_target',
          })}
          source="mbti"
        />

        <NoticeBox>{MBTI_LENS_COPY.scoreNotice}</NoticeBox>
      </div>
    </ScreenLayout>
  );
}

/* -------------------------------------------------------------- 두 유형 모두 있음 */

function CoupleLensView({
  report,
  pattern,
  bridge,
  compatibilityDone,
}: {
  report: MbtiLensReport;
  pattern: MbtiPatternReport;
  bridge: MbtiBridgeReport;
  compatibilityDone: boolean;
}) {
  return (
    <>
      <ReportHeader
        eyebrow={MBTI_LENS_COPY.reportEyebrow}
        title={MBTI_LENS_COPY.reportTitle}
        meta={[MBTI_LENS_COPY.reportMetaLens, MBTI_LENS_COPY.reportMetaScore]}
      />

      {/*
        `report-reveal`은 이미 렌더된 것을 위에서부터 70ms씩 늦춰 보여주기만 한다 —
        콘텐츠를 늦게 만들지 않는다. prefers-reduced-motion에서는 globals.css의
        media query 한 곳에서 전부 꺼지고, 꺼져도 모든 정보가 그대로 보인다.
      */}
      <div className="report-reveal flex flex-col">
        {/*
          ══ 01 · MBTI LENS — 익숙한 Hook (첫 viewport) ═══════════════════════
          "우리 MBTI 궁합은 어떻게 나오지?"에 대한 답이 여기서 끝나야 한다.
          단, 큰 숫자·궁합 %·별점을 새로 만들지 않는다 — MBTI를 또 하나의 점수로
          만들지 않기 위해서다. 조합 자체가 Hook이다.
        */}
        <div className="mt-5 flex flex-col gap-3">
          <ReportSectionEyebrow index="01" code={MBTI_LENS_COPY.sections.lens.code} />

          <div className="flex items-end gap-2.5 px-1">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                {MBTI_LENS_COPY.axesLegendMine}
              </p>
              <p className="text-[26px] font-semibold leading-[1.2] tracking-[-0.6px]">
                {report.mine}
              </p>
            </div>
            <span className="pb-1 text-[15px] text-ink-faint" aria-hidden>
              ×
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                {MBTI_LENS_COPY.axesLegendTheirs}
              </p>
              <p className="text-[26px] font-semibold leading-[1.2] tracking-[-0.6px]">
                {report.theirs}
              </p>
            </div>
          </div>

          {/* 이미 계산된 sameCount만 읽어 만든 결정론적 한 문장 */}
          <p className="px-1 text-[17px] font-semibold leading-[1.5] tracking-[-0.3px] keep-all">
            {selectMbtiLensHeadline(report)}
          </p>

          {/*
            v1.38 — 여기 있던 `4개 축 중 N개 비슷 · M개 다름`을 **축 한눈 요약으로
            바꿨다.** 그 줄은 바로 아래 한 문장(`비슷한 축이 더 많아`)과 같은 사실을
            숫자로 한 번, 문장으로 한 번 말하고 있었다(§45). 요약은 같은 개수를 담으면서
            **어느 축이 갈렸는지**까지 말하므로, 아래 PATTERN이 근거 없이 읽히지 않는다.
            상세(극 라벨 · marker)는 04에서 펼친다.
          */}
          <div className="px-1">
            <MbtiAxisSummary report={report} />
          </div>
        </div>

        {/*
          ══ 02 · PATTERN — 무료가 반드시 주는 세 가지 (v1.25 P3-2) ═══════════
          ① 조합에서 눈여겨볼 성향 패턴  ② 러비의 심리/철학적 관찰  ③ 확인해볼 질문
          전부 MBTI 데이터만으로 만든다 — 관계 답변을 억지로 끌어오지 않는다.
        */}
        <ReportSection
          index="02"
          code={MBTI_LENS_COPY.sections.pattern.code}
          title={MBTI_LENS_COPY.sections.pattern.title}
          caption={MBTI_LENS_COPY.patternCaption}
        >
          {/* ① 패턴 — 유형쌍 사전이 아니라 4축이 만드는 '모양'의 이름이다 */}
          <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
            <p className="text-[13.5px] font-semibold keep-all tracking-[-0.2px]">
              {pattern.label}
            </p>
            <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{pattern.body}</p>

            <div className="border-t border-line-soft pt-3">
              <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-faint">
                {MBTI_LENS_COPY.patternWatchLabel}
              </p>
              <p className="mt-0.5 text-[12.5px] keep-all leading-relaxed text-ink">
                {pattern.watchFor}
              </p>
            </div>
          </div>

          {/* ② 러비 — 유형 해설자가 아니라 인간을 관찰하는 외계인. 진단하지 않는다 */}
          <LovyNote label="LOVY OBSERVATION">{pattern.observation}</LovyNote>

          {/* ③ 확인해볼 질문 — 답을 예측해서 말하지 않고, 물어볼 것만 준다 */}
          <div className="flex flex-col gap-1.5 border-l-2 border-line-strong pl-3.5">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[10px] font-semibold tracking-[0.1em] text-ink-faint">
                {MBTI_LENS_COPY.patternCheckLabel}
              </span>
              <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                {pattern.check.axisEyebrow}
              </span>
            </p>
            <p className="text-[13.5px] font-medium keep-all leading-relaxed text-ink">
              “{pattern.check.question}”
            </p>
            <p className="text-[11.5px] keep-all leading-relaxed text-ink-muted">
              {pattern.check.why}
            </p>
          </div>

          <p className="text-[11px] keep-all leading-relaxed text-ink-muted">
            {MBTI_LENS_COPY.patternNotice}
          </p>
        </ReportSection>

        {/* ══ 03 · BUT IN REAL LIFE — 이 화면의 차별점(SURPRISE) ════════════ */}
        <ReportSection
          index="03"
          code={MBTI_LENS_COPY.sections.bridge.code}
          title={MBTI_LENS_COPY.sections.bridge.title}
          caption={MBTI_LENS_COPY.bridgeCaption}
        >
          <MbtiBridgeSection bridge={bridge} />
        </ReportSection>

        {/*
          Lens → Core Bridge. 마지막은 'MBTI 더 보기'가 아니라 **실제 관계로 돌아가기**다.
          아직 궁합 관측 기록이 없으면 갈 곳이 없으므로 붙이지 않는다.

          ⚠️ v1.38 — **Surprise 바로 뒤로 올렸다.** 예전에는 4축 관찰표까지 다 지난
          맨 끝(375px 실측 3.91 화면)에 있었다. Lens의 목적은 'MBTI를 더 보는 것'이
          아니라 Core로 돌아가는 것이므로, 돌아가고 싶어지는 순간(`그런데 실제
          관계에서는?`을 읽은 직후)에 길을 둔다. 아래 04는 원하면 펼치는 근거다.
        */}
        {compatibilityDone ? (
          <LensCoreBridge
            className="mt-7"
            href={`${ROUTES.compatibility}#${RESULT_ANCHORS.compatibilityGood}`}
          />
        ) : null}

        {/* ══ 04 · 4 AXES — 판정의 근거. 기본은 접힘 ════════════════════════ */}
        <ReportSection
          index="04"
          code={MBTI_LENS_COPY.sections.axes.code}
          title={MBTI_LENS_COPY.sections.axes.title}
        >
          {/*
            v1.25 P3-2 — 여기 있던 러비의 한 줄 관찰은 02 PATTERN에 있다.
            그 한 줄은 이 표가 이미 보여준 사실을 문장으로 옮긴 것뿐이었다.
          */}
          <AxisDetailDisclosure report={report} />
        </ReportSection>
      </div>
    </>
  );
}

/**
 * 4축 상세 펼치기 (v1.38 · §22 · §23)
 *
 * **accordion을 4개 만들지 않는다.** 목표는 클릭 횟수가 아니라 초기 정보량이라,
 * 토글은 **하나**이고 펼치면 4축 관찰표 전체가 한 번에 나온다.
 *
 * 상태를 저장하지 않는다(§32). 펼침은 이 화면을 읽는 동안의 선택이지 기억할 설정이
 * 아니고, 남겨두면 다음 방문에 '왜 펼쳐져 있지'가 된다. 스크롤 복원은 기존대로 별개다.
 */
function AxisDetailDisclosure({ report }: { report: MbtiLensReport }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          const next = !open;
          setOpen(next);
          // 새 이벤트를 만들지 않는다(§10.5) — 결과 화면의 섹션 펼침과 같은 이벤트다.
          if (next) trackEvent('result_section_expand', { section: 'mbti_axes' });
        }}
        className="flex min-h-11 items-center justify-center text-meta font-medium text-brand-pressed"
      >
        {open ? '접기' : MBTI_LENS_COPY.axesExpandCta}
      </button>

      {/* 접힘은 렌더하지 않는다 — 숨겨둔 채 스크린리더에만 남기면 위계가 무의미해진다 */}
      {open ? (
        <div id={panelId}>
          <MbtiAxisField report={report} />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 내 것만 있음 */

/**
 * 상대 정보는 항상 Optional — 없다고 내 결과를 막지 않는다(Self First).
 * 비교가 아니므로 축별 같음/다름 판정도, Bridge도 만들지 않는다.
 */
function SelfOnlyLensView({ lens }: { lens: MbtiSelfLens }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <PageHeading lines={MBTI_LENS_COPY.title} caption={MBTI_LENS_COPY.caption} />

      {/* 필드 자체가 '나 · INFP' 머리를 갖고 있으므로 위에 같은 라벨을 또 붙이지 않는다
          (실측에서 '나 / 나 / INFP'로 두 번 읽혔다). */}
      <MbtiSelfAxisField lens={lens} label={MBTI_LENS_COPY.selfSectionLabel} />

      <section className="flex flex-col gap-3">
        <NoticeBox>
          {MBTI_LENS_COPY.noTargetTitle} {MBTI_LENS_COPY.noTargetBody}
        </NoticeBox>
        <Button variant="secondary" onClick={() => router.push(ROUTES.target)}>
          {MBTI_LENS_COPY.noTargetCta}
        </Button>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- 내 것이 없음 */

/**
 * 'MBTI를 모른다'를 실패로 만들지 않는다 — 입력을 강제해 Core Compatibility 접근을
 * 막지도 않는다. 여기서 나가는 길은 항상 열려 있다(footer의 '렌즈 목록으로').
 */
function EmptyLensView({ hasTarget }: { hasTarget: boolean }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <PageHeading lines={MBTI_LENS_COPY.title} caption={MBTI_LENS_COPY.caption} />

      <section className="flex flex-col gap-3">
        <LovyMessage pose="question" size={52}>
          {hasTarget ? MBTI_LENS_COPY.targetOnlyBody : MBTI_LENS_COPY.noSelfBody}
        </LovyMessage>
        <Button onClick={() => router.push(ROUTES.declared(4))}>
          {hasTarget ? MBTI_LENS_COPY.targetOnlyCta : MBTI_LENS_COPY.noSelfCta}
        </Button>
        <NoticeBox>{MBTI_LENS_COPY.emptyReassurance}</NoticeBox>
      </section>
    </div>
  );
}
