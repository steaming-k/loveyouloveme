import { APPROACH_HINT_KIND_LABEL, describeTargetEvidence } from '@/lib/logic/approachHints';
import type { ApproachHint, TargetProfile } from '@/types';

/**
 * 다가가는 힌트 카드 (v1.13 §27~§28)
 *
 * ⚠️ 이건 호감도 예측이나 공략법이 아니다 — CATEGORY/TITLE/WHY/근거 순서로, '왜 이런
 * 말을 하는지'를 사용자가 바로 알 수 있게 한다(§28). `kind:'conversation'`은 근거가
 * 부족해 조언 대신 질문을 제안하는 경우다.
 */
export function ApproachHintCard({
  hint,
  target,
  onExpand,
}: {
  hint: ApproachHint;
  target: TargetProfile;
  onExpand?: () => void;
}) {
  const evidenceTexts = hint.evidenceRefs
    .map((ref) => describeTargetEvidence(ref, target))
    .filter((text) => text.length > 0);

  return (
    <li className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
      <p className="text-[10.5px] font-semibold tracking-[0.04em] text-brand-pressed">
        {APPROACH_HINT_KIND_LABEL[hint.kind]}
      </p>
      <h3 className="text-body font-semibold tracking-[-0.2px] keep-all">{hint.title}</h3>
      <p className="text-[13.5px] keep-all leading-relaxed text-ink-sub">{hint.rationale}</p>

      {hint.caution ? (
        <p className="text-[11.5px] keep-all leading-relaxed text-ink-faint">{hint.caution}</p>
      ) : null}

      {evidenceTexts.length > 0 ? (
        <details className="border-t border-line-soft pt-2.5" onToggle={onExpand}>
          <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-brand-pressed">
            근거
          </summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {evidenceTexts.map((text) => (
              <li
                key={text}
                className="rounded-tag bg-chip px-2.5 py-1 text-[11.5px] text-ink-sub"
              >
                {text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
