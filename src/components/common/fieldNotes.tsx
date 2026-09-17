import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * ══ LOVY FIELD NOTES — Visual Vocabulary (v1.48) ═════════════════════════════
 *
 * Editorial Field Notes × Alien Observation Lab.
 *
 * 이 파일은 **표현만** 만든다. 어떤 컴포넌트도 계산하지 않고, 판정하지 않고,
 * 문구를 짓지 않는다. 전부 호출부가 이미 가진 값을 받아서 그리기만 한다.
 *
 * ══ 왜 필요한가 ═════════════════════════════════════════════════════════════
 *
 * 결과 화면이 `rounded card + gap + rounded card`의 반복이었다. 정보는 정확했지만
 * **형태가 정보를 구분하지 못했다** — 관찰도 카드, 근거도 카드, 핵심 발견도 카드라서
 * 무엇이 중요한지 색 tag 하나로만 갈렸다.
 *
 * Field Notes의 규칙은 하나다: **관찰의 흔적을 그린다.**
 *   관찰(Observation) → 근거(Evidence) → 연결(Connection) → 발견(Insight)
 * 이 네 단계가 각각 **다른 형태**를 갖는다. 장식이 아니라 위계다.
 *
 * ⚠️ 새 색·새 폰트를 만들지 않는다. globals.css의 Field Notes 토큰만 쓴다.
 * ⚠️ 우주·별·HUD·glassmorphism·gradient를 쓰지 않는다.
 */

/* ----------------------------------------------------------------- 편집선 */

/**
 * 섹션을 나누는 편집 규칙선.
 *
 * `hair`  기본 구분선 — 카드 사이 간격을 대신한다
 * `mid`   조금 더 또렷한 구분 — 성격이 다른 블록 사이
 * `open`  섹션의 시작 선언 — 굵은 ink rule. 카드 없이 '여기서부터 새 이야기'를 만든다
 */
export function FieldRule({
  tone = 'hair',
  className,
}: {
  tone?: 'hair' | 'mid' | 'open';
  className?: string;
}) {
  const toneClass = { hair: 'field-rule', mid: 'field-rule-mid', open: 'field-rule-open' }[tone];
  return <div className={cn(toneClass, className)} aria-hidden />;
}

/**
 * 화면 표식 (v1.48) — `ScreenHeader`의 `action` 자리에 놓는 화면 이름.
 *
 * ══ 왜 Tag가 아닌가 ════════════════════════════════════════════════════════
 *
 * 예전에는 `<Tag tone="neutral">SUPPORTING LENS</Tag>` 처럼 알약이었다. Tag는
 * '이것의 분류는 이렇다'를 뜻하는 형태인데, 이 라벨들은 분류가 아니라 **지금 보고
 * 있는 화면의 이름**이다. 그리고 화면마다 상단에 알약이 하나씩 떠 있으면, 정작
 * 본문의 진짜 tag(판정 · 상태)와 같은 무게로 보인다.
 *
 * 형태는 Splash의 `LOVE RESEARCH : EARTH`와 같다 — 짧은 rule + 넓은 자간.
 * 그래서 첫 화면부터 렌즈 화면까지 **같은 문법의 표식 하나**가 이어진다.
 */
