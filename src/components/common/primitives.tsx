import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import type { Confidence, EvidenceItem } from '@/types';

/* ---------------------------------------------------------------- Surface */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li';
}) {
  return (
    <Tag className={cn('rounded-card border border-line bg-surface p-4', className)}>{children}</Tag>
  );
}

/** 모든 내용을 카드로 감싸지 않는다. 질문·헤드라인은 배경 위에 직접 놓는다. */
export function PageHeading({
  lines,
  caption,
  eyebrow,
  size = 'title',
  className,
}: {
  lines: readonly string[];
  caption?: readonly string[] | string;
  eyebrow?: ReactNode;
  size?: 'title' | 'question' | 'display' | 'hero';
  className?: string;
}) {
  const sizeClass = {
    title: 'text-title',
    question: 'text-question',
    display: 'text-display',
    hero: 'text-hero',
  }[size];

  return (
    <div className={cn('flex flex-col gap-2 px-1', className)}>
      {eyebrow}
      <h1 className={cn(sizeClass, 'keep-all')}>
        {lines.map((line, index) => (
          <span key={`${index}-${line}`} className="block">
            {line}
          </span>
        ))}
      </h1>
      {caption ? (
        <p className="text-caption keep-all text-ink-sub">
          {Array.isArray(caption)
            ? caption.map((line, index) => (
                <span key={`${index}-${line}`} className="block">
                  {line}
                </span>
              ))
            : caption}
        </p>
      ) : null}
    </div>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('px-1 text-meta font-semibold tracking-[0.04em] text-ink-muted', className)}>
      {children}
    </h2>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-track', className)} aria-hidden />;
}

/* -------------------------------------------------------------------- Tag */

type TagTone = 'brand' | 'mint' | 'friction' | 'neutral';

const TAG_TONE: Record<TagTone, string> = {
  brand: 'bg-brand-tint text-brand-pressed',
  mint: 'bg-mint-tint text-mint-text',
  friction: 'bg-friction-tint text-friction-text',
  neutral: 'bg-chip text-ink-muted',
};

export function Tag({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: TagTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center rounded-[5px] px-2 py-1 text-label',
        TAG_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * 이 값은 'AI가 얼마나 확신하는가'가 아니라 '얼마나 많은 입력 근거가 확보됐는가'를 뜻한다.
 * 그래서 '확신도'라는 이름 대신 '관측 정보'라는 이름을 쓴다 — 자유서술을 많이 했다고
 * 분석이 사실일 확률이 높아지는 건 아니기 때문이다.
 */
const CONFIDENCE_TONE: Record<Confidence, { tone: TagTone; label: string }> = {
  high: { tone: 'mint', label: '관측 정보 충분' },
  medium: { tone: 'brand', label: '관측 정보 보통' },
  low: { tone: 'friction', label: '관측 정보 부족' },
};

/** 관측 정보량은 색만으로 구분하지 않고 항상 텍스트를 함께 보여준다. */
export function ConfidenceLabel({
  confidence,
  className,
}: {
  confidence: Confidence;
  className?: string;
}) {
  const { tone, label } = CONFIDENCE_TONE[confidence];
  return (
    <Tag tone={tone} className={className}>
      {label}
    </Tag>
  );
}

/* --------------------------------------------------------------- Evidence */

export function EvidenceRow({ item, className }: { item: EvidenceItem; className?: string }) {
  return (
    <li className={cn('flex gap-3 rounded-chip border border-line bg-surface p-3.5', className)}>
      <span className="flex-none pt-0.5 text-[11px] font-semibold text-brand-pressed tnum">
        {item.n}
      </span>
      <span className="text-caption keep-all text-[#555]">{item.text}</span>
    </li>
  );
}

export function EvidenceList({
  items,
  label = '이렇게 본 근거',
}: {
  items: EvidenceItem[];
  label?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <EvidenceRow key={item.n} item={item} />
        ))}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------- 프라이버시 안내 */

/**
 * 민감정보를 입력하는 순간에만 필요한 만큼 보여주는 안내 박스.
 *
 * 마커는 정보 아이콘을 쓴다 — 예전에는 테두리만 있는 사각형이었는데, 체크박스처럼 보여서
 * 사용자가 눌러야 하는 입력 요소로 오해할 수 있었다(실제로는 읽기 전용 안내다).
 */
export function NoticeBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-chip bg-sunken px-3.5 py-3">
      <Info size={14} className="mt-px flex-none text-ink-muted" aria-hidden />
      <p className="text-meta keep-all text-ink-sub">{children}</p>
    </div>
  );
}

/* -------------------------------------------------------------- 인라인 에러 */

export function InlineError({ message, id }: { message: string; id?: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-center gap-1.5 px-1 text-meta font-medium text-friction-text"
    >
      <span
        className="inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full bg-friction-tint text-[9px] font-bold"
        aria-hidden
      >
        !
      </span>
      {message}
    </p>
  );
}

/* ------------------------------------------------------------- 나 / 상대 대조 */

export function CompareBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-[10px] bg-sunken px-2.5 py-2.5">
      <p className="mb-1 text-[10.5px] text-ink-muted">{label}</p>
      <p className="text-caption keep-all leading-snug">{value}</p>
    </div>
  );
}

export function ComparePair({ mine, theirs }: { mine: string; theirs: string }) {
  return (
    <div className="flex gap-2">
      <CompareBox label="나" value={mine} />
      <CompareBox label="상대" value={theirs} />
    </div>
  );
}
