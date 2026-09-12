'use client';

import { useState } from 'react';

import { Tag } from '@/components/common/primitives';
import { cn } from '@/lib/cn';
import { lensForAxis } from '@/lib/logic/insightCandidates';
import { EVIDENCE_TOGGLE_LABEL, SO_WHAT_LABEL, VERIFY_LABEL, WHY_LABEL } from '@/lib/premiumSoWhat';
import type {
  DeepReportedScene,
  InsightCandidate,
  PremiumChapter,
  PremiumLensEntry,
} from '@/types';

/**
 * Premium 첫 화면 — **이번 관계에서 중요한 3가지** (v1.46.4 · §22 · §26 · §33 · §36)
 *
 * ══ 이 블록이 뒤집은 순서 ═════════════════════════════════════════════════
 *
 * ```
 * v1.46.3   연결한 근거(펼쳐짐) → 러비가 연결한 이유 → 규칙 요약 → 확인해볼 것
 * v1.46.4   SO WHAT → 왜 중요해 → 물어볼 것 → (펼치면) 왜 이렇게 봤어?
 * ```
 *
 * 사용자가 **처음 읽는 문장이 자기가 입력한 값이 아니어야 한다**는 것이 이 개편의
 * 전부다(§46 · VALUE-01). 그래서 근거 블록은 지워지지 않고 **접힌다** — 정보를 빼는
 * 게 아니라 위계를 만드는 것이다.
 *
 * ══ 이 컴포넌트가 만들지 않는 것 ══════════════════════════════════════════
 *
 * ⚠️ **문장을 만들지 않는다.** `candidate.soWhat` · `whyItMatters` · `questions`는
 * 전부 `logic/insightCandidates.ts`가 조립한 값이다. 화면이 문장을 조금이라도 만들면
 * fixture가 검사하는 값과 사용자가 읽는 값이 갈라진다 — v1.41 §39.9가 시제를 놓친 자리다.
 *
 * ⚠️ **개수를 채우지 않는다.** Candidate가 2개면 2개만 그린다. 질문이 0개면 그 칸이
 * 통째로 없다(§26 마지막 줄).
 */

/** §22 — 첫 화면의 주인공 수. 3보다 많으면 '중요한 것'이 아니게 된다 */
const TOP_COUNT = 3;

export function PremiumCandidateSection({
  candidates,
  chapters,
  scenes,
  lenses,
}: {
  /** 이미 §14 우선순위로 정렬돼 있다. 화면은 앞에서 자르기만 한다 */
  candidates: readonly InsightCandidate[];
  /** 근거 토글이 읽는다. `candidate.chapterId`로 찾는다 */
  chapters: readonly PremiumChapter[];
  /**
   * §36 — 관련 장면을 **원문 그대로** 보여주기 위해 필요하다.
   *
   * ⚠️ `RelationshipEvent`(세션 원본)가 아니라 `DeepReportedScene`을 받는다.
   * 리포트가 이미 만든 표시용 구조이고, 라벨·귀속 문구가 거기서 한 번 정리된다
   * (`logic/relationshipEvents.ts` · `buildReportedScenes`). 화면이 원본을 직접
   * 읽으면 그 정리 계층을 우회하게 된다.
   */
  scenes: readonly DeepReportedScene[];
  /** §33 — 이 결과를 다른 관점에서 보면. 없으면 그 줄이 없다 */
  lenses: readonly PremiumLensEntry[];
}) {
  const top = candidates.slice(0, TOP_COUNT);
  if (top.length === 0) return null;

  /*
    §33 — **같은 렌즈 줄을 카드마다 반복하지 않는다.**

    ⚠️ 브라우저 실측에서 세 카드 전부에 `이 결과를 다른 관점에서 보면 · MBTI 관계
    렌즈`가 **글자 그대로 같은 문장**으로 붙었다. `lensForAxis`가 `contact`와
    `conflict`를 둘 다 MBTI로 보내기 때문이고, 그 매핑 자체는 맞다. 틀린 것은
    같은 말을 세 번 하는 것이다 — §31이 질문에서 막는 것과 같은 종류의 중복이다.

    그래서 렌즈 하나는 **처음 이어지는 카드에서만** 말한다. 나머지 카드에서는
    렌즈 줄이 없고, 렌즈 전체 결과는 아래 렌즈 섹션에 그대로 있다.
  */
  const lensShown = new Set<string>();

  return (
    <ol className="flex flex-col gap-2.5">
      {top.map((candidate, index) => {
        const lensKind = lensForAxis(candidate.primaryAxis);
        const lens =
          lensKind && !lensShown.has(lensKind)
            ? (lenses.find((entry) => entry.kind === lensKind && entry.mode !== 'unavailable') ??
              null)
            : null;
        if (lens) lensShown.add(lens.kind);

        return (
          <CandidateCard
            key={candidate.id}
            index={index}
            candidate={candidate}
            chapter={chapters.find((item) => item.id === candidate.chapterId) ?? null}
            scenes={scenes}
            lens={lens}
          />
        );
      })}
    </ol>
  );
}

