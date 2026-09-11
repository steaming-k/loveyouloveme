'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Lovy } from '@/components/lovy/Lovy';
import { SectionLabel } from '@/components/common/primitives';
import type { LovyPose } from '@/data/lovy';
import {
  CROSS_LENS_COPY,
  LENS_FIX_CTA,
  LENS_TARGET_HINT,
  LENS_ANCHOR,
  LENS_SECTION_COPY,
} from '@/data/premiumLens';
import { LENS_AI_COPY } from '@/data/premiumLensAi';
import { EMPTY_PREMIUM_LENS_AI, lensAiStateOf, type PremiumLensAi } from '@/hooks/usePremiumLensAi';
import { trackEvent } from '@/lib/analytics';
import { readOpenState, writeOpenState } from '@/lib/openState';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/cn';
import type {
  AiNarrativeState,
  CrossLensNarrativeBundle,
  PremiumCrossLens,
  PremiumLensBundle,
  PremiumLensNarrativeBundle,
  PremiumLensEntry,
  PremiumLensKind,
  PremiumLensReport,
} from '@/types';

/**
 * Premium 관계 렌즈 — 화면 (v1.46 PremiumLens · §36 · §37)
 *
 * ══ 왜 Accordion인가 (§37) ════════════════════════════════════════════════
 *
 * 렌즈 하나가 섹션 4~5개 + 근거 + 체크포인트라 셋을 펼쳐두면 393px에서 리포트
 * 뒤에 화면 세 개 분량이 더 붙는다. 그런데 **segmented tab은 쓰지 않았다** —
 * 탭은 한 번에 하나만 보이게 만들어서 '내가 산 게 셋'이라는 사실을 숨긴다.
 * Accordion은 셋을 다 보여주고 본문만 접는다(v1.45 Chapter Accordion과 같은 판단).
 *
 * ⚠️ **전부 접힌 채로 시작한다.** Chapter Accordion은 첫 항목을 열지만 여기는
 * 다르다 — 이 섹션은 정밀 관찰 리포트를 **다 읽은 뒤에 오는 부록**이고, 열려
 * 있으면 Core를 읽던 스크롤이 렌즈 본문으로 이어져 위계가 뒤집힌다(§3 · §36).
 *
 * ⚠️ **높이 애니메이션을 쓰지 않는다.** 조건부 렌더만 한다 — 측정 루프도,
 * accordion resize loop도, scroll jump도 만들지 않는다(§55).
 *
 * ══ 이 컴포넌트가 하지 않는 것 ═══════════════════════════════════════════
 *
 * ⚠️ **문장을 만들지 않는다.** headline·overview·본문·체크포인트·한계·근거 전부
 * `logic/premiumLens.ts`가 만든 값이고 여기서는 배치만 한다. 화면이 문장을
 * 만들면 fixture가 볼 수 없는 자리가 생긴다(v1.41 §39.9가 그 자리에서 시제를 놓쳤다).
 *
 * ⚠️ **가격을 그리지 않는다**(§35). 이 섹션은 이미 열린 뒤에만 보이고, 가격은
 * Home과 Paywall에서 Bundle 기준으로 한 번씩만 나온다.
 */

/**
 * 렌즈별 러비 포즈.
 *
 * ⚠️ **점·운세 계열(`crystal`·`wand`)을 쓰지 않는다** — `docs/design-guide.md §2`의
 * "러비는 관찰자다. 상담가·점쟁이·전문가로 보이게 쓰지 않는다"가 사주·별자리
 * 카드에서 가장 지키기 어렵고 가장 중요하다. 사주에 수정구를 주는 순간 이 렌즈는
 * 해석 프레임이 아니라 점집이 된다.
 *
 * ⚠️ 크기는 32px 고정이다(§38 — 캐릭터가 분석 신뢰를 덮지 않게). Chapter의 44px보다
 * 작다 — 렌즈는 리포트보다 낮은 위계다.
 */
