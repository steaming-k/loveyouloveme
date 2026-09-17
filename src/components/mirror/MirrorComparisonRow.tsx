'use client';

import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { ScaleHearts } from '@/components/common/ScaleHearts';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { ALREADY_KNOWN_LINE, isAlreadyKnown } from '@/lib/resultPriority';
import { displayStateOf } from '@/lib/logic/mirror';
import {
  hasTemporalComparison,
  scopeLabelOf,
  type RelationshipTense,
} from '@/lib/logic/relationshipEvidence';
import type { MirrorInsight, MirrorState } from '@/types';

/**
 * ⚠️ 색 이름은 v1.47 그대로다(테스트가 `STATE_TAG[shownState]`를 찾는다).
 * 배지의 **형태**만 각진 evidence 표식이다 — 알약이 아니다.
 */
const STATE_TAG: Record<MirrorState, string> = {
  MATCH: 'bg-mint-tint text-mint-deep',
  GAP: 'bg-brand-tint text-brand-pressed',
  CHANGE: 'bg-friction-tint text-friction-text',
  UNKNOWN: 'bg-chip text-ink-muted',
};

const STATE_DOT: Record<MirrorState, string> = {
  MATCH: 'bg-mint',
  GAP: 'bg-brand',
  CHANGE: 'bg-friction',
  UNKNOWN: 'bg-ink-faint',
};

/** 두 자아 사이 구분선의 색 — 배지와 같은 판정을 같은 색으로 말한다 */
const STATE_RULE: Record<MirrorState, string> = {
  MATCH: 'bg-mint',
  GAP: 'bg-brand-soft',
  CHANGE: 'bg-friction',
  UNKNOWN: 'bg-rule-hair',
};

const STATE_INK: Record<MirrorState, string> = {
  MATCH: 'text-mint-deep',
  GAP: 'text-brand-pressed',
  CHANGE: 'text-friction-text',
  UNKNOWN: 'text-ink-muted',
};

/** 상태를 색만으로 구분하지 않기 위한 한국어 설명 */
const STATE_TEXT: Record<MirrorState, string> = {
  MATCH: '말한 기준과 비슷',
  GAP: '관계에서 더 크게',
  CHANGE: '경험 후 낮아짐',
  UNKNOWN: '관측 정보 부족',
};

/**
 * v1.41 §39.11 — 근거가 **지금 관계**에서 온 행의 문구.
 *
 * 위 표의 CHANGE는 `경험 후 낮아짐`인데, 그건 근거가 과거 경험일 때만 맞는 말이다.
 * 화면 본문(`insight.note`)은 이미 시점을 갈랐으므로 **보이지 않는 문구만 남으면
 * 스크린리더 사용자에게만 틀린 말이 간다** — 그건 더 나쁘다.
 */
const CURRENT_STATE_TEXT: Partial<Record<MirrorState, string>> = {
  CHANGE: '지금은 크게 드러나지 않음',
};

/**
 * v1.44 NEW-003 — 비교할 관계 근거가 **아예 없는** 행의 문구.
 *
 * v1.41은 위 `'current'` 갈래만 만들었고 `'none'`은 `STATE_TEXT`의 `경험 후 낮아짐`으로
 * 떨어졌다. 그 행의 근거 칸은 `이전 관계에서 …꼽지는 않았어`라고 말하고 있으므로,
 * **보이는 근거와 들리는 판정이 서로 반대**였다 — v1.41이 "보이지 않는 문구만 남으면
 * 스크린리더 사용자에게만 틀린 말이 간다"고 적어둔 것과 같은 종류의 실패다.
 */
const NO_EVIDENCE_STATE_TEXT: Partial<Record<MirrorState, string>> = {
  CHANGE: '비교할 관계 근거 없음',
};

function stateTextOf(insight: MirrorInsight): string {
  if (insight.evidenceScope === 'current') {
    return CURRENT_STATE_TEXT[insight.state] ?? STATE_TEXT[insight.state];
  }
  if (!hasTemporalComparison(insight.evidenceScope)) {
    return NO_EVIDENCE_STATE_TEXT[insight.state] ?? STATE_TEXT[insight.state];
  }
  return STATE_TEXT[insight.state];
}

