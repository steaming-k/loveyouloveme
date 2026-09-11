'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { BottomNavigation } from '@/components/common/BottomNavigation';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { useToast } from '@/components/common/ToastProvider';
import { NoticeBox, SectionLabel } from '@/components/common/primitives';
import { LovyNote } from '@/components/lovy/LovyNote';
import { ReportHeader, ReportSection } from '@/components/report/ReportShell';
import { FirstContactActionCard } from '@/components/solo/FirstContactActionCard';
import { SelfPairCard, SelfSignalCard } from '@/components/solo/SelfSignalCard';
import { NO_EXPERIENCE_FRAME, UNKNOWN_TARGET_FRAME } from '@/data/firstContact';
import {
  useFirstContact,
  useMirror,
  useObservedHistoryReport,
  useSoloHistoryReport,
  useSoloMode,
} from '@/hooks/useAnalysis';
import { trackEvent, trackOnce } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { SOLO_PREMIUM_HOOK } from '@/data/premium';
import { useCrossSourceInsights } from '@/hooks/useAiNarrative';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { hasPremiumEvidence } from '@/lib/logic/premiumChapters';
import { premiumFeatureState } from '@/services/premiumService';
import { createEntryId } from '@/lib/historyRepository';
import { historyCountBucket } from '@/lib/analytics';
import { analysisFingerprint } from '@/lib/logic/history';
import { buildSoloHistoryEntry } from '@/lib/logic/soloHistory';
import { useHistory } from '@/state/HistoryProvider';
import {
  jobAllowsOutwardAction,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { useRevealOnceInScreen } from '@/hooks/useRevealOnce';
import { useSession } from '@/state/SessionProvider';

/**
 * First Contact Report — 상대 없이 나를 관찰한 보고서 (v1.29 · P4)
 *
 * **이 화면이 P4의 답이다.** 기존 리포트는 전부 '두 사람'을 전제로 해서, 상대가 없고
 * 경험도 없는 사용자는 동기화율 `?`와 "Mirror를 만들 수 없어"를 지나 홈으로 돌아갔다
 * (P4 Audit 실측). 비교할 것이 없다는 말이 관찰할 것이 없다는 말은 아니다.
 *
 *   COUPLE   나와 상대 **사이의** 차이
 *   SOLO     나 안에서 **함께 나타나는** 기준
 *
 * ⚠️ 섹션 수를 억지로 맞추지 않는다(§23). 데이터가 지원하지 않는 섹션은 아예 없다 —
 * 그래서 `index`는 실제로 렌더되는 것만 세어 붙인다.
 *
 * ⚠️ Visual Direction — Dating app onboarding처럼 만들지 않는다(§49).
 * 하트·커플 실루엣·pink gradient·match animation 없음. 기존 editorial 관찰 보고서 그대로.
 */
export default function FirstContactPage() {
  const router = useRouter();
  const { answers } = useSession();
  const mode = useSoloMode();
  const report = useFirstContact();

  /* v1.46 §27 — 보고서 섹션 scroll reveal (요소당 1회) */
  useRevealOnceInScreen();

  const hasMbti = Boolean(answers.mbti);

  /**
   * Solo Retention (v1.34 P4-B)
   *
   *   CURRENT   이 화면 — 지금 답으로 매번 다시 계산한다
   *   HISTORY   저장된 snapshot — 그때의 값을 그대로 얼려둔다
   *   CHANGE    둘 **사이**의 비교
   *
   * ⚠️ 비교는 저장된 snapshot과 현재 결과 사이에서만 한다. History가 현재 answers로
   * 과거를 다시 계산하면 그건 기록이 아니다.
   */
  const { entries, saveEntry } = useHistory();
  const { showToast } = useToast();
  const soloHistory = useSoloHistoryReport();
  /**
   * 사진 관찰의 시간축 비교 (§5 ~ §8).
   *
   * ⚠️ **사진은 History의 입장권이 아니다**(§29). 사진이 없으면 `comparable === false`이고
   * 이 섹션만 없다 — 나머지 비교는 그대로 동작한다.
   */
  const observedHistory = useObservedHistoryReport();
  /**
   * 관계 속의 나 (v1.36). **새 계산이 아니다** — 이미 있는 `useMirror()`를 읽는다.
   * 관계 경험이 없으면 `available === false`라서 섹션 자체가 렌더되지 않는다.
   */
  const mirror = useMirror();

  const analysisId = analysisFingerprint(answers.status, answers.declared, answers.experience);
  const alreadySaved = entries.some((entry) => entry.analysisId === analysisId);

  const handleSave = () => {
    if (!report?.available) return;
    const entry = buildSoloHistoryEntry({
      answers,
      report,
      id: createEntryId(),
      createdAt: new Date().toISOString(),
      analysisId,
    });
    if (!entry) {
      showToast('이번 관찰은 기록으로 남길 근거가 부족했어');
      return;
    }
    const { created } = saveEntry(entry);
    /**
     * §32 — **새 이벤트를 만들지 않는다.** 기존 `relationship_history_entry_created`에
     * `audience`만 더한다. Solo 때문에 기존 KPI의 의미가 깨지지 않게 low-cardinality
     * property 하나로 구분한다.
     */
    if (created) {
      trackEvent('relationship_history_entry_created', {
        audience: 'solo',
        // §26 — exact count 대신 low-cardinality bucket. 개수 자체가 지표가 아니다.
        history_bucket: historyCountBucket(entries.length + 1),
        signal_count: report.signals.length,
      });
    }
    showToast(created ? '이때의 기준을 기억해둘게' : '이미 남겨둔 관찰이야');
  };

  /**
   * Solo Premium (§39 ~ §41)
   *
   * ⚠️ **상대가 없다는 이유만으로 unavailable이 되지는 않는다**(§41). 하지만
   * **source가 1개뿐이면 열지 않는다** — 판정은 커플과 똑같이 `hasDeepConnection`
   * (서로 다른 source 2종 이상 + 근거 2개 이상)이 한다. 새 기준을 만들지 않았다.
   *
   * Solo에서 그 조건을 만족시키는 것은 생성기 ⑥(`declared × observed`)이다.
   * 사진이 없으면 여기도 열리지 않는다 — 그게 정직한 결과다.
   */
  const [priceVariant] = useState(() => resolvePriceVariant());
  const crossSourceInsights = useCrossSourceInsights();
  /**
   * v1.40.1 §38.3 — v1.40에서 이 호출부가 `allowsOutwardAction`을 넘기지 않았다.
   *
   * 이 Route는 비교할 상대가 없는 사용자용이고, `ended` + 상대 정보 없음인 사용자도
   * 정확히 여기로 온다(`job = 'ended'`). 다만 **이 화면은 `feature.additions`를 그리지
   * 않으므로**(`PremiumEntryRow`는 `price`·`status`·`title`·`description`만 읽는다)
   * 사용자에게 outward 약속이 보인 적은 없다 — 계산이 쓰이지 않았을 뿐이다.
   *
   * 그래도 게이트를 넘긴다: 파라미터가 필수가 됐고, `PremiumEntryRow`가 나중에
   * `additions`를 보여주기로 하면 그때 새어 나갈 자리이기 때문이다.
   */
  const premiumFeature = premiumFeatureState('relationship_deep_report', resolvePrice(priceVariant), {
    /**
     * §2-1-A — **Experience/Target 유무로 Premium 자격을 막지 않는다.**
     * `hasDeepConnection`만 보면 관계 경험이 없는 사용자는 통과할 방법이
     * 없었다(실측: declared 5축 + Target 4축 + MBTI 양쪽인데도 막혔다).
     */
    deepReportAvailable: hasPremiumEvidence({
      insights: crossSourceInsights,
      declared: answers.declared,
      mirror,
    }),
    solo: true,
    allowsOutwardAction: jobAllowsOutwardAction(resolveRelationshipContext(answers).job),
  });

  /**
   * 상대를 비교할 만큼 아는 사용자가 이 Route로 들어오면 궁합 결과로 보낸다.
   *
   * 그냥 두면 `useFirstContact`가 null을 주고 화면은 "아직 관찰할 기준이
   * 모여있지 않아"를 보여준다 — **거짓이다.** 그 사용자는 기준도 상대 정보도 있다.
   * Solo 리포트가 궁합 결과를 대체하지 않는다는 원칙과 같은 이유다.
   */
  useEffect(() => {
    if (mode === 'couple') router.replace(ROUTES.compatibility);
  }, [mode, router]);

  useEffect(() => {
    if (!report?.available) return;
    /**
     * §52 — 새 Funnel이므로 노출은 세야 한다. 다만 **Primary KPI(Compatibility)를
     * 오염시키지 않는다**(§53) — 별도 secondary funnel이다.
     *
     * ⚠️ property는 categorical count/state뿐이다. headline 원문·답변 값은 보내지 않는다(§54).
     */
    trackOnce('solo_report_view', {
      mode: report.mode,
      signal_count: report.signals.length,
      pair_count: report.pairs.length,
      action_count: report.actions.length,
      no_experience: report.noExperience,
      has_mbti: hasMbti,
    });
  }, [report, hasMbti]);

  useEffect(() => {
    if (!report?.available || report.actions.length === 0) return;
    /**
     * 행동 제안이 **실제로 노출됐을 때** 1회. 클릭 이벤트를 따로 만들지 않는다 —
     * 여기서 알고 싶은 것은 '이 사용자에게 근거 있는 행동이 만들어졌는가'이고,
     * 그건 노출로 답이 된다. 클릭까지 재려면 이벤트가 두 배가 되고 §52를 어긴다.
     *
     * ⚠️ 행동 문구 원문은 보내지 않는다 — 종류(TRY|ASK|NOTICE)와 개수뿐이다(§54).
     */
    trackEvent('solo_action_view', {
      mode: report.mode,
      action_count: report.actions.length,
      kinds: [...new Set(report.actions.map((action) => action.kind))].sort().join('|'),
    });
  }, [report]);

  /**
   * 재료가 모자라면 리포트를 만들지 않는다. **빈 섹션을 늘어놓는 것보다
   * 무엇을 채우면 되는지 말하는 게 낫다** — E1과 같은 원칙이다.
   */
  // 위 effect가 이동시키는 동안 잘못된 빈 화면을 깜빡이지 않게 한다
  if (mode === 'couple') return null;

  if (!report || !report.available) {
    return (
      <ScreenLayout
        /* 아래 ReportHeader가 h1을 그린다 — title을 넘기면 H2가 먼저 나온다(§58) */
        header={<ScreenHeader backHref={ROUTES.home} />}
        footer={
          <Button onClick={() => router.push(ROUTES.declared(1))}>내 기준 채우기</Button>
        }
        bodyClassName="pt-2 pb-4"
      >
        <div className="flex flex-col gap-3.5">
          <ReportHeader title="아직 관찰할 기준이 모여있지 않아" meta={['내 기준 3개 이상 필요']} />
          <NoticeBox>
            관계에서 무엇이 중요한지 답한 항목이 아직 적어. 세 개만 채우면 지금 네 기준으로
            관찰을 만들 수 있어.
          </NoticeBox>
        </div>
      </ScreenLayout>
    );
  }

  /** 실제로 렌더되는 섹션만 센다 — 조건부로 빠진 섹션 때문에 번호가 건너뛰면 보고서로 안 읽힌다 */
  let sectionIndex = 0;
  const nextIndex = () => String((sectionIndex += 1)).padStart(2, '0');

  return (
    <ScreenLayout
      /*
        ⚠️ §58 — **`title`을 넘기지 않는다.** `ScreenHeader`의 title은 `<h2>`로 그려져서,
        아래 `ReportHeader`의 `<h1>`보다 **먼저** 나오면 heading 순서가 H2 → H1이 된다
        (실측으로 확인했다). `/compatibility`·`/mirror`의 리포트 본문도 같은 이유로
        title을 넘기지 않는다. 이 화면은 **빈 상태에서도** `ReportHeader`(h1)를 쓰므로
        거기서도 넘기지 않는다.
      */
      header={<ScreenHeader backHref={ROUTES.home} />}
      nav={<BottomNavigation />}
      bodyClassName="pt-1 pb-4"
    >
      <div className="flex flex-col">
        <ReportHeader
          title="상대가 없어도 관찰할 수 있는 것"
          eyebrow="LOVY FIRST CONTACT REPORT"
          meta={[
            `내 기준 ${report.signals.length}개`,
            ...(report.pairs.length > 0 ? [`함께 나타난 신호 ${report.pairs.length}개`] : []),
          ]}
        />

        {/*
          경험 없음 · 상대 정보 부족을 **정직하게 먼저 말한다**(§28 · §32).
          단 '데이터가 부족해'로 끝내지 않고, 그래서 무엇을 중심으로 보는지까지 말한다.
        */}
        {report.noExperience || report.mode === 'unknown_target' ? (
          <div className="mt-3.5 flex flex-col gap-2">
            {report.noExperience ? <NoticeBox>{NO_EXPERIENCE_FRAME}</NoticeBox> : null}
            {report.mode === 'unknown_target' ? <NoticeBox>{UNKNOWN_TARGET_FRAME}</NoticeBox> : null}
          </div>
        ) : null}

        {/*
          §24 — 첫 5초에 읽는 한 문장. 사용자가 고른 값을 다시 말해주는 것이 전부다.
          새 해석도 새 점수도 없다.
        */}
        <p className="mt-4 px-1 text-[17px] font-semibold leading-[1.5] tracking-[-0.4px] keep-all">
          {report.headline}
        </p>

        {/*
          시간축 비교 (v1.34 P4-B).

          ⚠️ 저장된 snapshot과 **지금 결과** 사이의 비교다. 과거를 현재 answers로
          다시 계산하지 않는다 — 그러면 과거가 지금에 맞춰 바뀌고, 그건 기록이 아니다.

          ⚠️ 기록이 없으면 이 섹션 자체가 없다. "아직 비교할 게 없어"를 섹션으로
          만들어 자리를 차지하지 않는다 — 대신 아래 저장 CTA가 다음 걸음을 말한다.
        */}
        {soloHistory.comparable ? (
          <ReportSection
            index={nextIndex()}
            code="WHAT CHANGED"
            title="지난 관찰과 비교하면"
            caption={`저장해둔 관찰 ${soloHistory.entryCount}개와 지금 답을 나란히 놓은 거야. 성향이 변했다는 뜻은 아니야.`}
          >
            {soloHistory.headline ? (
              <p className="px-1 text-[14px] font-medium keep-all leading-relaxed">
                {soloHistory.headline}
              </p>
            ) : null}
            <ul className="flex flex-col">
              {soloHistory.changes.map((change) => (
                <li
                  key={change.axis}
                  className="flex flex-col gap-1 border-t border-line-soft py-3 first:border-t-0 first:pt-0"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.1em] text-mint-ink">
                      {change.state === 'STABLE' ? '유지' : change.state === 'CHANGE' ? '달라짐' : '처음'}
                    </span>
                    <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                      {change.label}
                    </span>
                  </span>
                  {change.previousText ? (
                    <span className="text-[12px] keep-all leading-relaxed text-ink-muted">
                      지난 관찰 · {change.previousText}
                    </span>
                  ) : null}
                  <span className="text-[13px] keep-all leading-relaxed">
                    지금 · {change.currentText}
                  </span>
                  {/*
                    ⚠️ §18 — 반복 어휘는 관찰 3회부터. 2시점은 반복의 증거가 아니다.
                    `repeatable`이 false면 이 줄 자체가 없다.
                  */}
                  {change.repeatable ? (
                    <span className="text-[11.5px] keep-all leading-relaxed text-ink-muted">
                      {change.observationCount}번의 관찰에서 같은 방향이었어.
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>

            {/*
              사진 관찰의 시간축 비교 (§5 ~ §7).

              ⚠️ **장면 관찰이지 취향 진단이 아니다.** 문장은 로직이 만들고
              ('있었어 / 보이지 않았어 / 새로 나타났어'), 화면은 그 문장에 해석을
              덧붙이지 않는다. 아래 caption이 그 경계를 사용자에게도 말한다.

              ⚠️ 사진이 없으면 이 블록 자체가 없다 — 사진이 History의 입장권이 아니다(§29).
            */}
            {observedHistory.comparable ? (
              <div className="mt-1 flex flex-col gap-2 border-t border-line-soft pt-3.5">
                <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-muted">
                  PHOTO SCENES
                </p>
                <ul className="flex flex-col gap-1.5">
                  {observedHistory.changes.map((change) => (
                    <li
                      key={change.category}
                      className="flex items-start gap-2 text-[12.5px] keep-all leading-relaxed text-ink-sub"
                    >
                      <span className="mt-[1px] flex-none text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                        {change.state === 'NEW' ? '처음' : change.state === 'STABLE' ? '있음' : '없음'}
                      </span>
                      <span className="min-w-0">{change.note}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] keep-all leading-relaxed text-ink-faint">
                  사진에서 어떤 장면이 보였는지만 비교한 거야. 취향이나 성격이 달라졌다는
                  뜻은 아니야.
                </p>
              </div>
            ) : null}

            {/*
              §31 — 러비가 사용자를 **점점** 알아간다는 감각. 다만
              '너를 이제 완전히 이해했어'는 금지다. 그래서 문장이 관찰 횟수에 따라
              달라지고, 어떤 단계에서도 '이해했다'고 말하지 않는다.
            */}
            <p className="mt-1 px-1 text-[12px] keep-all leading-relaxed text-ink-muted">
              {soloHistory.entryCount >= 2
                ? '몇 번의 관찰이 쌓였어. 여전히 다 아는 건 아니지만, 전보다는 조금 알 것 같아.'
                : '전에 기록한 너랑 지금을 나란히 놓아봤어.'}
            </p>
          </ReportSection>
        ) : null}

        {/* 01 — 내가 답한 기준. SUBJECT A ↓ SIGNAL 01/02/03 구조(§50) */}
        <ReportSection
          index={nextIndex()}
          code="WHAT YOU VALUE"
          title="내가 중요하게 답한 것"
          caption="관계에서 무엇이 중요한지 네가 직접 고른 값이야. 여기에 해석을 섞지 않았어."
        >
          <div className="flex flex-col">
            {report.signals.map((signal, index) => (
              <SelfSignalCard key={signal.key} signal={signal} index={index + 1} />
            ))}
          </div>
        </ReportSection>

        {/* 02 — 함께 나타난 두 신호. SOLO의 핵심 정보값 */}
        {report.pairs.length > 0 ? (
          <ReportSection
            index={nextIndex()}
            code="WHAT TO NOTICE"
            title="네 답변 안에서 함께 나타난 것"
            caption="따로 답한 두 항목이 같은 자리를 가리키고 있어. 왜 그런지는 이 답만으로 알 수 없어."
          >
            {report.pairs.map((pair) => (
              <SelfPairCard key={pair.id} pair={pair} />
            ))}
          </ReportSection>
        ) : null}

        {/* 03 — 러비의 관찰. 진단이 아니라 질문으로 끝난다(§27) */}
        {report.observation ? (
          <ReportSection index={nextIndex()} code="LOVY OBSERVATION" title="러비가 궁금한 것">
            <LovyNote>{report.observation.body}</LovyNote>
            <p className="px-1 text-[13.5px] font-medium keep-all leading-relaxed">
              {report.observation.question}
            </p>
          </ReportSection>
        ) : null}

        {/* 04 — 특정 상대는 있지만 아는 게 적을 때. 상대를 추론하지 않고 물어볼 것만 준다(§32) */}
        {report.gettingToKnow.length > 0 ? (
          <ReportSection
            index={nextIndex()}
            code="GETTING TO KNOW"
            title="알아보기 위해 물어볼 것"
            caption="그 사람이 어떤 사람인지 우리가 추측해서 채우지 않아. 대신 확인해볼 것을 둘게."
          >
            <ul className="flex flex-col">
              {report.gettingToKnow.map((text) => (
                <li
                  key={text}
                  className="border-t border-line-soft py-3 text-[13px] keep-all leading-relaxed first:border-t-0 first:pt-0"
                >
                  {text}
                </li>
              ))}
            </ul>
          </ReportSection>
        ) : null}

        {/* 05 — 해볼 수 있는 것. 연애 성공 공식이 아니다(§30) */}
        {report.actions.length > 0 ? (
          <ReportSection
            index={nextIndex()}
            code="FIRST CONTACT"
            title="관계를 시작할 때 해볼 수 있는 것"
            caption="네가 답한 기준에서 나온 것만 뒀어. 이렇게 하면 된다는 뜻은 아니야."
          >
            {report.actions.map((action) => (
              <FirstContactActionCard key={`${action.kind}-${action.action}`} action={action} />
            ))}
          </ReportSection>
        ) : null}

        {/*
          관계 속의 나 (v1.36 §11 · §12)

          ⚠️ **이 제품의 가장 큰 "어?"가 Solo에게 숨어 있었다.** 연애 경험이 있는
          Solo 사용자(`solo_exp`)는 Mirror가 실제로 만들어지는데(말한 나 vs 관계 속의 나),
          First Contact Report에는 그 입구가 없었다 — `OTHER LENSES`가 MBTI만 제공했고
          Home의 '최근 Mirror' 카드는 한 번 본 뒤에만 뜬다. 즉 한 번도 안 본 사용자는
          Mirror가 있다는 사실 자체를 몰랐다(실측).

          ⚠️ **없으면 만들지 않는다.** 관계 경험을 건너뛴 사용자에게는 Mirror가 통째로
          비어 있으므로 이 행이 아예 없다 — 갈 수 없는 길을 알려주지 않는다.
        */}
        {mirror.available && mirror.core ? (
          <ReportSection
            index={nextIndex()}
            code="RELATIONSHIP MIRROR"
            title="관계 속의 나와도 비교해보면"
            caption="지금 답한 기준과, 이전 관계에서 실제로 나타난 신호를 나란히 놓은 관찰이야."
          >
            <button
              type="button"
              onClick={() => router.push(ROUTES.mirror)}
              className="flex min-h-11 w-full items-center justify-between rounded-row border border-line bg-surface px-4 py-3.5 text-left active:bg-sunken"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                {/*
                  ⚠️ `gapCount`는 GAP 상태만 센다. CHANGE만 있는 사용자는 `차이 0개`가 되어
                  바로 아래 요약("말한 기준과 실제 반응이 조금 달랐어")과 반대로 읽혔다.
                  `/mirror` 헤더와 **같은 기준**(MATCH가 아닌 축)을 쓴다.
                */}
                <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                  차이 {mirror.insights.filter((insight) => insight.state !== 'MATCH').length}개 ·
                  일치 {mirror.insights.filter((insight) => insight.state === 'MATCH').length}개
                </span>
                <span className="text-[13px] keep-all leading-relaxed">
                  {mirror.core.summary}
                </span>
              </span>
              <span aria-hidden className="flex-none pl-3 text-ink-faint">
                →
              </span>
            </button>
          </ReportSection>
        ) : null}

        {/* 07 — 보조 렌즈. 상대가 없으므로 궁합 문구를 절대 내지 않는다(§35) */}
        {hasMbti ? (
          <ReportSection
            index={nextIndex()}
            code="OTHER LENSES"
            title="다른 렌즈로 나를 보면"
            caption="MBTI는 나를 설명하는 하나의 렌즈일 뿐이고, 위 관찰과 다르게 보일 수도 있어."
          >
            <button
              type="button"
              onClick={() => router.push(ROUTES.lensMbti)}
              className="flex min-h-11 items-center justify-between rounded-row border border-line bg-surface px-4 py-3.5 text-left"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                  MBTI LENS
                </span>
                <span className="text-[13.5px] font-medium keep-all">
                  이 렌즈에서 나는 어떻게 설명되는지 보기
                </span>
              </span>
              <span aria-hidden className="text-ink-faint">
                →
              </span>
            </button>
          </ReportSection>
        ) : null}

        {/*
          Premium 진입 (§39 ~ §41).

          ⚠️ `unavailable`이면 `PremiumEntryRow`가 **가격도 CTA도 붙이지 않는다** —
          돈을 내면 나올 것처럼 보이지 않게 하는 기존 동작을 그대로 쓴다.
          그래서 여기서 조건부로 감추지 않고 컴포넌트에 맡긴다.

          ⚠️ Hook 문구는 Solo 전용이다. 궁합·상대 해석을 약속하지 않는다 —
          이 사용자에게는 그게 만들어지지 않는다.
        */}
        {/*
          §12 · §13 — **자동 저장하지 않는다.** 결과를 볼 때마다 기록이 쌓이면
          '관찰 횟수'가 실제보다 부풀고, 그건 이 제품이 하지 않기로 한 것이다.
          Mirror와 같은 의도적 Save action을 쓴다.

          문구는 '분석 결과 저장'이 아니라 **'이때의 나를 관찰로 남긴다'**는 화법이다.
        */}
        <div className="mt-8 flex flex-col gap-2">
          <SectionLabel>이 관찰 남기기</SectionLabel>
          <p className="px-1 text-[12px] keep-all leading-relaxed text-ink-muted">
            {alreadySaved
              ? '이번 답은 이미 관찰 기록으로 남겨뒀어. 생각이 달라지면 그때 다시 관찰해보자.'
              : '지금 답한 기준을 기록으로 남겨두면, 나중에 다시 관찰했을 때 무엇이 달라졌는지 볼 수 있어.'}
          </p>
          <Button variant={alreadySaved ? 'secondary' : 'primary'} onClick={handleSave}>
            {alreadySaved ? '다시 저장하기' : '이때의 나를 기록해두기'}
          </Button>
        </div>

        <div className="mt-8">
          <PremiumEntryRow
            feature={premiumFeature}
            source="first_contact"
            hook={SOLO_PREMIUM_HOOK}
          />
        </div>

        <div className="mt-8 flex flex-col gap-2.5">
          <SectionLabel>이 관찰에 대해</SectionLabel>
          {/*
            ⚠️ §29 · §48 — 여기서 '연애 준비도'나 '왜 솔로인지'를 말하지 않는다.
            이 리포트는 사용자가 직접 답한 것을 다시 보여준 것이고, 그게 전부다.
          */}
          <p className="px-1 text-[12px] keep-all leading-relaxed text-ink-muted">
            이건 네가 입력한 답을 정리한 관찰이야. 관계를 잘하는지 못하는지를 판정하지 않고,
            앞으로 어떻게 될지도 말하지 않아. 기준은 시간이 지나면 달라질 수 있어 —
            그때 다시 관찰하면 무엇이 달라졌는지 볼 수 있어.
          </p>
        </div>
      </div>
    </ScreenLayout>
  );
}
