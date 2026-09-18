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

/* ------------------------------------------------- 트랙 기하 / Track geometry */

/**
 * ══ 선과 점의 **공통 중심축** (v1.48.2) ══════════════════════════════════════
 *
 * 선·점·링을 각각 따로 정렬하지 않는다. 트랙 한 칸 안의 모든 요소가 **하나의
 * 중심값**에서 자기 `top`을 유도한다. 그래서 어떤 요소의 크기를 바꿔도 정렬이
 * 저절로 유지된다 — 눈으로 맞춘 magic number가 없다.
 *
 * ══ 왜 지름이 전부 홀수인가 ══════════════════════════════════════════════════
 *
 * 1px 선은 정수 `top`에 놓일 때만 device pixel 한 줄을 꽉 채운다. 그래서 선의
 * 중심은 **반정수**(여기서는 7.5)일 수밖에 없다. 그 중심에 원을 맞추려면
 *
 * ```
 * top = 7.5 - 지름/2   →  정수가 되려면 지름이 홀수여야 한다
 * ```
 *
 * v1.48.1까지 이 규칙이 깨져 있었다. 중심 6.5에 **7px 점(top 3 · 정수)** 과
 * **12px 링(top 0.5 · 반픽셀)** 이 같이 있었고, 둘의 subpixel 위상이 달라서
 * 부모가 소수 좌표에 놓일 때마다 링이 점에서 미세하게 빗나가 보였다. 값이 같은
 * 행(`일치`)이 정확히 그 조합이라, 사용자가 지적한 행도 그 두 개였다.
 *
 * ⚠️ 그래서 **새 지름을 추가할 때는 반드시 홀수**여야 한다. `trackTop()`이
 * 정수를 돌려주지 않으면 그 크기는 이 트랙에 쓸 수 없다.
 * ⚠️ 가로(x) 위치는 실제 1~5 데이터에서 나오므로 소수일 수 있다. 이 규칙은
 * **세로 정렬만** 보장한다 — 데이터 매핑은 건드리지 않는다.
 */
export const TRACK = {
  /** 트랙 칸 높이. 짝수라 행 높이가 소수로 번지지 않는다 */
  height: 14,
  /** 모든 선·점·링이 공유하는 중심 y. 1px 선이 정수 top에 놓이는 반정수다 */
  center: 7.5,
  /** 1~5 전체 범위를 알리는 바탕선 */
  rail: 1,
  /** 두 점 사이 — 이 선의 길이가 거리다 */
  link: 3,
  /** 나 / 상대 점 */
  dot: 7,
  /** 두 값이 같을 때 겹침을 보이게 하는 바깥 링 */
  ring: 11,
} as const;

/**
 * 공통 중심에서 유도한 `top`(px).
 *
 * ⚠️ 홀수 지름에서만 정수가 나온다(위 주석). 정수가 아니면 그 요소는 반픽셀에
 * 놓여 흐려지므로, 크기를 고를 때 이 함수가 판정 기준이다.
 */
