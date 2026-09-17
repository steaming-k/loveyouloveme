import { COMPATIBILITY_COPY } from '@/data/copy';

/**
 * Compatibility Hero 의 동기화율 (S21)
 *
 * 숫자는 요약일 뿐이라는 것이 화면에서도 읽혀야 하므로,
 * 점수 옆에 '관계의 결과를 예측하는 점수는 아니야' 고지를 **항상** 붙인다.
 * (260915 UT P0-3 — 예전 문구 '연애 성공확률이 아니야'는 연인·배우자에게 성립하지 않았다.
 *  문구 결정 근거는 `COMPATIBILITY_COPY.notice` 주석에 있다.)
 *
 * ══ v1.48 Field Notes — 가운데 stack에서 **편집 figure**로 ═══════════════════
 *
 * 예전 배치는 가운데 정렬된 세로 stack이었다:
 *
 * ```
 *          SYNC RATE · 동기화율
 *                 55
 *      [관계의 결과를 예측하는 점수는 아니야]   ← 회색 pill
 * ```
 *
 * 문제는 둘이다. ① 가운데 큰 숫자 하나는 **점수 앱의 기본형**이고, 이 제품은
 * "궁합점수 78이 서비스에서 가장 강한 화면이 되어서는 안 된다"(§5)를 원칙으로 둔다.
 * ② 고지를 pill로 감싸면 그건 '읽어야 할 단서'가 아니라 '태그'로 읽힌다 — 화면에
 * pill이 하나 더 늘어날 뿐이다.
 *
 * 지금 배치:
 *
 * ```
 * SYNC RATE · 동기화율
 * 55 │ 관계의 결과를 예측하는
 *    │ 점수는 아니야
 * ```
 *
 * 좌측 정렬 · 수치와 단서가 **세로 rule 하나로 나란히**. 숫자는 여전히 화면에서
 * 가장 큰 활자지만 화면을 독점하지 않고, 바로 옆에서 그 숫자의 한계를 같은 높이로
 * 말한다. 그리고 그 아래 `SignalStructure`가 '무엇으로 만든 숫자인지'를 이어받는다.
 *
 * ⚠️ **계산도 문구도 그대로다.** 이 컴포넌트는 `score` 하나만 받아 그린다.
 * ⚠️ pill 하나(`rounded-tag bg-sunken`)가 사라졌다 — 문장은 그대로 남아 있다.
 *
 * 리빌 연출은 CSS 애니메이션으로 처리한다. 숫자를 state로 카운트업하거나
 * JS로 transform을 붙이면 SSR 결과와 첫 클라이언트 렌더가 달라져 hydration이 깨진다.
 */
export function SyncScore({ score }: { score: number }) {
  return (
    <div className="flex flex-col gap-2.5 px-1 pt-1">
      <p className="text-[10px] font-semibold tracking-[0.2em] text-ink-muted">
        {COMPATIBILITY_COPY.scoreLabel}
      </p>

      <div className="flex items-stretch gap-4">
        <p className="reveal-score text-figure flex-none text-brand tnum">{score}</p>

        {/* 수치와 단서를 나누는 세로 rule — 카드를 만들지 않고 둘을 나란히 세운다 */}
        <span className="w-px flex-none self-stretch bg-rule-hair" aria-hidden />

        <p className="min-w-0 flex-1 self-end pb-1.5 text-[12.5px] keep-all leading-relaxed text-ink-sub">
          {COMPATIBILITY_COPY.notice}
        </p>
      </div>
    </div>
  );
}