/**
 * Mirror Gap Map — 항목별 대조 행 (S27)
 *
 * ══ v1.48.1 — pseudo-chart를 **걷어냈다** ═══════════════════════════════════
 *
 * v1.48이 이 자리에 두 가지를 그렸다: ① `말한 나`의 1~5 값을 트랙 위 점 하나로 찍고,
 * ② 그 점에서 아래로 곡선(`MirrorLink`)을 뻗어 기울기로 GAP/MATCH/CHANGE를 표현했다.
 * 실제 화면에서 이건 FAIL이었다:
 *
 * ```
 *   ① 점 하나만 있는 트랙은 차트가 아니다 — 옆의 하트와 `2/5`가 같은 값을 이미
 *      더 정확하게 말하고 있어서, 트랙은 정보를 더하지 않고 해석 부담만 더했다
 *   ② 곡선은 허공에서 끝났고, '변화 / 이동 / 시계열 / 거리'처럼 읽혔다
 *   ③ 도착점은 좌표가 아니라 방향이었는데, 그림은 좌표처럼 보였다 —
 *      **시각적 정밀도가 데이터 정밀도를 넘었다**
 *   ④ 그래서 `말한 나(정확한 위치) · 관계 경험 신호(방향)` 사용 설명 범례가 필요했다.
 *      시각화에 사용법이 필요하면 그 시각화는 실패한 것이다
 * ```
 *
 * ══ 지금 구조 ═══════════════════════════════════════════════════════════════
 *
 * Mirror는 **차트가 아니라 editorial observation**이다. 대조는 typography ·
 * alignment · spacing · rule로만 만든다.
 *
 * ```
 * 연락                                        GAP
 *   말한 나                          ♥♥♡♡♡ 2/5
 *   연락은 크게 중요하지 않은 편
 *   ──────── 관계에서 더 크게 ────────
 *     관계에서 나타난 나                    ← GAP은 한 칸 들여쓴다(분리감)
 *     ▲ 이전 관계에서 연락 감소가 가장 힘들었음으로 선택
 * 중요하지 않다고 생각했지만 관계에서는 생각보다 크게 반응했어.
 * ```
 *
 * ⚠️ **좌표·거리·막대·퍼센트·축이 하나도 없다.** 정확한 값은 `말한 나` 쪽에만 있고,
 * 그건 실제로 1~5로 직접 수집한 값이라 하트와 숫자로 그대로 적는다(`ScaleHearts`).
 * `관계에서 나타난 나`는 숫자가 아니라 문장이므로 문장으로만 말한다 — 이 비대칭이
 * 데이터의 비대칭 그대로다.
 *
 * ⚠️ 판정 문구(`stateTextOf`)는 **새로 지은 카피가 아니다.** v1.41부터 있던 문구이고
 * 예전에는 스크린리더에만 읽혔다. 곡선이 하던 일을 이 문구가 대신한다.
 */
