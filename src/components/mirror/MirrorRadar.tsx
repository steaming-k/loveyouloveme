import { RADAR_VIEWBOX, radarGrid, radarPoints } from '@/lib/logic/mirror';
import type { MirrorInsight } from '@/types';

const SIZE_PX = 230;
const LABEL_RADIUS_PX = 112;

/**
 * Declared Me ↔ Relationship Me 겹쳐 보기 (S27)
 *
 * 평범한 Bar Chart 3개 대신, 두 개의 '나'를 같은 축 위에 겹쳐서
 * 어디가 벌어졌는지 한눈에 보이게 한다.
 * 다만 이 그림만으로 결론이 나지 않도록, 아래 항목별 대조 행이 항상 함께 있다.
 */
export function MirrorRadar({ insights }: { insights: MirrorInsight[] }) {
  const count = insights.length;

  const grid = radarGrid(count);
  const axisEnds = radarPoints(Array.from({ length: count }, () => 5)).split(' ');

  const declaredPoints = radarPoints(insights.map((insight) => insight.declared));
  const relationshipPoints = radarPoints(insights.map((insight) => insight.relationship));

  const center = SIZE_PX / 2;
  const labels = insights.map((insight, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      label: insight.label,
      state: insight.state,
      left: center + LABEL_RADIUS_PX * Math.cos(angle),
      top: center + LABEL_RADIUS_PX * Math.sin(angle),
    };
  });

  return (
    <figure className="m-0 flex flex-col items-center gap-1.5 rounded-card border border-line bg-surface px-4 pt-4 pb-[18px]">
      <div
        className="relative my-2"
        style={{ width: SIZE_PX, height: SIZE_PX }}
        role="img"
        aria-label={`항목별 대조 그래프. ${insights
          .map((insight) => `${insight.label} 말한 나 ${insight.declared}점, 관계 속 나 ${insight.relationship}점`)
          .join('. ')}`}
      >
        <svg
          viewBox={`0 0 ${RADAR_VIEWBOX} ${RADAR_VIEWBOX}`}
          className="block h-full w-full"
          aria-hidden
        >
          {grid.map((points) => (
            <polygon key={points} points={points} fill="none" stroke="#EDEBE6" strokeWidth={1} />
          ))}

          {axisEnds.map((end) => {
            const [x, y] = end.split(',');
            return (
              <line
                key={end}
                x1={100}
                y1={100}
                x2={x}
                y2={y}
                stroke="#EDEBE6"
                strokeWidth={1}
              />
            );
          })}

          {/* 네가 말한 너 — 점선 회색 */}
          <polygon
            points={declaredPoints}
            fill="none"
            stroke="#A8A29A"
            strokeWidth={1.6}
            strokeDasharray="5 4"
          />

          {/* 관계 속의 너 — Purple. Gap이 드러나는 순간이라 여기만 리빌한다. */}
          <polygon
            className="reveal-shape"
            points={relationshipPoints}
            fill="#8F74F0"
            fillOpacity={0.16}
            stroke="#8F74F0"
            strokeWidth={2.2}
          />
        </svg>

        {labels.map((item) => (
          <span
            key={item.label}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[11.5px] font-medium text-[#555]"
            style={{ left: item.left, top: item.top }}
            aria-hidden
          >
            {item.label}
          </span>
        ))}
      </div>

      <figcaption className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-[1.6px] border-dashed border-[#A8A29A]" aria-hidden />
          <span className="text-[11.5px] text-ink-sub">네가 말한 너</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-sm bg-brand" aria-hidden />
          <span className="text-[11.5px] text-ink-sub">관계 속의 너</span>
        </span>
      </figcaption>
    </figure>
  );
}
