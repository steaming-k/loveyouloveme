import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { displayStateOf, valueToPercent } from '@/lib/logic/mirror';
import {
  hasTemporalComparison,
  scopeLabelOf,
  type RelationshipTense,
} from '@/lib/logic/relationshipEvidence';
import type { MirrorInsight, MirrorState } from '@/types';

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

/** 상태를 색만으로 구분하지 않기 위한 한국어 설명 */
const STATE_TEXT: Record<MirrorState, string> = {
  MATCH: '말한 기준과 비슷',
  GAP: '관계에서 더 크게',
  CHANGE: '경험 후 낮아짐',
  UNKNOWN: '관측 정보 부족',
};

/**
 * v1.41 §39.11 — 근거가 **지금 관계**에서 온 행의 스크린리더 문구.
 *
 * 위 표의 CHANGE는 `경험 후 낮아짐`인데, 그건 근거가 과거 경험일 때만 맞는 말이다.
 * 화면 본문(`insight.note`)은 이미 시점을 갈랐으므로 **보이지 않는 문구만 남으면
 * 스크린리더 사용자에게만 틀린 말이 간다** — 그건 더 나쁘다.
 */
const CURRENT_STATE_TEXT: Partial<Record<MirrorState, string>> = {
  CHANGE: '지금은 크게 드러나지 않음',
};

/**
 * v1.44 NEW-003 — 비교할 관계 근거가 **아예 없는** 행의 스크린리더 문구.
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
 * ⚠️ 트랙 위에는 '말한 나'(Declared) 점 하나만 정확한 위치로 찍는다. Relationship Me는
 * 과거 관계 질문에서 1~5 척도로 직접 수집된 값이 아니므로, 두 번째 점을 정밀한 위치에
 * 찍으면 실제보다 더 정밀하게 측정된 것처럼 보이는 착시가 생긴다. 대신 '관계 경험에서
 * 발견한 신호'는 방향(▲ 더 크게 반응 / ▼ 낮아짐 / ✓ 비슷함)과 근거 문장으로만 말한다.
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
   * 않는다(`displayStateOf`). 스크린리더 문구는 `stateTextOf`가 따로 정한다.
   */
  const shownState = displayStateOf(insight.state, insight.evidenceScope);

  return (
    <li
      className="reveal-up flex flex-col gap-3 rounded-row border border-line bg-surface px-[15px] py-3.5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <h3 className="text-[14.5px] font-medium tracking-[-0.2px]">{insight.label}</h3>
        <span
          className={cn(
            'flex-none rounded-[6px] px-2 py-1 text-label tracking-[0.06em]',
            STATE_TAG[shownState],
          )}
        >
          {shownState}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10.5px] text-ink-muted">
          <span>말한 나</span>
          {insight.declaredHasScale ? <span className="tnum">{insight.declared}/5</span> : null}
        </div>
        <div className="relative h-4" aria-hidden>
          <span className="absolute inset-x-0 top-[7px] h-1 rounded-sm bg-track" />
          <span
            className="absolute top-1 -ml-[7px] h-3 w-3 rounded-full border-2 border-ink-faint bg-surface"
            style={{ left: valueToPercent(insight.declared) }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-[10px] bg-sunken px-3 py-2.5">
        {/*
          v1.41 — 근거의 **시점**을 근거 문장 위에 한 조각으로 붙인다.
          `relationshipSignal` 문장에도 시점이 들어 있지만(`지금 관계에서 …`), 다섯 행을
          훑을 때 어느 행이 어느 시점인지 한눈에 보이는 것이 이 화면의 정직성이다.
        */}
        <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
          {scopeLabelOf(insight.evidenceScope, tense)}
        </span>
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
          <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">
            {insight.relationshipSignal}
          </p>
        </div>
      </div>

      <p className="sr-only">
        {insight.label}: 말한 나 {insight.declared}점. {stateTextOf(insight)}. 근거 시점:{' '}
        {scopeLabelOf(insight.evidenceScope, tense)}.
      </p>

      <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">{insight.note}</p>

      {footer}
    </li>
  );
}

/** 범례 — '말한 나'만 정확한 위치, 관계 경험 신호는 방향으로만 말한다는 것을 알려준다 */
/**
 * ⚠️ v1.36 — `항목별 대조`를 `h2`로 올렸다.
 *
 * 이 legend가 감싼 섹션에는 heading이 없었고, 안의 축 행들은 `h3`였다. 그래서
 * `/mirror`의 heading 순서가 **H1 → H3 → … → H2**로 역전됐다(실측). 이 문구가
 * 이미 그 섹션의 이름이므로 새 제목을 만들지 않고 level만 맞춘다.
 */
export function MirrorLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
      <h2 className="text-meta font-semibold text-ink-muted">항목별 대조</h2>
      <span className="flex items-center gap-1.5">
        <span
          className="h-[11px] w-[11px] rounded-full border-2 border-ink-faint bg-surface"
          aria-hidden
        />
        <span className="text-[11px] text-ink-muted">말한 나(정확한 위치)</span>
      </span>
      <span className="flex items-center gap-1.5">
        <ChevronUp size={12} className="text-brand" aria-hidden />
        <span className="text-[11px] text-ink-muted">관계 경험 신호(방향)</span>
      </span>
    </div>
  );
}