export function MirrorComparisonRow({
  insight,
  index,
  tense,
  footer,
}: {
  insight: MirrorInsight;
  index: number;
  /**
   * v1.41 §39.9~§39.10 — 이 행의 근거를 **어느 시점의 이름으로 부르는가**.
   *
   * ⚠️ **카드를 추가하지 않았다.** 축별로 source가 섞일 수 있으므로 화면이 전체를
   * `지금 관계 속의 나`라고 부르면 거짓인데, 그걸 해결하려고 섹션이나 카드를 새로
   * 만들면 정보 밀도만 늘고 읽기 깊이가 무너진다(§39.10). 그래서 **이미 있는 근거
   * 칸의 라벨 한 조각**으로만 표시한다.
   */
  tense: RelationshipTense;
  /**
   * v1.7 — AI 설명 1~2줄을 붙이는 슬롯(§21).
   * 규칙이 만든 `insight.note` **뒤**에 온다. 이 행의 주인공은 대조 자체다.
   */
  footer?: ReactNode;
}) {
  /**
   * ⚠️ v1.44 R-9 — **배지·점·아이콘은 표시용 이름을 쓴다.** `insight.state`는 내부
   * 판정이라 언제나 `CHANGE`이고, 비교 근거가 없으면 그것을 `CHANGE`라고 **부르지**
   * 않는다(`displayStateOf`). 문구는 `stateTextOf`가 따로 정한다.
   */
  const shownState = displayStateOf(insight.state, insight.evidenceScope);

  /**
   * §13 — 이미 알고 있던 기준은 기본적으로 접는다. 나머지 행은 예전 그대로 전부 펼쳐진다.
   */
  const compact = isAlreadyKnown(insight);
  const [open, setOpen] = useState(false);
  const detailVisible = !compact || open;

  /**
   * §8 — 상태를 **composition으로** 말한다. 좌표가 아니라 간격과 정렬이다.
   *
   *   MATCH   두 블록이 붙어 있고 왼쪽 끝이 맞는다 (정렬 · 가까움)
   *   GAP     간격이 벌어지고 관계 쪽이 한 칸 들여쓰인다 (분리감)
   *   CHANGE  간격이 벌어지지만 들여쓰지 않는다 — 방향은 아이콘이 이미 말한다
   *   UNKNOWN 강한 표현을 만들지 않는다 (기본 간격 · 들여쓰기 없음)
   */
  const separated = shownState === 'GAP' || shownState === 'CHANGE';
  const indented = shownState === 'GAP';

  return (
    <li
      className="reveal-up flex flex-col gap-3 border-t border-[color:var(--color-rule-hair)] px-1 pt-4 pb-1"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <h3 className="text-[15px] font-semibold tracking-[-0.3px]">{insight.label}</h3>
        <span
          className={cn(
            'flex-none rounded-[3px] px-[7px] py-[3px] text-label tracking-[0.08em]',
            STATE_TAG[shownState],
          )}
        >
          {shownState}
        </span>
      </div>

      {/*
        ══ v1.46.4 §13 — 이미 알고 있던 기준(`MATCH`)은 한 줄로 접는다 ═══════

        실측에서 고데이터 세션의 네 축 중 셋이 MATCH였고, 그 세 행이 각각 근거 문장 ·
        해석 문장까지 전부 펼쳐진 채 화면 위쪽을 차지했다. 사용자가 처음 읽는 세
        문단이 전부 '네가 말한 대로였어'였다는 뜻이다(UT-1: 이미 아는 내용).

        ⚠️ **판정을 숨기지 않는다.** 배지(MATCH)와 축 이름은 그대로 보이고, 두 자아의
        대조는 `자세히` 안에 전부 있다. 순서도 `resultPriority`가 GAP → CHANGE →
        MATCH로 바꿔서, 새로 알게 되는 것이 먼저 온다.
      */}
      {compact ? (
        <>
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
            {ALREADY_KNOWN_LINE}
          </p>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            className="flex min-h-11 items-center gap-1 self-start text-[11.5px] font-semibold text-brand-pressed"
          >
            자세히
            <span
              aria-hidden
              className={cn(
                'text-[10px] transition-transform duration-200 motion-reduce:transition-none',
                open && 'rotate-180',
              )}
            >
              ▾
            </span>
          </button>
        </>
      ) : null}

      {detailVisible ? (
        <div className={cn('flex flex-col', separated ? 'gap-4' : 'gap-2.5')}>
          {/* ── 위: 내가 생각한 나 ──────────────────────────────────────── */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="evidence-source">말한 나</span>
              {insight.declaredHasScale ? (
                <ScaleHearts value={insight.declared} className="text-[11px] text-ink-sub" />
              ) : null}
            </div>
            {/*
              ⚠️ 트랙 위의 점을 이 문장이 대신한다. `declaredPhrase`는 사용자가 고른
              보기를 그대로 부르는 말이라(계산이 아니다), 점 위치보다 정확하고 바로 읽힌다.
            */}
            <p className="text-[13.5px] keep-all leading-relaxed text-ink">
              {insight.declaredPhrase}
            </p>
          </div>

          {/* ── 사이: 판정. 곡선이 하던 일을 rule과 문구가 한다 ──────────── */}
          <div className="flex items-center gap-2.5" aria-hidden>
            <span className={cn('h-px w-5 flex-none', STATE_RULE[shownState])} />
            <span className={cn('flex-none text-[11px] font-semibold', STATE_INK[shownState])}>
              {stateTextOf(insight)}
            </span>
            <span className={cn('h-px min-w-0 flex-1', STATE_RULE[shownState])} />
          </div>

          {/* ── 아래: 관계에서 나타난 나 ────────────────────────────────── */}
          <div className={cn('flex flex-col gap-1.5', indented && 'pl-3.5')}>
            <span className="evidence-source">관계에서 나타난 나</span>
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-white',
                  STATE_DOT[shownState],
                )}
                aria-hidden
              >
                {shownState === 'GAP' ? <ChevronUp size={11} strokeWidth={3} /> : null}
                {/* 아래 화살표는 '낮아짐'이라는 방향 주장이다 — 근거가 없으면 붙이지 않는다 */}
                {shownState === 'CHANGE' ? <ChevronDown size={11} strokeWidth={3} /> : null}
                {shownState === 'MATCH' ? <Check size={10} strokeWidth={3} /> : null}
              </span>
              <p className="text-[13px] keep-all leading-relaxed text-ink">
                {insight.relationshipSignal}
              </p>
            </div>
            {/*
              v1.41 — 근거의 **시점**을 근거 문장 아래 한 조각으로 붙인다. 다섯 행을
              훑을 때 어느 행이 어느 시점인지 한눈에 보이는 것이 이 화면의 정직성이다.
            */}
            <span className="pl-6 text-[10.5px] text-ink-muted">
              {scopeLabelOf(insight.evidenceScope, tense)}
            </span>
          </div>
        </div>
      ) : null}

      {/*
        ⚠️ 스크린리더 문장은 **접힘과 무관하게 항상 있다.** 시각적으로 접은 것은
        위계이지 정보 차단이 아니고, 보조기술 사용자에게 한 줄 요약만 남기면 그건
        정보 차단이 된다.
      */}
      <p className="sr-only">
        {insight.label}: 말한 나 {insight.declared}점. {stateTextOf(insight)}. 근거 시점:{' '}
        {scopeLabelOf(insight.evidenceScope, tense)}.
      </p>

      {/* 러비의 해석 — 두 자아를 다 읽은 뒤에 온다 */}
      {detailVisible ? (
        <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">{insight.note}</p>
      ) : null}

      {detailVisible ? footer : null}
    </li>
  );
}
