'use client';

import { useState } from 'react';

import { DeepInsightVerdict } from '@/components/premium/DeepInsightVerdict';
import { Lovy } from '@/components/lovy/Lovy';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import {
  EVIDENCE_TOGGLE_LABEL,
  SO_WHAT_LABEL,
  VERIFY_LABEL,
  WHY_LABEL,
  chapterSoWhatOf,
} from '@/lib/premiumSoWhat';
import {
  LOVY_CLOSING_BODY_POSE,
  LOVY_MID_NOTE,
  LOVY_MID_NOTE_POSE,
  LOVY_CHECKPOINT_LABEL,
  LOVY_SIZE,
  lovyCheckpointOf,
  lovyConnectionReasonOf,
  lovyMidNoteAfter,
  resolveLovyPoses,
} from '@/lib/premiumLovy';
import type { LovyPose } from '@/data/lovy';
import type { PremiumChapter, RelationshipTense } from '@/types';

/**
 * Premium Deep Report v2 — Chapter Accordion (v1.45 · §12 · §13.1 · §13.2)
 *
 * ══ 왜 Accordion인가 ═══════════════════════════════════════════════════════
 *
 * v1.44 실측에서 고데이터 세션의 리포트는 유닛 12개가 **전부 펼쳐진 채** 한 줄로
 * 나열됐다. 모바일에서 그건 '읽을 것이 많다'가 아니라 '끝이 안 보인다'로 읽힌다.
 * Accordion은 분량을 숨기는 장치가 아니라 **규모를 먼저 보여주는 장치**다 —
 * 헤더에 `02 / 8`이 있으면 펼치기 전에 이 리포트가 얼마나 되는지 알 수 있다.
 *
 * ⚠️ **Chapter를 숨기지 않는다.** 접힌 상태에서도 번호·제목·근거 종류 수가 보인다.
 * 접히는 것은 본문뿐이다 — 무엇이 있는지 모르게 만드는 것은 이 제품이 하지 않는다.
 *
 * ══ v1.45 캐릭터 통합 — 러비가 진행하고, 리포트가 증명한다 ═════════════════
 *
 * 각 Chapter에 러비 44px + '연결해본 이유' + '러비 한마디'가 붙는다. 셋 다
 * `lib/premiumLovy.ts`가 `kind`만 보고 결정하는 **표현 계층**이고, 근거·판정·본문은
 * 하나도 건드리지 않는다.
 *
 * ⚠️ **시각 위계를 캐릭터가 이기지 않는다**(§26). 순서는 제목 → 강조 → 근거 → 해석 →
 * 러비 한마디 → 캐릭터 이미지이고, 캐릭터는 44px 고정에 `flex-none`이라 제목이 차지할
 * 폭을 먼저 가져가지 못한다. 한마디는 본문보다 작은 11.5px 회색이다 — 관찰자의 반응이
 * 근거보다 커 보이면 그건 실패다.
 *
 * ══ 이 컴포넌트가 하지 않는 것 ══════════════════════════════════════════════
 *
 * ⚠️ **분석 문장을 만들지 않는다.** 제목·본문·강조·근거·경계 전부 `PremiumChapter`에
 * 이미 들어 있고 여기서는 배치만 한다. 화면이 판정 문장을 만들면 fixture가 볼 수 없는
 * 자리가 생기고, v1.41 §39.9가 정확히 그 자리에서 시제를 놓쳤다.
 *
 * ⚠️ **scroll jump를 만들지 않는다.** 열 때 `scrollIntoView`를 부르지 않는다 — 헤더는
 * 제자리에 있고 본문만 아래로 자란다. reduced-motion 환경에서도 동작이 같다
 * (높이 애니메이션을 쓰지 않고 조건부 렌더만 한다).
 */

/*
  v1.46.4에서 제거: `VISIBLE_EVIDENCE`
    근거 블록 전체가 기본 닫힘이 되면서 '대표 3개만 먼저'라는 단계가 사라졌다.
    열면 전부 보인다 — 두 단계로 접으면 검증하려는 사람이 두 번 눌러야 한다(§8).
*/

