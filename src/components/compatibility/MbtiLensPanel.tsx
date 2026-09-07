import { MBTI_AXES } from '@/data/mbti';
import { MBTI_LENS_COPY } from '@/data/copy';
import { cn } from '@/lib/cn';
import type { MbtiAxisComparison, MbtiAxisKey, MbtiLensReport, MbtiSelfLens } from '@/types';

/**
 * MBTI 4축 관찰표 — Supporting Lens (v1.24 P3-1 §7 · §26)
 *
 * 이전 구현은 '나/상대 2단 카드 + 안내 박스 + 축마다 문단'을 가진 **카드**였다. 그래서
 * 흔한 MBTI 궁합 사이트처럼 읽혔고, 같은 글자가 화면에 세 번(내 패널 · 상대 패널 ·
 * 함께 보기) 반복됐다.
 *
 * 지금은 **하나의 비교 필드 안의 4개 축 row**다 — 외계인이 두 사람의 성향 좌표를 적어둔
 * 관찰표에 가깝다.
 *
 * 지키는 것
 *   - 궁합 %, 별점, progress ring, 게이지, 큰 숫자를 만들지 않는다. MBTI를 또 하나의
 *     '점수'로 만들지 않는다.
 *   - 같음/다름을 색으로 좋고 나쁨처럼 칠하지 않는다 — 두 상태 모두 같은 중립 chip을
 *     쓰고 **텍스트로만** 구분한다.
 *   - marker는 색·위치만으로 구분되지 않는다. 항상 '나' / '상대' 텍스트를 함께 쓴다.
 *   - 유형 해설을 길게 쓰지 않는다(MBTI 교육 페이지가 되지 않는다).
 */

/** 축의 한쪽 끝. 그 극(pole)에 서 있는 사람의 marker를 함께 보여준다. */
function AxisPole({
  letter,
  poleLabel,
  markers,
  align,
}: {
  letter: string;
  poleLabel: string;
  /** 이 극에 있는 사람들. 비어 있으면 marker를 그리지 않는다 */
  markers: readonly string[];
  align: 'start' | 'end';
}) {
  const occupied = markers.length > 0;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-1',
        align === 'end' ? 'items-end text-right' : 'items-start text-left',
      )}
    >
      <div className={cn('flex items-center gap-1.5', align === 'end' ? 'flex-row-reverse' : '')}>
        <span
          className={cn(
            'text-[13px] font-semibold tnum',
            occupied ? 'text-ink' : 'text-ink-faint',
          )}
        >
          {letter}
        </span>
        {markers.map((marker) => (
          <span
            key={marker}
            className="rounded-[4px] bg-sunken px-1.5 py-0.5 text-[10px] font-semibold text-ink-sub"
          >
            {marker}
          </span>
        ))}
      </div>

      <span
        className={cn(
          'text-[10.5px] keep-all leading-snug',
          occupied ? 'text-ink-muted' : 'text-ink-faint',
        )}
      >
        {poleLabel}
      </span>
    </div>
  );
}

/** 두 극 사이를 잇는 얇은 선. 정도(degree)를 뜻하지 않으므로 눈금을 만들지 않는다. */
function AxisRail() {
  return (
    <span className="mt-[7px] h-px w-8 flex-none self-start bg-line-strong" aria-hidden />
  );
}

function AxisRow({
  axis,
  /** 나만 볼 때는 상대 marker도, 같음/다름 판정도 없다 */
  theirsLetter,
}: {
  axis: { key: MbtiAxisKey; eyebrow: string; label: string; mineLetter: string; same?: boolean };
  theirsLetter?: string;
}) {
  const definition = MBTI_AXES.find((item) => item.key === axis.key);
  const letters = Object.keys(definition?.poles ?? {});
  const [leftLetter, rightLetter] = [letters[0] ?? axis.mineLetter, letters[1] ?? axis.mineLetter];

  const markersOn = (letter: string): string[] => {
    const list: string[] = [];
    if (axis.mineLetter === letter) list.push(MBTI_LENS_COPY.axesLegendMine);
    if (theirsLetter === letter) list.push(MBTI_LENS_COPY.axesLegendTheirs);
    return list;
  };

  return (
    <li className="flex flex-col gap-2 border-t border-line-soft pt-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
            {axis.eyebrow}
          </span>
          <span className="text-[12px] keep-all text-ink-sub">{axis.label}</span>
        </div>

        {axis.same === undefined ? null : (
          <span className="flex-none rounded-[5px] bg-chip px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
            {axis.same ? MBTI_LENS_COPY.axesSame : MBTI_LENS_COPY.axesDifferent}
          </span>
        )}
      </div>

      <div className="flex items-start gap-2">
        <AxisPole
          letter={leftLetter}
          poleLabel={definition?.poles[leftLetter] ?? ''}
          markers={markersOn(leftLetter)}
          align="start"
        />
        <AxisRail />
        <AxisPole
          letter={rightLetter}
          poleLabel={definition?.poles[rightLetter] ?? ''}
          markers={markersOn(rightLetter)}
          align="end"
        />
      </div>
    </li>
  );
}

