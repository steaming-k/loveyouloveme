'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { NoticeBox, SectionLabel } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LENS_MISSING_COPY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { formatBirthSummary } from '@/lib/logic/birth';
import { ROUTES } from '@/lib/routes';
import type { BirthProfile, ConversationPrompt, EntertainmentLensType, LensAvailability } from '@/types';

/**
 * Entertainment Lens 공통 블록
 *
 * 두 렌즈(사주·Astrology)가 같은 방식으로 '정보 부족'과 '한계'를 말하도록 한 곳에 모았다.
 * 원칙: 없는 정보를 채워 넣지 않고, 못 하는 것을 숨기지 않는다.
 */

/** 출생정보가 부족할 때 (§26) — 무엇이 없는지에 따라 문구가 달라진다 */
export function BirthMissingBlock({
  lens,
  missing,
}: {
  lens: EntertainmentLensType;
  missing: Exclude<LensAvailability['missing'], 'none'>;
}) {
  const router = useRouter();

  return (
    <section className="flex flex-col gap-3">
      <LovyMessage pose="question" size={52}>
        {LENS_MISSING_COPY[missing]}
      </LovyMessage>
      <Button
        onClick={() => {
          trackEvent('entertainment_lens_birth_missing', { lens, missing });
          router.push(`${ROUTES.lensBirth}?from=${lens}`);
        }}
      >
        {LENS_MISSING_COPY.cta}
      </Button>
    </section>
  );
}

/** 나 / 상대 출생정보 요약. 상대는 '네가 입력한 정보'라는 사실을 함께 표시한다(§34) */
export function BirthSummaryRows({
  mine,
  theirs,
}: {
  mine: BirthProfile;
  theirs: BirthProfile;
}) {
  const router = useRouter();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel className="px-0">출생정보</SectionLabel>
        <button
          type="button"
          onClick={() => router.push(ROUTES.lensBirth)}
          className="flex min-h-11 items-center text-meta text-brand-pressed"
        >
          수정
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        <li className="flex items-center justify-between gap-3 rounded-row border border-line bg-surface px-3.5 py-3">
          <span className="flex-none text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">
            나
          </span>
          <span className="text-caption tnum text-ink">{formatBirthSummary(mine)}</span>
        </li>
        <li className="flex items-center justify-between gap-3 rounded-row border border-line bg-surface px-3.5 py-3">
          <span className="flex-none text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">
            상대
          </span>
          <span className="text-caption tnum text-ink">{formatBirthSummary(theirs)}</span>
        </li>
      </ul>
      <p className="px-1 text-[11px] keep-all text-ink-faint">
        상대 정보는 네가 알고 있는 내용을 입력한 값이야.
      </p>
    </section>
  );
}

/** 이 결과가 못 하는 것 — 항상 보여준다. 숨기면 정확한 결과처럼 읽힌다 */
export function LimitationList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>이 렌즈의 한계</SectionLabel>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[12px] keep-all leading-relaxed text-ink-sub">
            <span className="flex-none text-ink-faint" aria-hidden>
              ·
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 이야기해볼 주제 — 저장 가능 */
export function ConversationPromptList({
  lens,
  prompts,
}: {
  lens: EntertainmentLensType;
  prompts: readonly ConversationPrompt[];
}) {
  if (prompts.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>이야기해볼 주제</SectionLabel>
      <ul className="flex flex-col gap-2">
        {prompts.map((prompt) => (
          <li
            key={prompt.id}
            className="rounded-row border border-line bg-surface px-3.5 py-3 text-caption keep-all leading-relaxed"
          >
            {prompt.text}
            <button
              type="button"
              onClick={() =>
                trackEvent('lens_conversation_question_save', {
                  lens,
                  question_id: prompt.id,
                })
              }
              className="mt-2 flex min-h-11 items-center text-meta font-semibold text-brand-pressed"
            >
              이 질문 기억해두기
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 결과 성격을 매번 고지한다 — Entertainment임을 잊게 만들지 않는다 */
export function EntertainmentNotice({ children }: { children: React.ReactNode }) {
  return <NoticeBox>{children}</NoticeBox>;
}