export function trackTop(size: number): number {
  return TRACK.center - size / 2;
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

      {/*
        트랙 칸 — 이 안의 모든 요소는 `TRACK.center` 하나에서 `top`을 받는다(`trackTop`).
        가로만 데이터(`pos`)로 정하고, 세로는 어떤 경우에도 흔들리지 않는다.
        점은 `-translate-x-1/2`로 자기 크기의 절반만큼 당긴다 — 크기를 바꿔도
        따라오는 구조이고, `-ml-[3.5px]` 같은 하드코딩된 반값을 쓰지 않는다.
      */}
      {comparable ? (
        <span
          className="relative min-w-0 flex-1"
          style={{ height: TRACK.height }}
          aria-hidden
        >
          {/* 바탕선 — 1~5의 전체 범위. '어디까지 갈 수 있는 축인지'만 알린다 */}
          <span
            className="absolute inset-x-0 bg-rule-hair"
            style={{ top: trackTop(TRACK.rail), height: TRACK.rail }}
          />
          {/* 두 점 사이 — 이 선의 길이가 거리다 */}
          <span
            className={cn('absolute rounded-full', linkTone)}
            style={
              {
                top: trackTop(TRACK.link),
                height: TRACK.link,
                left: pos(from),
                right: `calc(100% - ${pos(to)})`,
              } as CSSProperties
            }
          />
          {/*
            ⚠️ 두 값이 **같을 때**는 점이 정확히 겹친다. 그대로 두면 동그라미 하나만 보여
            '한 사람만 답했다'로 읽힌다 — 같은 자리에 둘 다 있다는 것이 이 행의 결론이므로
            바깥 링을 씌워 겹침 자체를 보이게 한다. 새 판정이 아니라 같은 값의 다른 그림이다.
            ⚠️ 링 지름은 점과 **같은 홀수 계열**이다. 짝수로 두면 링만 반픽셀에 놓여
            점에서 빗나가 보인다(v1.48.1에서 실제로 그랬다).
          */}
          {mine === theirs ? (
            <span
              className={cn(
                'absolute box-border -translate-x-1/2 rounded-full border',
                tone === 'good'
                  ? 'border-brand-soft'
                  : tone === 'friction'
                    ? 'border-friction'
                    : 'border-rule-mid',
              )}
              style={{
                top: trackTop(TRACK.ring),
                height: TRACK.ring,
                width: TRACK.ring,
                left: pos(mine),
              }}
            />
          ) : null}
          <span
            className={cn('absolute -translate-x-1/2 rounded-full', dotTone)}
            style={{
              top: trackTop(TRACK.dot),
              height: TRACK.dot,
              width: TRACK.dot,
              left: pos(mine),
            }}
          />
          {/*
            ⚠️ 빈 점(상대)은 채운 점(나)과 **바깥 크기가 같아야** 한다.
            `box-border`라 테두리가 바깥으로 자라지 않으므로 두 점의 중심이 어긋나지 않는다.
            테두리는 1px 정수다 — 1.5px는 브라우저가 1px로 내림해 의도와 렌더가 갈렸다.
          */}
          {mine !== theirs ? (
            <span
              className={cn(
                'absolute box-border -translate-x-1/2 rounded-full border bg-canvas',
                tone === 'good'
                  ? 'border-brand'
                  : tone === 'friction'
                    ? 'border-friction'
                    : 'border-ink-faint',
              )}
              style={{
                top: trackTop(TRACK.dot),
                height: TRACK.dot,
                width: TRACK.dot,
                left: pos(theirs),
              }}
            />
          ) : null}
        </span>
      ) : (
        <span className="relative min-w-0 flex-1" style={{ height: TRACK.height }} aria-hidden>
          <span
            className="absolute inset-x-0 border-t border-dashed border-rule-hair"
            style={{ top: trackTop(TRACK.rail) }}
          />
        </span>
      )}

      <span className="w-[42px] flex-none text-right text-[10.5px] text-ink-faint tnum">
        {comparable ? (to - from === 0 ? '일치' : `차이 ${to - from}`) : unknownLabel}
      </span>
    </div>
  );
}

/**
 * `SignalTrack` 묶음의 범례 — 채운 점이 나, 빈 점이 상대.
 *
 * ⚠️ v1.48.2 — 표본의 크기·테두리를 **트랙과 같은 값**(`TRACK`)에서 가져온다.
 * 예전에는 범례만 `border-[1.5px]`였고 트랙의 빈 점은 1px이라, 범례가 실제
 * 마커보다 두껍게 보였다 — 범례는 화면의 기호를 설명하는 자리이므로 같은
 * 기호여야 한다. 값을 두 곳에 적어두면 한쪽만 고쳐질 때 조용히 갈린다.
 */
export function SignalTrackLegend({ className }: { className?: string }) {
  const dot = { height: TRACK.dot, width: TRACK.dot };

  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <span className="flex items-center gap-1.5">
        <span className="flex-none rounded-full bg-ink-faint" style={dot} aria-hidden />
        <span className="text-[10.5px] text-ink-muted">나</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="box-border flex-none rounded-full border border-ink-faint bg-canvas"
          style={dot}
          aria-hidden
        />
        <span className="text-[10.5px] text-ink-muted">상대</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-4 flex-none bg-rule-mid"
          style={{ height: TRACK.rail }}
          aria-hidden
        />
        <span className="text-[10.5px] text-ink-muted">둘 사이 거리</span>
      </span>
    </div>
  );
}
