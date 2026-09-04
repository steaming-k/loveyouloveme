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
}: {
  title: string;
  /** 사용자가 이해할 수 있는 값만. 내부 식별자(analysisId·fingerprint)는 넣지 않는다. */
  meta: readonly string[];
}) {
  return (
    <header className="flex flex-col gap-2 px-1 pt-2">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-ink-faint">
        {REPORT_COPY.eyebrow}
      </p>
      <h1 className="text-[24px] font-semibold leading-[1.34] tracking-[-0.7px] keep-all">
        {title}
      </h1>
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
    <section id={id} className={cn('flex flex-col scroll-mt-3', className)}>
      <div className="mt-6 mb-4 h-px bg-line-soft" aria-hidden />

      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <ReportSectionEyebrow index={index} code={code} />
        </div>
        {action ? <div className="flex-none">{action}</div> : null}
      </div>

      <h2 className="mt-1 px-1 text-[19px] font-semibold leading-[1.42] tracking-[-0.4px] keep-all">
        {title}
      </h2>

      {caption ? (
        <p className="mt-1.5 px-1 text-caption keep-all leading-relaxed text-ink-sub">{caption}</p>
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
    <div className="border-l-2 border-line-strong pl-3.5">
      <p className="text-caption keep-all leading-relaxed text-ink-sub">{children}</p>
    </div>
  );
}