export function ScreenMarker({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-px w-4 flex-none bg-rule-ink" aria-hidden />
      <span className="text-[10px] font-semibold tracking-[0.18em] text-ink-muted">{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------- 관찰 마크 */

/**
 * 러비의 관찰 마크 — 안테나 끝이 남긴 자국.
 *
 * ⚠️ 러비 캐릭터 이미지가 아니다. 캐릭터는 중요한 순간에만 등장하고(§2), 이 마크는
 * 러비가 '여기를 봤다'는 흔적으로 UI 안에 조용히 남는다. 그게 §13이 말한
 * '러비를 더 많이 그리지 말고, 러비의 역할을 UI 흔적으로 확장한다'이다.
 *
 * 순수 장식이므로 항상 `aria-hidden`이다 — 옆에 있는 텍스트가 내용을 말한다.
 */
export function LovyMark({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={cn('flex-none', className)}
    >
      {/* 안테나 두 갈래 — 관찰하는 자세 */}
      <path
        d="M4.4 6.2 L2.9 3.2 M9.6 6.2 L11.1 3.2"
        stroke="var(--color-marker-observe)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="2.9" cy="2.6" r="1.35" fill="var(--color-marker-observe)" />
      <circle cx="11.1" cy="2.6" r="1.35" fill="var(--color-marker-observe)" />
      {/* 관찰의 시선 — 아래로 향한 얕은 호 */}
      <path
        d="M3.2 8.1 Q7 12.4 10.8 8.1"
        stroke="var(--color-marker-observe)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 몇 번째 관찰인지. tabular라 세로로 쌓아도 숫자 폭이 흔들리지 않는다 */
export function ObservationIndex({ n, className }: { n: number | string; className?: string }) {
  return (
    <span className={cn('obs-index', className)} aria-hidden>
      {typeof n === 'number' ? String(n).padStart(2, '0') : n}
    </span>
  );
}

/* --------------------------------------------------- ② Observation Surface */

/**
 * 러비가 적어둔 관찰 — **카드가 아니라 메모**다.
 *
 * 보고서 본문(Neutral · 정돈된 문장) 옆에 러비의 화법(Mint · 혼잣말)이 얹힌다.
 * `LovyNote`(좌측 rule 각주)와 역할이 다르다: 저건 섹션 끝의 주석이고,
 * 이건 흐름 한가운데에 놓이는 관찰 자체다.
 */
export function ObservationNote({
  children,
  label,
  index,
  className,
}: {
  children: ReactNode;
  /** 관찰의 이름. 없으면 라벨 줄 자체를 그리지 않는다 — 빈 eyebrow를 만들지 않기 위해서다 */
  label?: string;
  index?: number;
  className?: string;
}) {
  return (
    <div className={cn('surf-observation flex flex-col gap-2', className)}>
      {label ? (
        <p className="flex items-center gap-2">
          <LovyMark size={13} />
          <span className="text-[10px] font-semibold tracking-[0.14em] text-mint-ink">{label}</span>
          {index !== undefined ? <ObservationIndex n={index} className="ml-auto" /> : null}
        </p>
      ) : null}
      <div className="text-[13px] keep-all leading-relaxed text-[#3f4a46]">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------ ③ Evidence Surface */

/**
 * 사용자가 실제로 준 근거. **카드로 감싸지 않는다.**
 *
 * ⚠️ 배경을 깔지 않는 것이 핵심이다. 배경을 깔면 그 순간 카드가 되고, 카드가 되면
 * 근거와 해석이 같은 무게로 보인다. 이 제품에서 본문은 해석이고 근거는 출처다 —
 * 출처는 인용문처럼 보여야 한다.
 */
export function EvidenceNote({
  source,
  children,
  className,
}: {
  /** 이 근거가 어디서 왔는지. 없으면 출처 줄을 그리지 않는다 */
  source?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('surf-evidence flex flex-col gap-1.5', className)}>
      {source ? <span className="evidence-source">{source}</span> : null}
      <div className="text-[12.5px] keep-all leading-relaxed text-[#555]">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------- ④ Insight Surface */

/**
 * 가장 중요한 발견. **다른 카드와 같은 크기로 만들지 않는다.**
 *
 * 카드가 아니라 편집면이다: 굵은 상단 rule + 넓은 타이포 블록 + 배경 없음.
 * 화면에 하나뿐이어야 하는 면이라, 이걸 카드 안에 넣으면 '여러 카드 중 하나'가 된다.
 */
export function InsightFeature({
  eyebrow,
  children,
  footnote,
  className,
}: {
  /** 이 발견의 이름. 없으면 그리지 않는다 */
  eyebrow?: ReactNode;
  children: ReactNode;
  /** 발견 아래 한두 줄의 단서 */
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surf-insight flex flex-col gap-2.5', className)}>
      {eyebrow ? (
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-ink-muted">
          {eyebrow}
        </p>
      ) : null}
      <div className="text-feature keep-all text-brand-ink">{children}</div>
      {footnote ? (
        <div className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{footnote}</div>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------- 신호 구조 / Signal */

/**
 * 한 축의 **신호 구조** — `연락  ●────●` 한 줄.
 *
 * ══ ⚠️ 새 계산이 아니다 ══════════════════════════════════════════════════════
 *
 * 입력은 `CompatibilityDimension`이 이미 가지고 있던 `mineValue` / `theirsValue`
 * (1~5, 미응답·모름이면 null) 두 값뿐이다. 점 두 개를 1~5 트랙 위 제자리에 찍고,
 * 그 사이를 선으로 잇는다. 선의 길이가 곧 두 사람의 거리다.
 *
 * - **radar chart를 그리지 않는다.** 4축을 다각형으로 만들면 없는 정밀도가 생긴다.
 * - **가짜 그래프를 그리지 않는다.** 여기 나오는 모든 픽셀은 실제 입력값에서 온다.
 * - **성공확률처럼 보이지 않게 한다.** 축 하나를 '얼마나 잘 맞는지'로 채우는
 *   진행바를 쓰지 않는 이유다 — 이건 채워지는 막대가 아니라 **떨어져 있는 두 점**이다.
 * - 한쪽이라도 값이 없으면 선을 그리지 않고 '아직 비교 못 함'으로 남긴다. 모르는
 *   것을 가운데 점으로 찍으면 그건 측정이 아니라 추측이다.
 */
export function SignalTrack({
  label,
  mine,
  theirs,
  tone = 'neutral',
  unknownLabel = '비교 전',
  className,
}: {
  label: string;
  /** 1~5. null이면 비교하지 않는다 */
  mine: number | null;
  /** 1~5. null이면 비교하지 않는다 */
  theirs: number | null;
  tone?: 'good' | 'friction' | 'neutral';
  unknownLabel?: string;
  className?: string;
}) {
  const comparable = mine !== null && theirs !== null;

  // 1~5를 트랙 위 위치(%)로. 양 끝에 점 반지름만큼 여백을 남긴다.
  const pos = (v: number) => `${8 + ((v - 1) / 4) * 84}%`;

  const dotTone =
    tone === 'good' ? 'bg-brand' : tone === 'friction' ? 'bg-friction' : 'bg-ink-faint';
  const linkTone =
    tone === 'good' ? 'bg-brand-soft' : tone === 'friction' ? 'bg-friction' : 'bg-rule-mid';

  const from = comparable ? Math.min(mine, theirs) : 0;
  const to = comparable ? Math.max(mine, theirs) : 0;

  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <span className="w-[62px] flex-none text-[12px] tracking-[-0.2px] text-ink-sub">{label}</span>

      {comparable ? (
        <span className="relative h-[13px] min-w-0 flex-1" aria-hidden>
          {/* 트랙 — 1~5의 전체 범위. 아주 옅게 남겨 '어디까지 갈 수 있는 축인지'만 알린다 */}
          <span className="absolute inset-x-0 top-[6px] h-px bg-rule-hair" />
          {/* 두 점 사이 — 이 선의 길이가 거리다 */}
          <span
            className={cn('absolute top-[5.5px] h-[2px] rounded-full', linkTone)}
            style={{ left: pos(from), right: `calc(100% - ${pos(to)})` } as CSSProperties}
          />
          {/*
            ⚠️ 두 값이 **같을 때**는 점이 정확히 겹친다. 그대로 두면 동그라미 하나만 보여
            '한 사람만 답했다'로 읽힌다 — 같은 자리에 둘 다 있다는 것이 이 행의 결론이므로
            바깥 링을 씌워 겹침 자체를 보이게 한다. 새 판정이 아니라 같은 값의 다른 그림이다.
          */}
          {mine === theirs ? (
            <span
              className={cn(
                'absolute top-[0.5px] -ml-[6px] h-[12px] w-[12px] rounded-full border-[1.5px]',
                tone === 'good'
                  ? 'border-brand-soft'
                  : tone === 'friction'
                    ? 'border-friction'
                    : 'border-rule-mid',
              )}
              style={{ left: pos(mine) }}
            />
          ) : null}
          <span
            className={cn('absolute top-[3px] -ml-[3.5px] h-[7px] w-[7px] rounded-full', dotTone)}
            style={{ left: pos(mine) }}
          />
          {mine !== theirs ? (
            <span
              className={cn(
                'absolute top-[3px] -ml-[3.5px] h-[7px] w-[7px] rounded-full border-[1.5px] bg-canvas',
                tone === 'good'
                  ? 'border-brand'
                  : tone === 'friction'
                    ? 'border-friction'
                    : 'border-ink-faint',
              )}
              style={{ left: pos(theirs) }}
            />
          ) : null}
        </span>
      ) : (
        <span className="relative h-[13px] min-w-0 flex-1" aria-hidden>
          <span className="absolute inset-x-0 top-[6px] h-px border-t border-dashed border-rule-hair" />
        </span>
      )}

      <span className="w-[42px] flex-none text-right text-[10.5px] text-ink-faint tnum">
        {comparable ? (to - from === 0 ? '일치' : `차이 ${to - from}`) : unknownLabel}
      </span>
    </div>
  );
}

/** `SignalTrack` 묶음의 범례 — 채운 점이 나, 빈 점이 상대 */
export function SignalTrackLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <span className="flex items-center gap-1.5">
        <span className="h-[7px] w-[7px] flex-none rounded-full bg-ink-faint" aria-hidden />
        <span className="text-[10.5px] text-ink-muted">나</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-[7px] w-[7px] flex-none rounded-full border-[1.5px] border-ink-faint bg-canvas"
          aria-hidden
        />
        <span className="text-[10.5px] text-ink-muted">상대</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-px w-4 flex-none bg-rule-mid" aria-hidden />
        <span className="text-[10.5px] text-ink-muted">둘 사이 거리</span>
      </span>
    </div>
  );
}
