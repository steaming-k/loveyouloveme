import { COMPATIBILITY_COPY } from '@/data/copy';

/**
 * Compatibility Hero 의 동기화율 (S21)
 *
 * 숫자는 요약일 뿐이라는 것이 화면에서도 읽혀야 하므로,
 * 점수 아래에 '연애 성공확률이 아니야' 고지를 **항상** 붙인다.
 *
 * v1.23 §3 — LEVEL 1을 첫 viewport 안에 넣기 위해 두 가지를 줄였다.
 *   ① 점수 96px → **76px.** 96px는 `giant headline`(§20 금지)에 가깝고, 이 화면에서
 *      가장 큰 요소라는 역할은 76px로도 충분하다.
 *   ② `COMPATIBILITY_COPY.supporting`("현재 입력된 두 사람의 정보를 기준으로 / 공통점과
 *      차이를 비교한 결과야.") **2줄을 제거했다.** 이 문장은 결과가 아니라 계산 방식을
 *      말하는데, 바로 아래에 같은 사실을 더 구체적으로 말하는 근거 블록
 *      ("비교 가능한 N개 관계 신호로 계산했어")이 있고, 그 사이에 실제 결과를 요약하는
 *      **핵심 한 문장**(§4)이 들어왔다. 면책 문장 3개가 결과 문장을 밀어내던 구조를 고친 것이다.
 *      ⚠️ 상수 자체는 지우지 않았다 — 공유 카드·다른 화면에서 다시 쓸 수 있다.
 *
 * 리빌 연출은 CSS 애니메이션으로 처리한다. 숫자를 state로 카운트업하거나
 * JS로 transform을 붙이면 SSR 결과와 첫 클라이언트 렌더가 달라져 hydration이 깨진다.
 */
export function SyncScore({ score }: { score: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 pt-2 pb-0.5">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">
        {COMPATIBILITY_COPY.scoreLabel}
      </p>

      <p className="reveal-score text-[76px] font-semibold leading-[1.06] tracking-[-4px] text-brand tnum">
        {score}
      </p>

      <p className="mt-1.5 rounded-tag bg-sunken px-2.5 py-1.5 text-meta text-ink-sub">
        {COMPATIBILITY_COPY.notice}
      </p>
    </div>
  );
}
