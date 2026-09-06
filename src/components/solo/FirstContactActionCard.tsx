import type { FirstContactAction } from '@/types';

/**
 * 해볼 수 있는 것 (v1.29 · P4 §30 · §31)
 *
 * ⚠️ **연애 성공 공식이 아니다.** 사용자가 원했던 '어떻게 해야 연애가 가능한지'를
 * 그대로 처방으로 만들지 않는다. 대신 관계를 시작할 때 **시도해볼 수 있는 행동**만
 * 말하고, TRY / ASK / NOTICE 세 종류로 성격을 분명히 한다.
 *
 * ⚠️ **generic 연애 팁과 구조로 구분된다.** 각 항목은 세 칸을 반드시 갖는다:
 *
 *   SELF SIGNAL   내가 실제로 답한 것
 *   WHY           그 답이 관계 시작 시점에 무엇으로 보이는지
 *   ACTION        해볼 것
 *
 * 첫 칸이 없으면 이건 그냥 연애 팁이다. 그래서 근거가 없는 행동은 애초에 만들지 않고
 * (`FIRST_CONTACT_ACTIONS`가 축·단계로 걸러진다), 목록 길이는 사람마다 다르다 —
 * **분량을 맞추려고 채우지 않는다.**
 */

/** 행동의 성격. 처방이 아니라 무엇을 하는 것인지 알려주는 표식이다 */
const KIND_CAPTION: Record<FirstContactAction['kind'], string> = {
  TRY: '해볼 것',
  ASK: '물어볼 것',
  NOTICE: '살펴볼 것',
};

export function FirstContactActionCard({ action }: { action: FirstContactAction }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold tracking-[0.1em] text-mint-ink">
          {action.kind}
        </span>
        <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-faint">
          {KIND_CAPTION[action.kind]}
        </span>
      </div>

      {/* 이 행동이 어디서 나왔는지 — 이 줄이 없으면 일반 연애 팁이 된다 */}
      <div className="flex flex-col gap-1 rounded-[10px] bg-sunken px-3.5 py-2.5">
        <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-faint">내가 답한 것</p>
        <p className="text-[12px] keep-all leading-relaxed text-ink">{action.signal}</p>
      </div>

      <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{action.why}</p>

      <p className="border-l-2 border-mint pl-3 text-[13.5px] font-medium keep-all leading-relaxed">
        {action.action}
      </p>
    </div>
  );
}