function CandidateCard({
  candidate,
  chapter,
  scenes,
  lens,
  index,
}: {
  candidate: InsightCandidate;
  chapter: PremiumChapter | null;
  scenes: readonly DeepReportedScene[];
  /** §33 — 이 카드에서 이을 렌즈. 이미 다른 카드가 말했거나 없으면 null */
  lens: PremiumLensEntry | null;
  index: number;
}) {
  /** §36 — **기본 닫힘.** 열려 있으면 첫 화면이 다시 근거로 시작한다(VALUE-04) */
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const linkedScenes = candidate.relevantEventIds
    .map((id) => scenes.find((scene) => scene.id === id))
    .filter((scene): scene is DeepReportedScene => Boolean(scene));

  return (
    <li className="flex flex-col gap-2.5 rounded-card border border-line bg-surface px-4 py-4">
      <div className="flex items-baseline gap-2">
        <span className="flex-none text-[11px] font-semibold tnum text-ink-faint">
          {String(index + 1).padStart(2, '0')}
        </span>
        <p className="min-w-0 text-[10.5px] font-semibold tracking-[0.04em] text-mint-ink">
          {candidate.headline}
        </p>
        {/*
          근거가 한 종류뿐이면 그렇게 말한다. **숨기지 않는다** — 근거 두께를 말하지
          않으면 모든 결론이 같은 무게로 읽힌다(§12 confidenceLevel).
        */}
        {candidate.confidenceLevel === 'limited' ? (
          <Tag tone="neutral">근거 1종</Tag>
        ) : null}
      </div>

      {/* ① SO WHAT — 이 카드에서 가장 큰 글자. 근거보다 먼저 온다 */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold tracking-[0.04em] text-ink-faint">
          {SO_WHAT_LABEL}
        </p>
        <p className="text-[13.5px] font-semibold keep-all leading-relaxed">{candidate.soWhat}</p>
      </div>

      {/* ② WHY IT MATTERS */}
      {candidate.whyItMatters ? (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold tracking-[0.04em] text-ink-faint">{WHY_LABEL}</p>
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
            {candidate.whyItMatters}
          </p>
        </div>
      ) : null}

      {/*
        ③ 확인해볼 것 — §32. Premium 첫 화면의 Candidate 중 최소 하나에는 **바로 써볼 수
        있는 질문**이 있어야 한다. 여기서 개수를 채우지 않는다: `questions`가 비면
        (ended·none·상대 모름) 이 블록이 통째로 없다.
      */}
      {candidate.questions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold tracking-[0.04em] text-ink-faint">
            {VERIFY_LABEL}
          </p>
          <ul className="flex flex-col gap-1.5">
            {candidate.questions.map((question) => (
              <li
                key={question.id}
                className="flex flex-col gap-1 rounded-row bg-brand-tint px-3 py-2.5"
              >
                {/*
                  ⚠️ 질문을 **따옴표 안에** 둔다. 이 문장은 설명이 아니라 그대로 보낼 수
                  있는 말이라는 뜻이고(§28), 인용부호가 그 역할을 한다.
                */}
                <p className="text-[12.5px] keep-all leading-relaxed text-brand-pressed">
                  “{question.text}”
                </p>
                <p className="text-[11px] keep-all text-ink-muted">{question.basis}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        ④ §33 — 이 결과를 다른 관점에서 보면. **결론이 아니라 프레임이다**(§34).
        그래서 렌즈 문장을 근거처럼 나열하지 않고 한 줄로만 잇는다.
      */}
      {lens && lens.mode !== 'unavailable' ? (
        <p className="rounded-row bg-sunken px-3 py-2.5 text-[11.5px] keep-all leading-relaxed text-ink-sub">
          <span className="font-semibold">이 결과를 다른 관점에서 보면 · {lens.label}</span>
          <br />
          {lens.soWhat ?? lens.overview}
        </p>
      ) : null}

      {/*
        ⑤ §36 — 근거 토글. **기본 닫힘.** 안에는 출처별로: 네가 고른 답 / 관계 경험 /
        상대 정보 / 기억나는 장면.

        ⚠️ 여기 있는 문장이 **사용자 입력값**이다. 위 ①~④에는 이 값이 없어야 하고,
        그게 VALUE-01이 검사하는 것이다.
      */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setEvidenceOpen((prev) => !prev)}
          aria-expanded={evidenceOpen}
          className="flex min-h-11 items-center gap-1.5 text-left text-[11.5px] text-ink-muted press-scale"
        >
          {EVIDENCE_TOGGLE_LABEL}
          <span className={cn('transition-transform t-fast', evidenceOpen && 'rotate-180')}>▾</span>
        </button>

        {evidenceOpen ? (
          <div className="flex flex-col gap-2 rounded-row bg-sunken px-3 py-3">
            {chapter && chapter.evidence.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {chapter.evidence.map((item) => (
                  <li key={item.key} className="flex flex-col gap-0.5">
                    <span className="text-[10.5px] font-semibold tracking-[0.04em] text-ink-faint">
                      {item.sourceLabel}
                    </span>
                    <span className="text-[11.5px] keep-all leading-relaxed text-ink-sub">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {/*
              §36 — 네가 알려준 장면은 **원문 그대로.** 요약하거나 다듬지 않는다.
              §17 — 라벨의 주어는 언제나 사용자다(`네가 알려준 …`).
            */}
            {linkedScenes.length > 0 ? (
              <ul className="flex flex-col gap-1.5 border-t border-line pt-2">
                {linkedScenes.map((scene) => (
                  <li key={scene.id} className="flex flex-col gap-0.5">
                    <span className="text-[10.5px] font-semibold tracking-[0.04em] text-mint-ink">
                      네가 알려준 장면 · {scene.typeLabel}
                    </span>
                    <span className="text-[11.5px] keep-all leading-relaxed text-ink-sub">
                      {scene.fact}
                    </span>
                    {scene.myReaction ? (
                      <span className="text-[11px] keep-all text-ink-faint">
                        그때 나는 · {scene.myReaction}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="border-t border-line pt-2 text-[11px] keep-all leading-relaxed text-ink-faint">
              {candidate.limitation}
            </p>
          </div>
        ) : null}
      </div>
    </li>
  );
}