export function PremiumChapterAccordion({
  chapters,
  tense,
  allowsOutwardAction,
  funnelAnalysisId,
}: {
  chapters: readonly PremiumChapter[];
  /** 러비의 체크포인트를 `ended` 안전 카피로 바꾸는 데만 쓴다 */
  tense: RelationshipTense;
  /**
   * 체크포인트에 '상대와 맞춰봐' 문장을 붙일 수 있는가.
   * ⚠️ `tense`로 대신할 수 없다 — `job=none`은 `current`인데도 outward가 금지된다.
   */
  allowsOutwardAction: boolean;
  funnelAnalysisId?: string | null;
}) {
  /**
   * §13.1 — 첫 Chapter 하나만 열고 나머지는 접는다.
   *
   * ══ ⚠️ 열림 상태를 mount 시점에 **고정하지 않는다** ═══════════════════════
   *
   * 처음에는 `useState(() => new Set([chapters[0].id]))`였다. 브라우저 실측에서
   * 이렇게 나왔다:
   *
   * ```
   * 01/8 말한 나와 관계에서 나타난 나   aria-expanded=true   ← 의도한 것
   * 07/8 과거의 나와 지금의 나          aria-expanded=true   ← 의도하지 않은 것
   * ```
   *
   * `useState` 초기화 함수는 **첫 렌더에서 한 번만** 돈다. 그런데 이 화면의
   * `report`는 hydration → selector → AI narrative 순서로 여러 번 다시 만들어지고,
   * 그 중간 상태의 `chapters[0]`이 최종 목록의 첫 Chapter가 아닐 수 있다. 그 순간
   * 잡힌 id가 Set에 그대로 남아서, 목록이 커진 뒤에는 **엉뚱한 Chapter가 열린 채로**
   * 남는다.
   *
   * 그래서 '열린 목록'을 들고 있지 않고 **사용자가 직접 바꾼 것만** 들고 있는다.
   * 기본값은 매 렌더 `chapter.index === 1`로 다시 계산되므로 목록이 언제 완성되든
   * 항상 첫 Chapter가 열려 있다.
   *
   * ⚠️ '한 번에 하나만'으로 강제하지 않는다. 이 저장소에는 공용 Accordion 계약이 없고
   * (각 화면이 `aria-expanded` 버튼을 직접 만든다 — `/compatibility`·`/lens/mbti`·
   * `/target`), 그 화면들은 전부 **여러 개를 동시에 열 수 있다.** 유료 리포트만
   * 다르게 동작하면 같은 앱 안에서 같은 모양이 다르게 반응하는 것이다. 그리고
   * 두 Chapter를 나란히 놓고 비교하는 것은 이 리포트가 파는 행동 자체다.
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (chapter: PremiumChapter) => overrides[chapter.id] ?? chapter.index === 1;

  const toggle = (chapter: PremiumChapter) => {
    const next = !isOpen(chapter);
    setOverrides((prev) => ({ ...prev, [chapter.id]: next }));
    if (next) {
      /**
       * §18 — **새 이벤트는 이것 하나뿐이다.** 리포트 진입은 `deep_report_view`,
       * 완독은 `deep_report_complete`가 이미 담당한다.
       *
       * ⚠️ property에 원문을 넣지 않는다(§18 금지 목록) — 종류·번호·개수만이다.
       * Chapter 제목도 보내지 않는다: 제목 자체는 고정 문구지만, `chapter_kind`가
       * 이미 같은 것을 식별자로 말하므로 문자열을 하나 더 보낼 이유가 없다.
       *
       * ⚠️ v1.45 캐릭터 통합에서 **캐릭터 이벤트를 추가하지 않았다**(§31). 어떤 러비가
       * 보였는지는 `chapter_kind`에서 결정론으로 역산되므로 보낼 값이 없다.
       */
      trackEvent('premium_chapter_open', {
        ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
        chapter_kind: chapter.kind,
        chapter_index: chapter.index,
        chapter_total: chapters.length,
        source_group_count: chapter.sourceGroups.length,
      });
    }
  };

  /**
   * §22 — 중간 관찰 메모를 끼울 자리. Chapter 6개 미만이면 null이라 Sparse에는
   * 아예 나오지 않는다.
   *
   * ⚠️ **`chapters.length`를 바꾸지 않는다.** 메모는 배열 밖에 있고 `01/8` 번호와
   * `전체 8개`는 전부 실제 Chapter 수를 그대로 쓴다(LOVY-06).
   */
  const midNoteAfter = lovyMidNoteAfter(chapters.length);

  /**
   * §3 — 포즈는 **리포트 단위로 한 번** 계산한다. kind→포즈 표만 쓰면 붙어 있는 두
   * Chapter가 같은 그림이 되는 경우가 데이터에 따라 생긴다(실측에서 두 번 나왔다).
   */
  const poses = resolveLovyPoses(chapters);

  return (
    <ul className="flex flex-col">
      {chapters.map((chapter) => (
        <li key={chapter.id} className="contents">
          <ChapterRow
            chapter={chapter}
            pose={poses[chapter.index - 1]!}
            total={chapters.length}
            open={isOpen(chapter)}
            tense={tense}
            allowsOutwardAction={allowsOutwardAction}
            onToggle={() => toggle(chapter)}
            funnelAnalysisId={funnelAnalysisId}
          />
          {midNoteAfter === chapter.index ? <MidNote /> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * §22 러비의 중간 관찰 메모.
 *
 * ⚠️ 번호가 없다 — Chapter가 아니기 때문이다. 배경도 Chapter와 다르게(`sunken`) 두어
 * 목록의 한 항목으로 오해되지 않게 한다. **고정 문구이고 사용자별 해석이 없다.**
 */
function MidNote() {
  return (
    <div className="my-1 flex items-start gap-3 rounded-card bg-sunken px-4 py-3.5">
      <Lovy pose={LOVY_MID_NOTE_POSE} size={LOVY_SIZE.midNote} decorative />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
          {LOVY_MID_NOTE.label}
        </p>
        <p className="text-[12px] keep-all leading-relaxed text-ink-sub">{LOVY_MID_NOTE.body}</p>
      </div>
    </div>
  );
}

function ChapterRow({
  chapter,
  pose,
  total,
  open,
  tense,
  allowsOutwardAction,
  onToggle,
  funnelAnalysisId,
}: {
  chapter: PremiumChapter;
  /** 리포트 단위로 이미 겹침이 해소된 포즈 */
  pose: LovyPose;
  total: number;
  open: boolean;
  tense: RelationshipTense;
  allowsOutwardAction: boolean;
  onToggle: () => void;
  funnelAnalysisId?: string | null;
}) {
  /**
   * v1.46.4 §7 — 근거 토글의 기본값은 **닫힘**이다.
   *
   * v1.46.3에서는 근거가 본문 맨 위에 펼쳐진 채였고(`VISIBLE_EVIDENCE = 3`), 대표 3개
   * 다음의 나머지만 '더 보기'로 접혀 있었다. 지금은 블록 전체가 접히고, 열면 전부
   * 보인다 — 근거 안에서 또 한 번 접는 단계를 만들면 검증하려는 사람이 두 번 눌러야
   * 한다(§8: 근거는 검증용이지 읽기 과제가 아니다).
   */
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const panelId = `${chapter.id}-panel`;
  const reason = lovyConnectionReasonOf(chapter);
  const checkpoint = lovyCheckpointOf(chapter, { tense, allowsOutwardAction });
  /** §7 ① ② — 없으면(파생 Chapter) 기존 규칙 문장이 본문이 된다 */
  const soWhat = chapterSoWhatOf(chapter, { tense });
  const summaryParagraphs = chapter.deterministicSummary.split('\n\n');
  const narrativeParagraphs = chapter.narrativeText
    ? chapter.narrativeText.split('\n\n')
    : [];

  return (
    <div className="border-t border-line-soft first:border-t-0">
      {/*
        §13.2 — hit area >= 44px, `aria-expanded`, keyboard. `button` 하나가 header
        전체를 덮는다(제목 옆 작은 화살표만 누를 수 있게 하지 않는다).
      */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[52px] w-full items-center gap-2.5 py-3 text-left"
      >
        {/*
          §13 · §14 — 러비가 이 Chapter를 진행한다.
          ⚠️ `decorative`라 스크린리더가 읽지 않는다 — 바로 옆에 제목이 있으므로 같은
          내용을 두 번 읽히지 않는다. 그리고 `flex-none`이라 제목의 폭을 빼앗지 않는다.
        */}
        <Lovy
          pose={pose}
          size={LOVY_SIZE.chapterHeader}
          decorative
          className="-my-1"
        />

        {/* §13.1 — 펼치기 전에 위치와 전체 수가 보인다 */}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold tnum tracking-[0.06em] text-ink-faint">
              {String(chapter.index).padStart(2, '0')}
              <span className="text-line-strong" aria-hidden>
                /
              </span>
              {total}
            </span>
            <span className="min-w-0 truncate text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
              {chapter.eyebrow}
            </span>
          </span>
          <span className="text-[14px] font-semibold keep-all leading-snug tracking-[-0.2px]">
            {chapter.title}
          </span>
          {/*
            접힌 상태에서도 '무엇을 이었는지'는 보인다. 근거가 없는 파생 Chapter
            (next_check · closing)에서는 이 자리가 비어야 한다 — 0종이라고 쓰면
            근거가 없는 것처럼 읽히는데 그건 사실이 아니다(앞 Chapter에서 파생됐다).
          */}
          {chapter.sourceGroups.length > 0 ? (
            <span className="text-[10.5px] font-semibold tnum text-mint-ink">
              자료 {chapter.sourceGroups.length}종
            </span>
          ) : null}
        </span>

        <span
          aria-hidden
          className={cn(
            'flex-none text-[11px] text-ink-muted transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        >
          ▾
        </span>
      </button>

      {/*
        ⚠️ `hidden` 속성이 아니라 조건부 렌더다. 접힌 Chapter의 본문을 DOM에 두면
        스크린리더가 `aria-expanded=false`인 내용을 읽고, 리포트 길이도 실제보다
        길게 계산된다(스크롤 깊이 이벤트가 오염된다).
      */}
      {open ? (
        /*
          v1.46 §26 — 펼친 본문이 opacity + 6px로 들어온다(`body-enter` · 220ms).

          ⚠️ **height를 애니메이션하지 않는다.** 위 주석이 v1.45에 적어둔 대로 이
          Accordion은 조건부 렌더이고, height 연출을 붙이려면 본문 높이를 측정해야
          한다 — 그 측정이 §30이 금지한 `accordion measurement loop`와 scroll jump가
          들어오는 자리다. 헤더는 제자리에 있고 본문만 아래로 자라는 동작은 그대로다.

          ⚠️ transform이 걸리므로 이 요소는 containing block이 된다. 본문 안에
          `absolute inset-0` 오버레이는 없다(근거 목록·문장·러비 한마디뿐).
        */
        <div id={panelId} className="body-enter flex flex-col gap-3 pb-5">
          {/*
            ══ v1.46.4 §7 — 본문 순서를 뒤집었다 ══════════════════════════════

            v1.46.3까지: `근거(펼쳐짐) → 연결한 이유 → 규칙 요약 → 강조 → 확인해볼 것`
            지금:        `① SO WHAT → ② WHY IT MATTERS → ③ 확인해볼 것 → ④ 근거(접힘)`

            바뀐 것은 **순서와 기본 펼침 상태뿐**이다. 근거도 규칙 문장도 하나도
            지우지 않았다 — 전부 ④ 안에 그대로 있다(§8: 근거를 없애는 게 아니라
            검증하고 싶을 때 펼치는 것으로 옮긴다).

            ⚠️ 파생 Chapter(`next_check`·`closing`)에는 `soWhat`이 없다. 그 둘은 앞
            Chapter에서 나온 것이라 자기 결론을 가질 수 없어서, 기존처럼 규칙 문장을
            그대로 본문에 둔다.
          */}
          {soWhat ? (
            <>
              {/* ① SO WHAT — 이 Chapter에서 가장 큰 글자 */}
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold tracking-[0.06em] text-mint-ink">
                  {SO_WHAT_LABEL}
                </p>
                <p className="text-[13.5px] font-semibold keep-all leading-relaxed">
                  {soWhat.soWhat}
                </p>
              </div>

              {/*
                ② WHY IT MATTERS — 결정론 문장이 먼저 있고, AI 문장은 그 **아래**에
                덧붙는다. AI가 실패해도 이 자리가 비지 않는다(§11.3 · VALUE-11).
              */}
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                  {WHY_LABEL}
                </p>
                <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                  {soWhat.whyItMatters}
                </p>
                {narrativeParagraphs.map((paragraph, index) => (
                  <p
                    key={`ai-${index}`}
                    className="text-[12.5px] keep-all leading-relaxed text-ink-sub"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </>
          ) : (
            /* 파생 Chapter — 기존 그대로. 규칙 문장이 본문이고 AI 문장이 뒤따른다. */
            <>
              {summaryParagraphs.map((paragraph, index) => (
                <p key={`rule-${index}`} className="text-[13px] keep-all leading-relaxed">
                  {paragraph}
                </p>
              ))}
              {narrativeParagraphs.map((paragraph, index) => (
                <p
                  key={`ai-${index}`}
                  className="text-[12.5px] keep-all leading-relaxed text-ink-sub"
                >
                  {paragraph}
                </p>
              ))}
            </>
          )}

          {/*
            §23 — Closing만 캐릭터를 크게 놓는다. 이 리포트에서 러비가 '기억한다'는
            역할을 맡는 유일한 자리다.

            ⚠️ header(44px)와 **다른 포즈**다(§25 '같은 이미지 재출력 금지').
          */}
          {chapter.kind === 'closing' ? (
            <div className="flex flex-col items-center gap-1 pt-1">
              <Lovy pose={LOVY_CLOSING_BODY_POSE} size={LOVY_SIZE.closing} decorative />
              <p className="text-[12.5px] font-medium keep-all text-ink-sub">
                이번엔 이걸 기억할게.
              </p>
            </div>
          ) : null}

          {/*
            파생 Chapter의 강조 문장. SO WHAT이 있는 Chapter에서는 이 문장이 ④ 근거
            토글 안으로 들어간다 — `그래서 무슨 의미야`와 같은 말을 두 번 하지 않는다.
          */}
          {soWhat ? null : (
            <p className="border-l-2 border-brand-soft bg-brand-tint px-3.5 py-2.5 text-[13px] font-medium keep-all leading-relaxed text-brand-ink">
              {chapter.deterministicTakeaway}
            </p>
          )}

          {/*
            ③ WHAT TO VERIFY — 확인해볼 질문과 체크포인트를 **한 블록으로 묶는다.**
            v1.46.3에서는 둘 사이에 `한계` 문장이 끼어 있어서 행동 제안이 두 군데로
            갈라져 보였다(실측).

            ⚠️ 처방이 아니다 — 전부 '확인해봐 · 구분해봐 · 정리해봐'이고 새 판단을
            만들지 않는다(`kind`와 Job 맥락만 읽는다).
          */}
          <div className="flex flex-col gap-2 rounded-[10px] border border-line-soft px-3.5 py-3">
            <p className="text-[10px] font-semibold tracking-[0.06em] text-mint-ink">
              {chapter.question ? VERIFY_LABEL : LOVY_CHECKPOINT_LABEL}
            </p>
            {chapter.question ? (
              <p className="text-[12.5px] font-medium keep-all leading-relaxed">
                {chapter.question}
              </p>
            ) : null}
            <p className="text-[12px] keep-all leading-relaxed text-ink-sub">{checkpoint}</p>
          </div>

          {/*
            ④ EVIDENCE — **기본 닫힘**(§7). 안에는 이 판정이 어디서 나왔는지가 전부
            들어 있다: 규칙 문장 · 강조 · 연결한 이유 · 근거 목록.

            ⚠️ 근거를 지운 게 아니다. Premium의 신뢰는 provenance에서 오고, 그건
            여전히 한 번의 탭으로 전부 보인다(§8).
            ⚠️ `deep_insight_evidence_expand`를 그대로 쓴다 — 새 이벤트를 만들지
            않는다(§18). property도 개수·축·id뿐이다(§48).
          */}
          {soWhat ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={evidenceOpen}
                onClick={() => {
                  const next = !evidenceOpen;
                  setEvidenceOpen(next);
                  if (next) {
                    trackEvent('deep_insight_evidence_expand', {
                      ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
                      insight: chapter.insightIds[0] ?? chapter.id,
                      axis: chapter.kind,
                      evidence_count: chapter.evidence.length,
                      source_count: chapter.sourceGroups.length,
                    });
                  }
                }}
                className="flex min-h-11 items-center gap-1 self-start text-[11.5px] font-semibold text-brand-pressed"
              >
                {EVIDENCE_TOGGLE_LABEL}
                <span
                  aria-hidden
                  className={cn(
                    'text-[10px] transition-transform duration-200 motion-reduce:transition-none',
                    evidenceOpen && 'rotate-180',
                  )}
                >
                  ▾
                </span>
              </button>

              {evidenceOpen ? (
                <div className="flex flex-col gap-3 rounded-[10px] bg-sunken px-3.5 py-3">
                  {/* 규칙이 실제로 뭐라고 판정했는지 — 사람이 검증할 수 있는 문장 */}
                  {summaryParagraphs.map((paragraph, index) => (
                    <p
                      key={`rule-${index}`}
                      className="text-[12.5px] keep-all leading-relaxed text-ink"
                    >
                      {paragraph}
                    </p>
                  ))}

                  <p className="border-l-2 border-brand-soft pl-3 text-[12.5px] font-medium keep-all leading-relaxed text-brand-ink">
                    {chapter.deterministicTakeaway}
                  </p>

                  {/*
                    §17 러비가 연결해본 이유 — **새 분석이 아니다.** 이 조합이 왜 나란히
                    놓을 수 있는 조합인지(구조적 이유)만 말한다.
                  */}
                  {reason ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                        러비가 연결해본 이유
                      </p>
                      <p className="text-[12px] keep-all leading-relaxed text-ink-sub">{reason}</p>
                    </div>
                  ) : null}

                  {chapter.evidence.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-faint">
                        연결한 근거
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {chapter.evidence.map((item) => (
                          <li key={item.key} className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
                              {item.sourceLabel}
                            </span>
                            {/* 저장된 label/summary 기반 — 자유서술 원문을 그대로 노출하지 않는다 */}
                            <span className="text-[12px] keep-all leading-relaxed text-ink">
                              {item.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 이 Chapter가 말할 수 없는 것 — 항상 있다(인과가 아니라 연관이라는 경계) */}
          <p className="border-l-2 border-line-strong pl-3 text-[11.5px] keep-all leading-relaxed text-ink-muted">
            {chapter.limitation}
          </p>

          {/*
            근거를 가진 Chapter만 되묻는다. 파생 Chapter(next_check · closing)에는
            되물을 판정이 없다 — 앞 Chapter에서 이미 물었다.
          */}
          {chapter.insightIds.length > 0 ? (
            <DeepInsightVerdict
              insightId={chapter.insightIds[0]!}
              funnelAnalysisId={funnelAnalysisId}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
