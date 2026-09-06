import { cn } from '@/lib/cn';
import { APPROACH_HINT_KIND_LABEL, describeTargetEvidence } from '@/lib/logic/approachHints';
import type { ApproachHint, TargetProfile } from '@/types';

/**
 * 다가가는 힌트 카드 (v1.13 §27~§28)
 *
 * ⚠️ 이건 호감도 예측이나 공략법이 아니다 — CATEGORY/TITLE/WHY/근거 순서로, '왜 이런
 * 말을 하는지'를 사용자가 바로 알 수 있게 한다(§28). `kind:'conversation'`은 근거가
 * 부족해 조언 대신 질문을 제안하는 경우다.
 *
 * v1.23 §9 · §19 — `density` 두 단계. 예전에는 동일 규격 카드가 최대 3개 연속으로 쌓여
 * (실측 767px) 무엇이 먼저 볼 것인지 사라졌다. 첫 힌트만 카드로 두고 나머지는 divider
 * 행으로 내린다. **문단을 구분하려고 카드를 만들지 않는다**(§19).
 * ⚠️ 힌트의 순서·개수·내용은 `buildApproachHints()`가 정한 그대로다 — 표현만 바꿨다.
 */
export function ApproachHintCard({
  hint,
  target,
  onExpand,
  density = 'primary',
}: {
  hint: ApproachHint;
  target: TargetProfile;
  onExpand?: () => void;
  density?: 'primary' | 'compact';
}) {
  const evidenceTexts = hint.evidenceRefs
    .map((ref) => describeTargetEvidence(ref, target))
    .filter((text) => text.length > 0);

  const compact = density === 'compact';

  return (
    <li
      className={cn(
        'flex flex-col',
        compact
          ? 'gap-2 border-t border-line-soft px-1 pt-3.5'
          : 'gap-2.5 rounded-card border border-line bg-surface p-4',
      )}
    >
      <p
        className={cn(
          'font-semibold tracking-[0.04em]',
          compact ? 'text-[10px] text-ink-muted' : 'text-[10.5px] text-brand-pressed',
        )}
      >
        {APPROACH_HINT_KIND_LABEL[hint.kind]}
      </p>
      {/* §32 — 이 카드는 `04 NOW WHAT`(h2) > '이 사람에게 다가갈 때'(h3) 아래에 온다 */}
      <h4
        className={cn(
          'font-semibold tracking-[-0.2px] keep-all',
          compact ? 'text-caption' : 'text-body',
        )}
      >
        {hint.title}
      </h4>
      <p
        className={cn(
          'keep-all leading-relaxed text-ink-sub',
          compact ? 'text-caption' : 'text-[13.5px]',
        )}
      >
        {hint.rationale}
      </p>

      {hint.caution ? (
        <p className="text-[11.5px] keep-all leading-relaxed text-ink-faint">{hint.caution}</p>
      ) : null}

      {evidenceTexts.length > 0 ? (
        <details
          className={cn(compact ? 'pt-0.5' : 'border-t border-line-soft pt-2.5')}
          onToggle={onExpand}
        >
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
