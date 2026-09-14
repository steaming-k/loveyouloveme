'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { NoticeBox, SectionLabel } from '@/components/common/primitives';
import { Lovy } from '@/components/lovy/Lovy';
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

/**
 * 러비의 한 가지 질문 — 저장 가능 (260914 UT 후속 P2-5)
 *
 * 예전 `이야기해볼 주제`는 질문 목록을 리포트 카드처럼 줄줄이 보여줬고, UT에서 토론 주제 ·
 * 조별과제처럼 느껴진다는 반응이 나왔다. 질문 자체는 '관계를 다시 생각하게 한다'는 긍정 신호였다.
 *
 * 그래서 **기능은 그대로, 형식만 가볍게** 한다 — 러비가 건네는 작은 코너에 질문 하나를 먼저
 * 보여주고, 나머지는 사용자가 원할 때 펼친다. 질문 문장 · 저장 이벤트 · 개수는 바꾸지 않는다.
 */
export function ConversationPromptList({
  lens,
  prompts,
}: {
  lens: EntertainmentLensType;
  prompts: readonly ConversationPrompt[];
}) {
  const [showAll, setShowAll] = useState(false);
  if (prompts.length === 0) return null;

  const visible = showAll ? prompts : prompts.slice(0, 1);
  const restCount = prompts.length - 1;

  return (
    <section
      aria-label="러비의 한 가지 질문"
      className="flex flex-col gap-2 rounded-card bg-mint-tint px-3.5 py-3"
    >
      <p className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.04em] text-mint-ink">
        <Lovy pose="question" size={28} decorative />
        러비의 한 가지 질문
      </p>
      <ul className="flex flex-col gap-2">
        {visible.map((prompt) => (
          <li key={prompt.id} className="flex flex-col">
            <p className="text-caption keep-all leading-relaxed text-ink">{prompt.text}</p>
            <button
              type="button"
              onClick={() =>
                trackEvent('lens_conversation_question_save', {
                  lens,
                  question_id: prompt.id,
                })
              }
              className="flex min-h-11 items-center self-start text-meta font-semibold text-mint-ink"
            >
              이 질문 기억해두기
            </button>
          </li>
        ))}
      </ul>
      {restCount > 0 ? (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((prev) => !prev)}
          className="flex min-h-11 items-center self-start text-[11.5px] text-ink-muted"
        >
          {showAll ? '하나만 보기' : `다른 질문 ${restCount}개 더 보기`}
        </button>
      ) : null}
    </section>
  );
}

/** 결과 성격을 매번 고지한다 — Entertainment임을 잊게 만들지 않는다 */
export function EntertainmentNotice({ children }: { children: React.ReactNode }) {
  return <NoticeBox>{children}</NoticeBox>;
}
