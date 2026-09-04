import { cn } from '@/lib/cn';

/**
 * 관찰 필드 (v1.20)
 *
 * 분석 화면 중앙의 그래픽. 큰 gradient orb / AI sparkle / waveform을 쓰지 않는다 —
 * 대신 **관찰 → 수집 → 연결 → 보고서**라는 실제 과정을 그대로 그린다.
 *
 *   stage 0  각 관계 신호가 관찰 토큰으로 하나씩 나타난다
 *   stage 1  수집 표시(작은 채워진 점)가 켜진다
 *   stage 2  토큰들에서 얇은 선이 그려져 한 지점으로 모인다
 *   stage 3  모인 지점에서 관찰 기록지가 펼쳐지고 문장 줄이 채워진다
 *
 * 모션은 CSS transition으로만 만든다(globals.css `.obs-*`). JS로 transform을 붙이면
 * SSR 결과와 첫 클라이언트 렌더가 달라져 hydration이 깨지고, prefers-reduced-motion을
 * 한 곳에서 끌 수 없다.
 */
export function ObservationField({
  tokens,
  stage,
  className,
}: {
  /** 관찰 중인 신호 이름. 3~4개를 기준으로 배치한다. */
  tokens: readonly string[];
  /** 현재 단계 index. 단계 수를 넘어서면(READY) 마지막 상태를 유지한다. */
  stage: number;
  className?: string;
}) {
  const count = Math.max(tokens.length, 1);
  const top = 26;
  const bottom = 144;
  const step = count > 1 ? (bottom - top) / (count - 1) : 0;
  const rows = tokens.map((label, index) => ({ label, y: top + step * index }));

  const collected = stage >= 1;
  const connected = stage >= 2;
  const written = stage >= 3;

  return (
    <svg
      viewBox="0 0 300 170"
      className={cn('h-auto w-full max-w-[300px]', className)}
      role="img"
      aria-label={`관찰 중인 신호 ${tokens.length}개: ${tokens.join(', ')}`}
    >
      {/* 신호 → 기록지로 모이는 얇은 경로. 게임 UI 같은 glow를 쓰지 않는다. */}
      {rows.map((row, index) => (
        <path
          key={`path-${row.label}`}
          className="obs-path"
          data-on={connected}
          style={{ transitionDelay: `${index * 70}ms` }}
          d={`M132,${row.y} C156,${row.y} 164,85 184,85`}
          fill="none"
          stroke="var(--color-brand-soft)"
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}

      {/* 관찰 토큰 */}
      {rows.map((row, index) => (
        <g
          key={row.label}
          className="obs-token"
          data-on={stage >= 0}
          data-dim={written}
          style={{ transitionDelay: `${index * 90}ms` }}
        >
          <rect
            x={6}
            y={row.y - 12}
            width={126}
            height={24}
            rx={7}
            fill="var(--color-surface)"
            stroke="var(--color-line)"
          />
          <circle cx={22} cy={row.y} r={4} fill="none" stroke="var(--color-dash)" />
          <circle
            className="obs-mark"
            data-on={collected}
            style={{ transitionDelay: `${index * 70}ms` }}
            cx={22}
            cy={row.y}
            r={2.2}
            fill="var(--color-mint-deep)"
          />
          <text
            x={36}
            y={row.y + 4}
            fontSize={11.5}
            fill="var(--color-ink-sub)"
            style={{ letterSpacing: '-0.2px' }}
          >
            {row.label}
          </text>
        </g>
      ))}

      {/* 신호가 모이는 지점 */}
      <circle
        className="obs-mark"
        data-on={connected}
        cx={184}
        cy={85}
        r={4.5}
        fill="var(--color-brand-tint)"
        stroke="var(--color-brand-soft)"
      />

      {/* 아직 아무것도 쓰이지 않은 기록지. 처음부터 자리를 잡아둬야 앞 단계에서 화면이
          왼쪽으로 쏠려 보이지 않는다 — 빈 지면이 채워지는 것 자체가 이 그래픽의 의미다. */}
      <rect
        x={192}
        y={40}
        width={102}
        height={90}
        rx={8}
        fill="none"
        stroke="var(--color-dash)"
        strokeDasharray="4 5"
        opacity={0.6}
      />

      {/* 관찰 기록지 */}
      <g className="obs-sheet" data-on={written}>
        <rect
          x={192}
          y={40}
          width={102}
          height={90}
          rx={8}
          fill="var(--color-surface)"
          stroke="var(--color-line-strong)"
        />
        <rect x={204} y={56} width={40} height={3} rx={1.5} fill="var(--color-mint)" />
        {[74, 84, 94, 104].map((y, index) => (
          <rect
            key={y}
            className="obs-line"
            data-on={written}
            style={{ transitionDelay: `${160 + index * 90}ms` }}
            x={204}
            y={y}
            width={[78, 66, 78, 50][index]}
            height={2.5}
            rx={1.25}
            fill="var(--color-line-strong)"
          />
        ))}
      </g>
    </svg>
  );
}
