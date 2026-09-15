import { chapterSourceLabels } from '@/lib/premiumMetaCopy';
import type { PremiumSourceGroup, RelationshipTense } from '@/types';

/**
 * Evidence → Connection 시각화 (Concept Polish 260915)
 *
 * ══ 왜 이 컴포넌트가 생겼나 ═══════════════════════════════════════════════
 *
 * Premium이 파는 것은 '더 긴 글'이 아니라 **따로 답한 것들 사이의 연결**이다(§55).
 * 그런데 그 연결이 화면에서는 접힌 헤더의 가운뎃점 한 줄로만 보였다:
 *
 * ```
 * 네가 말한 기준 · 상대에 대해 적은 내용 · 예전 관계 경험
 * ```
 *
 * 이 줄은 **정확한 사실**인데(각 Chapter가 실제로 이은 source다), 읽는 사람에게는
 * 그냥 작은 메타 라벨로 지나간다. 그래서 무료와 유료의 차이가 '글이 길어졌다'로
 * 읽혔다 — 1차 UT에서 반복해서 나온 반응이다.
 *
 * 여기서 하는 일은 **없던 정보를 만드는 게 아니라, 이미 있는 provenance를 구조로
 * 보여주는 것**이다. 입력은 `chapter.sourceGroups` 하나뿐이고, 그 값은 Chapter
 * Engine이 실제로 근거를 읽은 자리에서만 채워진다.
 *
 * ══ ⚠️ 가짜 연결을 만들지 않는다 ══════════════════════════════════════════
 *
 * - **source가 2종 미만이면 아무것도 그리지 않는다.** '연결'이라고 부르려면 이을
 *   것이 둘은 있어야 한다. 하나짜리를 화살표로 그리면 그건 연결이 아니라 장식이고,
 *   장식을 근거처럼 보이게 만드는 건 이 제품이 가장 피해야 하는 종류의 거짓말이다.
 * - **라벨도 순서도 여기서 짓지 않는다.** `chapterSourceLabels` 한 곳에서만 가져온다 —
 *   접힌 헤더와 다른 이름이나 다른 순서가 나오면 같은 근거가 둘로 보인다.
 * - **개수를 세어 보여주지 않는다.** `자료 3종` 같은 표현은 v1.46.4에서 이미
 *   '무엇을 같이 봤는지'로 바뀐 규칙이다.
 *
 * ══ 왜 세로 목록인가 ═══════════════════════════════════════════════════════
 *
 * 393px에서 가로 다이어그램은 라벨이 접히거나 글자가 8px 아래로 내려간다. 세로로
 * 쌓고 왼쪽에 합류선을 그리면, 좁은 화면에서도 '여러 개가 하나로 모인다'는 관계가
 * 그대로 읽힌다. 선은 CSS border로만 그린다 — SVG도 라이브러리도 쓰지 않는다.
 */
export function EvidenceConnectionTrail({
  groups,
  tense,
  /** 이 연결이 도착한 자리 — Chapter의 축 이름(예: `연락`). 없으면 도착점을 그리지 않는다 */
  destination,
}: {
  groups: readonly PremiumSourceGroup[];
  tense: RelationshipTense;
  destination?: string | null;
}) {
  /*
    ⚠️ 접힌 헤더 줄과 **같은 함수**로 라벨·순서를 만든다. 각자 정렬하면 같은 근거가
    다른 순서로 나와서 서로 다른 목록 두 개처럼 보인다.
  */
  const labels = chapterSourceLabels(groups, tense);

  /* ⚠️ 이을 것이 둘 미만이면 연결이 아니다. 그릴 것이 없으면 그리지 않는다 */
  if (labels.length < 2) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-line-soft bg-sunken px-3.5 py-3">
      <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">러비가 이어본 것</p>

      <ul className="flex flex-col">
        {labels.map((label, index) => {
          const last = index === labels.length - 1;
          return (
            <li key={label} className="flex items-stretch gap-2.5">
              {/*
                합류선. 마지막 항목에서 세로선을 끊어 '여기서 모인다'를 만든다.
                aria-hidden — 스크린리더에는 아래 목록 텍스트만 읽히면 된다.
              */}
              <span aria-hidden className="relative flex w-3 flex-none justify-center">
                <span
                  className={cnLine(last)}
                />
                <span className="absolute top-[0.6rem] h-px w-2 translate-x-[0.15rem] bg-line-strong" />
              </span>
              <span className="min-w-0 flex-1 py-0.5 text-[12px] keep-all leading-relaxed text-ink-sub">
                {label}
              </span>
            </li>
          );
        })}
      </ul>

      {destination ? (
        <p className="mt-0.5 flex items-baseline gap-1.5 text-[12px] keep-all leading-relaxed">
          <span aria-hidden className="flex-none text-brand-pressed">
            ↳
          </span>
          <span className="min-w-0">
            <span className="font-semibold text-brand-ink">{destination}</span>
            <span className="text-ink-sub">에서 만났어</span>
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** 마지막 항목은 세로선을 위쪽 절반만 그린다 — 선이 아래로 새면 '계속된다'로 읽힌다 */
function cnLine(last: boolean): string {
  return last
    ? 'absolute left-1/2 top-0 h-[0.6rem] w-px -translate-x-1/2 bg-line-strong'
    : 'absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-line-strong';
}
