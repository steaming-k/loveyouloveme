'use client';

import type { InsightCandidate } from '@/types';

/**
 * 무료 결과의 **첫 Insight** (v1.46.4 · §18 ~ §21)
 *
 * ══ 무료 화면의 역할이 바뀌었다 ═══════════════════════════════════════════
 *
 * ```
 * v1.46.3   비교 행(내가 말한 것 · 관계에서 보인 것) → 러비 한 줄 → 유료 유도
 * v1.46.4   Observation → First Insight → 확인할 질문 → 열린 질문 → 유료 유도
 * ```
 *
 * 예전 무료 화면의 첫 문장은 사용자가 입력한 값 두 개를 나란히 놓은 것이었다. 비교
 * 자체는 유용하지만 그건 **관찰**이지 **의미**가 아니고, 그래서 UT 참여자가
 * "내가 쓴 걸 다시 읽는다"고 말했다 — 유료 이전에 무료에서 먼저 그랬다.
 *
 * ⚠️ **무료에서 유료 재료를 쓰지 않는다**(§20). 이 블록의 입력은 Mirror 행 하나이고
 * (`buildFreeCandidates`), cross-source 연결·여러 장면의 반복·Lens 통합 해석은
 * 여기 오지 않는다. 그 경계가 흐려지면 유료에서 팔 것이 사라진다.
 *
 * ⚠️ **문장을 만들지 않는다.** 전부 `logic/insightCandidates.ts`가 조립한 값이다.
 */
export function FreeInsightSection({
  candidates,
  openQuestion,
}: {
  candidates: readonly InsightCandidate[];
  /** §19 — 마지막 한 줄. 주어가 '나'라서 `ended`에서도 안전하다 */
  openQuestion: string | null;
}) {
  if (candidates.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <p className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">
          여기서 먼저 보이는 것
        </p>
        <h2 className="text-section keep-all font-semibold">그래서 이게 무슨 의미야</h2>
      </div>

      <ul className="flex flex-col gap-2.5">
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className="flex flex-col gap-2 rounded-card border border-line bg-surface px-4 py-3.5"
          >
            {/* ① SO WHAT — 무료에서도 결론이 먼저다 */}
            <p className="text-[13.5px] font-semibold keep-all leading-relaxed">
              {candidate.soWhat}
            </p>
            {/* ② 왜 중요한지 */}
            <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
              {candidate.whyItMatters}
            </p>

            {/*
              ③ §19 — 확인할 질문. 무료에서는 **하나까지만**이고, 재료가 없으면
              (`ended`·상대 모름) 이 자리가 통째로 없다.
            */}
            {candidate.questions.map((question) => (
              <div
                key={question.id}
                className="flex flex-col gap-1 rounded-row bg-brand-tint px-3 py-2.5"
              >
                <p className="text-[12.5px] keep-all leading-relaxed text-brand-pressed">
                  “{question.text}”
                </p>
                <p className="text-[11px] keep-all text-ink-muted">{question.basis}</p>
              </div>
            ))}

            {/* ④ 이 관찰이 말할 수 없는 것. 항상 있다 */}
            <p className="text-[11px] keep-all leading-relaxed text-ink-faint">
              {candidate.limitation}
            </p>
          </li>
        ))}
      </ul>

      {/*
        §19 — 열린 질문 하나로 닫는다. **상대에게 보내는 질문이 아니다** — 주어가
        '나'이고, 그래서 `ended`에서도 이 줄은 남는다(QUESTION-FIT-04).
      */}
      {openQuestion ? (
        <p className="rounded-row bg-sunken px-3.5 py-3 text-[12.5px] keep-all leading-relaxed text-ink-sub">
          {openQuestion}
        </p>
      ) : null}
    </section>
  );
}