/**
 * 4축 한눈 요약 — 축 이름 + 같음/다름만 (v1.38 · §22)
 *
 * **왜 만들었나.** 첫 읽기에서 필요한 건 '어느 축이 갈렸는가'까지다. 극(pole) 라벨과
 * marker까지 전부 펼쳐두면 그 블록만 375px에서 546px(0.9 화면)을 먹고, 그 아래 있는
 * PATTERN과 Bridge(이 화면의 Surprise)가 통째로 밀린다 — 실측에서 Bridge가 2.37 화면
 * 아래였다. 그래서 **삭제하지 않고 위계를 나눈다**: 요약은 항상 보이고, 상세는 펼친다.
 *
 * ⚠️ 새로 판정하지 않는다. `MbtiLensReport`가 이미 계산한 `same`만 읽는다.
 * 색으로 좋고 나쁨을 칠하지 않는 규칙도 그대로다 — 두 상태 모두 같은 중립 chip이다.
 */
export function MbtiAxisSummary({ report }: { report: MbtiLensReport }) {
  return (
    <ul className="flex flex-col">
      {report.axes.map((axis: MbtiAxisComparison) => (
        <li
          key={axis.key}
          className="flex items-baseline justify-between gap-3 border-t border-line-soft py-2 first:border-t-0"
        >
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
              {axis.eyebrow}
            </span>
            <span className="text-[12px] keep-all text-ink-sub">{axis.label}</span>
          </p>
          <span className="flex-none rounded-[5px] bg-chip px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
            {axis.same ? MBTI_LENS_COPY.axesSame : MBTI_LENS_COPY.axesDifferent}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 두 사람의 4축 비교표. `MbtiLensReport`가 이미 계산한 축별 같음/다름만 읽는다 —
 * 여기서 새로 판정하지 않고, 개수를 합산해 점수로 만들지도 않는다.
 */
export function MbtiAxisField({ report }: { report: MbtiLensReport }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4">
      <ul className="flex flex-col gap-3.5">
        {report.axes.map((axis: MbtiAxisComparison) => (
          <AxisRow key={axis.key} axis={axis} theirsLetter={axis.theirsLetter} />
        ))}
      </ul>

      <p className="border-t border-line-soft pt-3 text-[11px] keep-all leading-relaxed text-ink-muted">
        {MBTI_LENS_COPY.axesFootnote}
      </p>
    </div>
  );
}

/**
 * 한 사람만 있을 때의 4축 관찰표(Self First).
 * 비교가 아니므로 같음/다름 판정을 하지 않고, 상대 marker도 그리지 않는다.
 */
export function MbtiSelfAxisField({ lens, label }: { lens: MbtiSelfLens; label: string }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">{label}</p>
        <p className="text-body font-semibold tracking-[-0.2px]">{lens.type}</p>
      </div>

      <p className="text-[12.5px] keep-all leading-relaxed text-ink-sub">{lens.note}</p>

      <ul className="flex flex-col gap-3.5 border-t border-line-soft pt-3.5">
        {lens.axes.map((axis) => (
          <AxisRow
            key={axis.key}
            axis={{
              key: axis.key,
              eyebrow: axis.eyebrow,
              label: axis.label,
              mineLetter: axis.letter,
            }}
          />
        ))}
      </ul>
    </div>
  );
}
