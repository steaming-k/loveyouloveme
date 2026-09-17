import type { ReactNode } from 'react';

import { REPORT_COPY } from '@/data/copy';
import { cn } from '@/lib/cn';

/**
 * Lovy Observation Report — 결과 화면의 상위 framing (v1.20)
 *
 * 결과를 '같은 크기의 rounded card 나열'이 아니라 **하나의 관찰 보고서**로 읽히게 한다:
 * 얇은 divider · 섹션 번호 · 작은 technical code · 한국어 제목 · 본문. 카드는 실제로
 * 구조가 있는 것(SignalCard 등)에만 남긴다.
 *
 * ⚠️ 계산·섹션 구성·anchor id는 v1.19 그대로다. 이 컴포넌트는 **표현만** 바꾼다.
 */
export function ReportHeader({
  title,
  meta,
  note,
  eyebrow = REPORT_COPY.eyebrow,
}: {
  title: string;
  /**
   * v1.46.4 Meta Copy — 제목 아래 한 문장(무엇을 같이 봤는지). meta 칩과 섞으면 `·`로
   * 이어져 문장이 칩처럼 끊겨 보여서 따로 둔다. 없으면 그리지 않는다.
   */
  note?: string | null;
  /** 사용자가 이해할 수 있는 값만. 내부 식별자(analysisId·fingerprint)는 넣지 않는다. */
  meta: readonly string[];
  /**
   * 보고서 종류 라벨. 기본은 무료 관찰 보고서(`LOVY OBSERVATION REPORT`)다.
   *
   * ⚠️ v1.48.1 — `null`이면 **그리지 않는다.** Premium Deep Report처럼 화면 헤더
   * (`ScreenHeader`의 `ScreenMarker`)가 이미 같은 라벨을 들고 있는 자리에서는 이 줄이
   * 같은 문자열을 한 번 더 찍어 첫 viewport에 marker가 두 번 보였다(실측). 라벨의
   * 자리 연속성(Paywall → Unlock → Report)은 헤더 쪽 marker가 이미 맡고 있다.
   */
  eyebrow?: string | null;
}) {
  return (
    <header className="flex flex-col gap-2 px-1 pt-2">
      {/*
        v1.48 — 보고서 종류 라벨을 **편집 marker**로. Splash의 `LOVE RESEARCH : EARTH`,
        History의 `RELATIONSHIP HISTORY`와 같은 형태(rule + 넓은 자간)를 쓴다 —
        화면마다 다른 모양의 라벨이 있으면 그건 시스템이 아니다.
      */}
      {eyebrow ? (
        <p className="flex items-center gap-2.5">
          <span className="h-px w-4 flex-none bg-rule-ink" aria-hidden />
          <span className="text-[10px] font-semibold tracking-[0.18em] text-ink-muted">
            {eyebrow}
          </span>
        </p>
      ) : null}
      <h1 className="text-[24px] font-semibold leading-[1.34] tracking-[-0.7px] keep-all">
        {title}
      </h1>
      {note ? (
        <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{note}</p>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-ink-muted tnum">
        {meta.map((item, index) => (
          <span key={item} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span className="text-line-strong" aria-hidden>
                ·
              </span>
            ) : null}
            {item}
          </span>
        ))}
      </p>
    </header>
  );
}

/** `01 · SUMMARY` 형태의 섹션 표식. `ReportSection` 밖에서도 같은 위계를 쓸 수 있게 뺐다. */
export function ReportSectionEyebrow({ index, code }: { index: string; code: string }) {
  return (
    <p className="px-1 text-[11px] font-semibold tracking-[0.16em] text-ink-faint">
      <span className="tnum">{index}</span>
      <span className="mx-1.5 text-line-strong" aria-hidden>
        ·
      </span>
      {code}
    </p>
  );
}

/**
 * 번호가 붙은 보고서 섹션.
 * `index`는 화면에서 실제로 렌더되는 섹션만 세어 호출부가 넘긴다 — 조건부로 빠진 섹션
 * 때문에 번호가 건너뛰면 보고서로 안 읽힌다.
 */
