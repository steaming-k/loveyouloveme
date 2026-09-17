'use client';

import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { ScaleHearts } from '@/components/common/ScaleHearts';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { ALREADY_KNOWN_LINE, isAlreadyKnown } from '@/lib/resultPriority';
import { displayStateOf, valueToPercent } from '@/lib/logic/mirror';
import {
  hasTemporalComparison,
  scopeLabelOf,
  type RelationshipTense,
} from '@/lib/logic/relationshipEvidence';
import type { MirrorInsight, MirrorState } from '@/types';

/**
 * ⚠️ 색 이름은 v1.47 그대로다(테스트가 `STATE_TAG[shownState]`를 찾는다). 바뀐 것은
 * 배지의 **형태**뿐이다: 알약(pill)에서 각진 evidence 표식으로. 상태는 더 이상
 * 색 tag 하나가 혼자 짊어지지 않는다 — 아래 `MirrorLink`가 같은 판정을 형태로 그린다.
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

/** 연결선의 색 — 배지와 같은 판정을 같은 색으로 말한다 */
const STATE_STROKE: Record<MirrorState, string> = {
  MATCH: 'var(--color-mint)',
  GAP: 'var(--color-brand)',
  CHANGE: 'var(--color-friction)',
  UNKNOWN: 'var(--color-rule-mid)',
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
 * ══ 두 자아를 잇는 선 (v1.48 · Signature) ═══════════════════════════════════
 *
 * 이 제품의 Core Value는 한 문장이다: **내가 생각한 나 vs 관계에서 나타난 너.**
 * 그런데 화면에서는 그 둘이 그냥 위아래로 놓인 텍스트 두 덩어리였고, 관계는
 * `GAP` 같은 **색 tag 하나**가 전부 짊어지고 있었다.
 *
 * 여기서 두 정보가 실제 판정에 맞는 **형태**를 갖는다:
 *
 * ```
 *  말한 나      ───────────●            ← 정확한 위치
 *                          ╲
 *                           ╲  벌어짐    ← GAP  : 오른쪽 아래로 벌어진다
 *  관계에서     ──────────────●
 *
 *  말한 나      ───────────●
 *                          │  겹침      ← MATCH : 같은 자리로 곧게 내려온다
 *  관계에서     ───────────●
 *
 *  말한 나      ───────────●
 *                         ╱
 *                        ╱    낮아짐     ← CHANGE: 왼쪽 아래로 물러난다
 *  관계에서     ──────●
 * ```
 *
 * ══ ⚠️ 없는 정밀도를 만들지 않는다 ═══════════════════════════════════════════
 *
 * 선의 **시작점만** 정확하다 — 그건 `insight.declared`(1~5로 직접 답한 값)의 위치다.
 * 도착점은 위치가 아니라 **방향**이다. Relationship Me는 1~5로 수집된 값이 아니므로
 * (이 파일이 v1.20부터 지켜온 규칙), 도착점을 정확한 좌표처럼 찍으면 그 순간 이
 * 그림은 거짓말이 된다. 방향은 이미 배지·화살표가 말하던 것과 **같은 판정**이고,
 * 여기서는 그것을 선의 기울기로 한 번 더 말할 뿐이다.
 *
 * UNKNOWN은 점선이고, 아래까지 내려가지 않고 도중에 끊긴다 — '아직 이어지지 않았다'가
 * 그림 그대로다.
 */
function MirrorLink({ state, declared }: { state: MirrorState; declared: number }) {
  /** 시작 x — 위 트랙의 '말한 나' 점과 같은 위치. 문자열 `NN%`에서 숫자만 꺼낸다 */
  const startX = Number.parseFloat(valueToPercent(declared));
  const drift = state === 'GAP' ? 22 : state === 'CHANGE' ? -22 : 0;
  const endX = Math.min(94, Math.max(6, startX + drift));

  const dashed = state === 'UNKNOWN';
  const endY = dashed ? 17 : 28;

  return (
    /*
      ⚠️ SVG는 `preserveAspectRatio="none"`로 가로로 늘어난다 — 선은 `non-scaling-stroke`가
      두께를 지켜주지만 **fill 도형은 타원으로 찌그러진다.** 그래서 도달 표식은
      SVG 안이 아니라 HTML로 그리고, 같은 x(%) 위에 얹는다.
    */
    <div className="relative h-7 w-full">
      <svg
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden
        focusable="false"
      >
        <path
          d={`M ${startX} 0 C ${startX} 14, ${endX} 14, ${endX} ${endY}`}
          fill="none"
          stroke={STATE_STROKE[state]}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={dashed ? '3 4' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/*
        선은 허공에서 끝나지 않고 **도달한 자리에 표식을 남긴다.** 그 표식
        바로 아래에 관계 근거가 오므로 '여기에서 이것을 봤다'가 이어진다.
        UNKNOWN은 아직 도달하지 않았으니 표식도 찍지 않는다.
      */}
      {dashed ? null : (
        <span
          aria-hidden
          className="absolute bottom-0 -ml-[3px] h-[6px] w-[6px] rounded-full"
          style={{ left: `${endX}%`, backgroundColor: STATE_STROKE[state] }}
        />
      )}
    </div>
  );
}

/**
 * Mirror Gap Map — 항목별 대조 행 (S27)
 *
 * ══ v1.48 — 카드에서 **편집 행**으로 ════════════════════════════════════════
 *
 * 예전에는 `rounded-row border bg-surface` 카드가 축 개수만큼 세로로 쌓였다. 네 개의
 * 똑같은 흰 카드가 오른쪽 위 색 tag 하나로만 갈리는 화면이었고, 그건 이 제품의 가장
 * 중요한 순간을 '설문 결과 목록'처럼 보이게 했다.
 *
 * 지금은 카드가 없다. 위쪽 얇은 rule로 행을 열고, 그 안에서
 * **말한 나(트랙) → 연결선(판정) → 관계에서(근거)** 가 하나의 구성으로 읽힌다.
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

  /**
   * §13 — 이미 알고 있던 기준은 기본적으로 접는다. 나머지 행은 예전 그대로 전부 펼쳐진다.
   */
  const compact = isAlreadyKnown(insight);
  const [open, setOpen] = useState(false);
  const detailVisible = !compact || open;

  return (
    <li
      className="reveal-up flex flex-col gap-2.5 border-t border-[color:var(--color-rule-hair)] px-1 pt-4 pb-1"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <h3 className="text-[15px] font-semibold tracking-[-0.3px]">{insight.label}</h3>
        {/*
          배지는 각진 evidence 표식이다(radius 3px) — 알약이 아니다. 같은 판정을
          아래 연결선이 형태로 한 번 더 말하므로, 여기서는 이름만 조용히 붙인다.
        */}
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

        실측에서 고데이터 세션의 네 축 중 셋이 MATCH였고, 그 세 행이 각각 눈금 ·
        근거 문장 · 해석 문장까지 전부 펼쳐진 채 화면 위쪽을 차지했다. 사용자가 처음
        읽는 세 문단이 전부 '네가 말한 대로였어'였다는 뜻이다(UT-1: 이미 아는 내용).

        ⚠️ **판정을 숨기지 않는다.** 배지(MATCH)와 축 이름은 그대로 보이고, 눈금 ·
        근거 · 해석은 `자세히` 안에 전부 있다. 순서도 `resultPriority`가 GAP → CHANGE →
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

      {/* ── 위: 말한 나 ─────────────────────────────────────────────────── */}
      {detailVisible ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="evidence-source">말한 나</span>
            {insight.declaredHasScale ? <ScaleHearts value={insight.declared} /> : null}
          </div>
          <div className="relative h-4" aria-hidden>
            <span className="absolute inset-x-0 top-[7px] h-px bg-rule-hair" />
            <span
              className="absolute top-1 -ml-[7px] h-3 w-3 rounded-full border-2 border-ink-faint bg-surface"
              style={{ left: valueToPercent(insight.declared) }}
            />
          </div>
        </div>
      ) : null}

      {/* ── 사이: 두 자아를 잇는 선. 판정이 형태가 되는 자리다 ───────────── */}
      {detailVisible ? (
        /*
          ⚠️ 선 옆에 상태 단어를 또 적지 않는다. 이름은 위의 배지가 이미 말했고,
          이 자리가 하는 일은 그 판정을 **형태로** 한 번 더 말하는 것이다 —
          같은 말을 글자로 두 번 쓰면 그건 위계가 아니라 중복이다.
        */
        <MirrorLink state={shownState} declared={insight.declared} />
      ) : null}

      {/* ── 아래: 관계에서 나타난 나 (근거) ──────────────────────────────── */}
      {detailVisible ? (
        <div className="surf-evidence flex flex-col gap-1.5">
          {/*
            v1.41 — 근거의 **시점**을 근거 문장 위에 한 조각으로 붙인다.
            `relationshipSignal` 문장에도 시점이 들어 있지만(`지금 관계에서 …`), 다섯 행을
            훑을 때 어느 행이 어느 시점인지 한눈에 보이는 것이 이 화면의 정직성이다.
          */}
          <span className="evidence-source">{scopeLabelOf(insight.evidenceScope, tense)}</span>
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

      {detailVisible ? (
        <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">{insight.note}</p>
      ) : null}

      {detailVisible ? footer : null}
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