const LENS_POSE: Record<PremiumLensKind, LovyPose> = {
  /** 두 사람의 선호를 나란히 놓고 보는 자리 */
  mbti: 'chart',
  /** 전통 해석 기록을 펼쳐 보는 자리. 점술 도구가 아니라 책이다 */
  saju: 'book',
  /** 관측 장비를 다루는 자리 — 망원경 자리에 가장 가까운 기존 포즈다 */
  zodiac: 'laptop',
};

const LENS_AVATAR = 32;

const MODE_BADGE: Record<'pair' | 'self', string> = {
  pair: '둘이 함께',
  self: '나만',
};

export function PremiumLensSection({
  bundle,
  /**
   * v1.46 AI Lens §30 — 렌즈별 AI 해석 상태.
   *
   * ⚠️ **optional이다.** 넘기지 않는 화면(개발용 `/premium-preview`)은 v1.46
   * PremiumLens와 **완전히 같은 화면**을 그린다 — AI 블록만 없다. 기본값을
   * `EMPTY_PREMIUM_LENS_AI`로 두는 이유는 그 화면에서 `idle`이 되어 아무것도
   * 그리지 않게 하기 위해서다(§32의 실패 문구도 뜨지 않는다).
   */
  ai = EMPTY_PREMIUM_LENS_AI,
  /**
   * v1.46.2 §Navigation — 펼침 상태를 보관할 키(보통 `premium:<분석 id>`).
   *
   * **optional이다.** 넘기지 않으면 예전처럼 화면을 떠날 때 접힌다 — 개발용
   * `/premium-preview`는 왕복할 결과 화면이 없으므로 보관할 이유도 없다.
   */
  stateKey,
}: {
  bundle: PremiumLensBundle;
  ai?: PremiumLensAi;
  stateKey?: string;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  /**
   * ⚠️ 초기값이 아니라 effect에서 읽는다. `useState` 초기값으로 sessionStorage를
   * 읽으면 서버가 그린 것(접힘)과 첫 클라이언트 렌더가 달라진다.
   */
  useEffect(() => {
    if (!stateKey) return;
    const saved = readOpenState(stateKey);
    if (saved.length > 0) setOpen(new Set(saved));
  }, [stateKey]);

  const toggle = (key: string, onOpen: () => void) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        onOpen();
      }
      // 열고 닫는 순간에만 쓴다 — 복원(effect)은 이 경로를 지나지 않으므로
      // `premium_lens_open`이 다시 발생하지 않는다.
      if (stateKey) writeOpenState(stateKey, [...next]);
      return next;
    });
  };

  return (
    <section className="flex flex-col gap-2.5">
      <SectionLabel>{LENS_SECTION_COPY.title}</SectionLabel>
      <p className="text-[11.5px] keep-all leading-relaxed text-ink-sub">
        {LENS_SECTION_COPY.intro}
      </p>

      <ul className="flex flex-col gap-2">
        {bundle.lenses.map((lens) => (
          <li key={lens.kind} id={LENS_ANCHOR[lens.kind]} className="scroll-mt-4">
            {lens.mode === 'unavailable' ? (
              <UnavailableCard lens={lens} />
            ) : (
              <LensCard
                lens={lens}
                ai={lensAiStateOf(ai, lens.kind)}
                expanded={open.has(lens.kind)}
                onToggle={() =>
                  toggle(lens.kind, () =>
                    trackEvent('premium_lens_open', {
                      lens_kind: lens.kind,
                      lens_mode: lens.mode,
                    }),
                  )
                }
              />
            )}
          </li>
        ))}
      </ul>

      {/**
       * §5 — 상대는 있는데 그 렌즈의 값만 모르는 경우에만, **묶음 아래 한 번만.**
       *
       * ⚠️ 카드마다 붙이지 않는다. 세 렌즈가 전부 그 상태면 같은 재촉을 세 번 하는
       * 것이 되고, 그러면 결과보다 '정보를 더 내놓으라'는 말이 크게 읽힌다.
       * ⚠️ 상대가 아예 없는 사용자에게는 그리지 않는다 — 갈 수 없는 길이다.
       */}
      {bundle.lenses.some(
        (lens) => lens.mode === 'self' && lens.selfReason === 'target_data_missing',
      ) ? (
        <p className="text-[11px] keep-all leading-relaxed text-ink-faint">
          {LENS_TARGET_HINT}
        </p>
      ) : null}

      {bundle.crossLens ? (
        <CrossLensCard
          cross={bundle.crossLens}
          ai={ai.cross}
          expanded={open.has('cross')}
          onToggle={() =>
            toggle('cross', () =>
              trackEvent('premium_lens_open', { lens_kind: 'cross', lens_mode: 'pair' }),
            )
          }
        />
      ) : null}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── 개별 렌즈 */

function LensCard({
  lens,
  ai,
  expanded,
  onToggle,
}: {
  lens: PremiumLensReport;
  ai: AiNarrativeState<PremiumLensNarrativeBundle>;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-sunken"
      >
        <span className="flex-none pt-0.5">
          <Lovy pose={LENS_POSE[lens.kind]} size={LENS_AVATAR} decorative />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12.5px] font-semibold">{lens.label}</span>
            <span className="rounded-[5px] bg-sunken px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
              {MODE_BADGE[lens.mode]}
            </span>
          </span>
          {/* headline은 접힌 상태에서도 보인다 — 무엇이 들어 있는지 숨기지 않는다 */}
          <span className="text-[12px] keep-all leading-relaxed text-ink-sub">
            {lens.headline}
          </span>
        </span>
        <span
          className={cn('flex-none pt-1 text-ink-faint t-enter', expanded && 'rotate-180')}
          aria-hidden
        >
          ⌄
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-3.5 border-t border-line-soft px-4 pb-4 pt-3.5">
          <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{lens.overview}</p>

          <ul className="flex flex-col gap-3">
            {lens.sections.map((unit) => (
              <li key={unit.id} className="flex flex-col gap-1.5">
                <p className="text-[12px] font-semibold">{unit.title}</p>
                {unit.body.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-[12.5px] keep-all leading-relaxed text-ink-sub">
                    {paragraph}
                  </p>
                ))}
                {/*
                  §46 — 사용자가 알려준 장면. **출처가 문장 안에 남는다**
                  (`네가 알려준 장면 · …`). 문구는 엔진(`lensEventLine`)이 만들고
                  화면은 배치만 한다 — 여기서 조립하면 출처를 빼먹을 수 있다.
                */}
                {unit.reportedEventLine ? (
                  <p className="rounded-row border border-dashed border-dash bg-canvas-warm px-3 py-2.5 text-[11.5px] keep-all leading-relaxed text-ink-sub">
                    {unit.reportedEventLine}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {/*
            v1.46 AI Lens §30 — **결정론 내용 아래에** AI 해석이 온다.

            ⚠️ 자리가 곧 위계다. 계산 결과가 위, 해석이 아래, 그 아래가 근거와 한계다.
            AI 블록을 맨 위로 올리면 사용자는 해석을 먼저 읽고 계산을 나중에 본다 —
            §7이 세운 `계산 → 해석 → 최종 판단 사용자` 순서가 화면에서 뒤집힌다.
          */}
          <LensAiBlock state={ai} />

          {/* §30 — '왜 이렇게 봤어?'. raw debug JSON이 아니라 사람이 읽는 라벨과 값이다 */}
          <BasisBlock rows={lens.basis} />

          {/* §5 06 — 러비의 체크포인트 */}
          <div className="flex flex-col gap-1 rounded-card bg-mint-tint px-3.5 py-3">
            <p className="text-[10px] font-semibold tracking-[0.05em] text-mint-ink">
              {LENS_SECTION_COPY.checkpointLabel}
            </p>
            <p className="text-[11.5px] keep-all leading-relaxed text-mint-ink">
              {lens.checkpoint}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold tracking-[0.05em] text-ink-muted">
              {LENS_SECTION_COPY.limitationLabel}
            </p>
            {lens.limitations.map((line) => (
              <p key={line} className="text-[11px] keep-all leading-relaxed text-ink-faint">
                {line}
              </p>
            ))}
          </div>

          {/* §31 — 짧게 한 줄. 경고문 블록으로 키우지 않는다 */}
          <p className="text-[11px] keep-all leading-relaxed text-ink-faint">{lens.disclaimer}</p>
        </div>
      ) : null}
    </div>
  );
}

function BasisBlock({ rows }: { rows: PremiumLensReport['basis'] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-row border border-line-soft bg-sunken">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
      >
        <span className="text-[11px] font-semibold text-ink-sub">
          {LENS_SECTION_COPY.basisLabel}
        </span>
        <span className={cn('text-ink-faint t-enter', open && 'rotate-180')} aria-hidden>
          ⌄
        </span>
      </button>
      {open ? (
        <dl className="flex flex-col gap-1.5 border-t border-line-soft px-3.5 py-3">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="text-[10.5px] font-semibold text-ink-muted">{row.label}</dt>
              <dd className="text-[11.5px] keep-all text-ink-sub">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * 만들 수 없는 렌즈. **자리를 지운 채 숨기지 않는다** — 번들에 셋이 들어 있다고
 * 말했으면 셋이 다 보여야 하고, 못 만든 하나는 이유를 말해야 한다(§29 · §52).
 */
/**
 * 볼 수 없는 렌즈 — **이유 다음에 길을 둔다** (v1.46.3)
 *
 * 예전에는 이유만 적힌 정적 카드였다. `네 생년월일(양력)이 있어야 일주를 계산할 수
 * 있어`를 읽은 사용자가 **그 생년월일을 어디서 넣는지**는 화면 어디에도 없었다 —
 * 입력 화면(`/lens/birth`)은 렌즈 목록 안쪽에 있어서 리포트에서는 보이지 않는다.
 *
 * ⚠️ 목적지는 `lens.fix`(결정론 값)로 정한다. 이유 **문구를 읽어** 판단하지 않는다 —
 * 문구를 고치는 순간 이동이 조용히 깨진다.
 *
 * ⚠️ 카드 전체를 버튼으로 만들지 않는다. 이유 문장은 읽는 것이고 버튼은 누르는
 * 것이라, 한 덩어리로 묶으면 스크린리더에서 이유까지 버튼 이름이 된다.
 */
function UnavailableCard({ lens }: { lens: Extract<PremiumLensEntry, { mode: 'unavailable' }> }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1 rounded-card border border-dashed border-line-strong bg-sunken px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[12.5px] font-semibold text-ink-sub">{lens.label}</span>
        <span className="rounded-[5px] bg-canvas-warm px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
          {LENS_SECTION_COPY.unavailableLabel}
        </span>
      </div>
      <p className="text-[11.5px] keep-all leading-relaxed text-ink-sub">{lens.reason}</p>

      <button
        type="button"
        onClick={() =>
          router.push(lens.fix === 'birth' ? ROUTES.lensBirth : ROUTES.declared(4))
        }
        className="mt-1.5 flex min-h-11 w-full items-center justify-between rounded-row border border-line bg-surface px-3.5 text-left active:bg-sunken"
      >
        <span className="text-[12.5px] font-medium">{LENS_FIX_CTA[lens.fix]}</span>
        <span className="flex-none text-meta font-semibold text-brand" aria-hidden>
          →
        </span>
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── Cross-Lens */

function CrossLensCard({
  cross,
  ai,
  expanded,
  onToggle,
}: {
  cross: PremiumCrossLens;
  ai: AiNarrativeState<CrossLensNarrativeBundle> | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-brand bg-brand-tint">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex-none pt-0.5">
          <Lovy pose="connect" size={LENS_AVATAR} decorative />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-brand-pressed">
            {cross.lensCount >= 3 ? CROSS_LENS_COPY.title : CROSS_LENS_COPY.titleTwo}
          </span>
          <span className="text-[12px] keep-all leading-relaxed text-ink-sub">
            {CROSS_LENS_COPY.lovyIntro}
          </span>
        </span>
        <span
          className={cn('flex-none pt-1 text-ink-faint t-enter', expanded && 'rotate-180')}
          aria-hidden
        >
          ⌄
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-3.5 border-t border-brand/30 px-4 pb-4 pt-3.5">
          {cross.repeatedThemes.length > 0 ? (
            <CrossBlock label={CROSS_LENS_COPY.repeatedLabel} items={cross.repeatedThemes} />
          ) : null}
          {cross.differences.length > 0 ? (
            <CrossBlock label={CROSS_LENS_COPY.differenceLabel} items={cross.differences} />
          ) : null}
          {/*
            §19 C — Cross-Lens의 최종 가치. 그래서 **가장 아래, 가장 강하게** 둔다.
            위 두 블록은 관찰이고 이건 사용자가 들고 나갈 것이다.
          */}
          <div className="flex flex-col gap-1.5 rounded-card bg-surface px-3.5 py-3">
            <p className="text-[10px] font-semibold tracking-[0.05em] text-brand-pressed">
              {CROSS_LENS_COPY.questionLabel}
            </p>
            <ol className="flex flex-col gap-2">
              {cross.verificationQuestions.map((question, index) => (
                <li key={question} className="flex gap-2">
                  <span className="flex-none text-[11px] font-semibold tnum text-ink-muted">
                    {index + 1}
                  </span>
                  <span className="text-[12px] keep-all leading-relaxed">{question}</span>
                </li>
              ))}
            </ol>
          </div>

          {/*
            v1.46 AI Lens §22 — 결정론 Cross-Lens **아래에** AI 종합.

            ⚠️ `note`보다 위다. `note`('근거 3개가 아니다')는 이 카드 전체에 걸리는
            경계 문장이므로 마지막에 있어야 한다 — AI 문단 위로 올라가면 AI가 그
            경계 밖에 있는 것처럼 읽힌다(§20 · §23).
          */}
          {ai ? <CrossLensAiBlock state={ai} /> : null}

          {/*
            §20 — **항상 보인다.** '3개의 근거가 일치했어'로 읽히지 않게 하는 한 줄이고,
            그래서 데이터에 필수 필드로 들어 있다(`PremiumCrossLens.note`).
          */}
          <p className="text-[11px] keep-all leading-relaxed text-ink-faint">{cross.note}</p>
        </div>
      ) : null}
    </div>
  );
}

function CrossBlock({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold tracking-[0.05em] text-ink-muted">{label}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="text-[12px] keep-all leading-relaxed text-ink-sub">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────────────────────────────── AI 해석 블록 (§30 · §32) */

/**
 * 결정론 결과 **아래에** 붙는 AI 문단.
 *
 * ⚠️ **결정론 내용을 감싸거나 대체하지 않는다.** 위에 있는 것이 계산 결과이고
 * 이 블록은 그 해석이다 — 순서가 위계다(§7 · §31).
 *
 * ⚠️ 실패는 **이 블록 안에서만** 말한다(§32). 카드도, 리포트도, Premium 화면도
 * 에러 상태로 바뀌지 않는다 — 기본 분석은 이미 위에 다 있다.
 *
 * ⚠️ `idle`에서는 아무것도 그리지 않는다. Paywall처럼 아직 요청하지 않은 화면에서
 * 빈 라벨이 보이면 '무언가 실패했다'로 읽힌다.
 */
function LensAiBlock({
  state,
  fallbackLabel = LENS_AI_COPY.blockLabel,
}: {
  state: AiNarrativeState<PremiumLensNarrativeBundle>;
  fallbackLabel?: string;
}) {
  if (state.status === 'idle') return null;

  const narrative = state.data?.narrative ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-card border border-line-soft bg-canvas-warm px-3.5 py-3">
      <div className="flex items-center gap-2">
        <Lovy pose="ponder" size={20} decorative />
        <p className="text-[10.5px] font-semibold tracking-[0.04em] text-ink-muted">
          {fallbackLabel}
        </p>
      </div>

      {state.status === 'loading' ? (
        <p className="text-[11.5px] keep-all leading-relaxed text-ink-faint">
          {LENS_AI_COPY.loading}
        </p>
      ) : null}

      {state.status === 'unavailable' || !narrative ? (
        state.status === 'loading' ? null : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[11.5px] keep-all leading-relaxed text-ink-faint">
              {LENS_AI_COPY.failed}
            </p>
            <button
              type="button"
              onClick={state.retry}
              className="text-[11px] font-semibold text-brand underline underline-offset-2"
            >
              {LENS_AI_COPY.retry}
            </button>
          </div>
        )
      ) : null}

      {narrative ? (
        <div className="flex flex-col gap-2.5">
          {narrative.summary ? (
            <p className="text-[12.5px] keep-all leading-relaxed">{narrative.summary}</p>
          ) : null}

          {narrative.units.map((unit) => (
            <div key={unit.id} className="flex flex-col gap-1">
              <p className="text-[11.5px] font-semibold text-ink-sub">{unit.title}</p>
              <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{unit.body}</p>
            </div>
          ))}

          {narrative.checkpoint ? (
            <p className="rounded-row bg-surface px-3 py-2 text-[11.5px] keep-all leading-relaxed text-ink-sub">
              {narrative.checkpoint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cross-Lens AI 종합 (§22 · §25).
 *
 * ⚠️ 결정론 Cross-Lens와 **같은 라벨을 쓰지 않는다.** 위 블록(`CrossBlock`)은 테마
 * 코드를 세어 만든 결과이고 이쪽은 AI 문장이다. 같은 제목을 두 번 쓰면 사용자는
 * 같은 내용이 반복된다고 읽는다(§31).
 */
function CrossLensAiBlock({ state }: { state: AiNarrativeState<CrossLensNarrativeBundle> }) {
  if (state.status === 'idle') return null;

  const narrative = state.data?.narrative ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface px-3.5 py-3">
      <div className="flex items-center gap-2">
        <Lovy pose="ponder" size={20} decorative />
        <p className="text-[10.5px] font-semibold tracking-[0.04em] text-brand-pressed">
          {LENS_AI_COPY.crossLabel}
        </p>
      </div>
      {/* 위 결정론 블록과의 관계를 한 줄로 말한다 — 같은 말을 두 번 하는 게 아니라는 것 */}
      <p className="text-[11px] keep-all leading-relaxed text-ink-faint">
        {LENS_AI_COPY.crossIntro}
      </p>

      {state.status === 'loading' ? (
        <p className="text-[11.5px] keep-all leading-relaxed text-ink-faint">
          {LENS_AI_COPY.loading}
        </p>
      ) : null}

      {state.status !== 'loading' && !narrative ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[11.5px] keep-all leading-relaxed text-ink-faint">
            {LENS_AI_COPY.failed}
          </p>
          <button
            type="button"
            onClick={state.retry}
            className="text-[11px] font-semibold text-brand underline underline-offset-2"
          >
            {LENS_AI_COPY.retry}
          </button>
        </div>
      ) : null}

      {narrative ? (
        <div className="flex flex-col gap-2.5">
          {narrative.repeatedThemes.length > 0 ? (
            <CrossBlock label={LENS_AI_COPY.crossRepeated} items={narrative.repeatedThemes} />
          ) : null}
          {narrative.differences.length > 0 ? (
            <CrossBlock label={LENS_AI_COPY.crossDifference} items={narrative.differences} />
          ) : null}
          {narrative.verificationQuestions.length > 0 ? (
            <CrossBlock
              label={LENS_AI_COPY.crossQuestion}
              items={narrative.verificationQuestions}
            />
          ) : null}
          {narrative.closing ? (
            <p className="text-[12px] keep-all leading-relaxed">{narrative.closing}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