export function ReportSection({
  id,
  index,
  code,
  title,
  caption,
  action,
  children,
  className,
}: {
  id?: string;
  index: string;
  code: string;
  title: string;
  caption?: ReactNode;
  /** 제목 줄 오른쪽의 작은 부가 요소(AI 출처 라벨 등) */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    /*
      v1.46 §26 · §27 — Result scroll reveal. **한 번만** 재생된다.

      ⚠️ 클래스만으로는 아무 일도 일어나지 않는다. `useRevealOnce`가 이 화면의
      컨테이너에서 `.reveal-once`를 찾아 `data-reveal="in"`을 붙일 때 최종 상태가
      되고, 훅이 없거나 실패하면 훅 쪽 3중 안전장치가 즉시 최종 상태로 만든다
      (`hooks/useRevealOnce.ts` 참고). 연출 때문에 보고서가 사라지지 않는다.

      ⚠️ **번호가 붙은 섹션에만 건다.** 보고서 안의 카드 하나하나까지 걸면 스크롤할
      때마다 화면이 계속 무언가를 재생하고, 그건 §24가 말한 '모든 것을 움직이는 것'이다.
    */
    /*
      ══ v1.48 — 섹션 머리를 **한 덩어리 composition**으로 ═════════════════════

      예전 순서는 모든 섹션에서 똑같았다:

      ```
      ──────────────  divider
      01 · SUMMARY    tiny uppercase
      잘 맞는 신호      19px semibold
      캡션            13px
      ```

      섹션이 다섯 개면 이 4단 구조가 다섯 번 반복되고, 보고서가 아니라 **양식**처럼
      읽힌다. §4-C가 지적한 'tiny uppercase eyebrow 남발'의 진짜 원인이 이 반복이다.

      지금은 번호를 **큰 활자로 왼쪽에 세우고**, 제목과 technical code를 그 오른쪽에
      묶는다. 번호가 커진 만큼 code는 작아져서, 같은 정보가 tiny uppercase 한 줄을
      또 만들지 않는다.

      ⚠️ `index` · `code` · `title` · anchor id는 그대로다. 정보를 빼지 않았다 —
      같은 정보를 다른 배치로 놓았을 뿐이다.
    */
    <section id={id} className={cn('reveal-once flex flex-col scroll-mt-3', className)}>
      <div className="field-rule mt-7 mb-4" />

      <div className="flex items-start gap-3 px-1">
        {/* 관찰 번호 — 보고서의 순서. tabular라 두 자리로 늘어도 제목이 밀리지 않는다 */}
        <span
          className="flex-none pt-[3px] text-[21px] leading-none font-semibold text-ink-faint tnum"
          aria-hidden
        >
          {index}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold leading-[1.34] tracking-[-0.45px] keep-all">
            {title}
          </h2>
          <p className="mt-1 text-[9.5px] font-semibold tracking-[0.2em] text-ink-faint">
            {code}
          </p>
        </div>

        {action ? <div className="flex-none">{action}</div> : null}
      </div>

      {caption ? (
        <p className="mt-2 px-1 text-caption keep-all leading-relaxed text-ink-sub">{caption}</p>
      ) : null}

      <div className="mt-3.5 flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

/**
 * 근거·메타데이터 블록. 카드로 감싸지 않고 얇은 좌측 rule로만 구분한다 —
 * 보고서 안에서 '이건 본문이 아니라 근거'라는 위계를 만드는 최소 장치다.
 */
export function ReportEvidenceBlock({ children }: { children: ReactNode }) {
  return (
    /* v1.48 — 같은 역할의 Evidence Surface 유틸리티로 통일한다(globals.css) */
    <div className="surf-evidence">
      <p className="text-caption keep-all leading-relaxed text-ink-sub">{children}</p>
    </div>
  );
}
