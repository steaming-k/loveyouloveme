import { LovyMark } from '@/components/common/fieldNotes';
import { chapterSourceLabels } from '@/lib/premiumMetaCopy';
import type { PremiumSourceGroup, RelationshipTense } from '@/types';

/**
 * Evidence → Connection 시각화 (Concept Polish 260915 · Art Direction v1.48)
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
 * ══ v1.48 — 회색 상자에서 **연결 밴드**로 ═════════════════════════════════
 *
 * v1.47까지는 `rounded-card border bg-sunken` 안의 세로 목록이었다. 정직했지만
 * **여전히 카드였고, 그 페이지의 다른 카드보다 작고 옅었다** — 화면에서 가장 중요한
 * 것이 가장 작게 그려져 있었다는 뜻이다. Premium이 '카드가 더 많다'로 읽힌 이유가
 * 정확히 이것이다.
 *
 * 지금은 카드가 아니라 **밴드**다: 모서리가 없고(radius 0), 위아래 rule로 열고 닫고,
 * 좌우로 본문보다 넓게 나간다. 그리고 여러 갈래가 **한 점으로 모이고**, 그 점에서
 * 아래로 내려가 도착지에 닿는다.
 *
 * ```
 *  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
 *   ⋎ 러비가 이어본 것
 *
 *          네가 말한 기준  ──┐
 *     상대에 대해 적은 내용  ──●
 *          예전 관계 경험  ──┘  │
 *  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
 *   ↳ 갈등 해결 에서 만났어
 * ```
 *
 * **무료에서는 따로 있던 근거가 여기서는 한 점으로 모인다** — 그것이 이 화면이
 * 팔고 있는 것이고, 이제 그림이 그 말을 한다.
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
 * - **node를 하나 더 넣지 않는다.** 합류점은 하나다 — 실제로 한 번 이은 것을
 *   두 번 이은 것처럼 그리면 그림이 근거보다 커진다.
 *
 * ══ 왜 세로 목록인가 ═══════════════════════════════════════════════════════
 *
 * 393px에서 가로 다이어그램은 라벨이 접히거나 글자가 8px 아래로 내려간다. 세로로
 * 쌓고 오른쪽에서 합류시키면, 좁은 화면에서도 '여러 개가 하나로 모인다'는 관계가
 * 그대로 읽힌다. 선은 CSS로만 그린다 — SVG도 라이브러리도 쓰지 않는다.
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

  /** 한 줄 높이(px). 합류선의 위/아래 끝을 첫 줄·마지막 줄의 **중심**에 맞추는 데 쓴다 */
  const ROW = 28;
  const half = ROW / 2;

  return (
    <section
      /*
        밴드 — 모서리가 없고, 본문 여백보다 좌우로 조금 더 나간다.
        이 페이지의 다른 표면은 전부 rounded card이므로, 모서리가 없다는 사실만으로
        '여긴 다른 종류의 면'이 된다.
      */
      className="-mx-2 flex flex-col gap-3 border-y border-brand-edge bg-brand-tint px-4 py-4"
    >
      <p className="flex items-center gap-2">
        <LovyMark size={13} />
        <span className="text-[10.5px] font-semibold tracking-[0.14em] text-brand-pressed">
          러비가 이어본 것
        </span>
      </p>

      {/*
        ── 합류 ──────────────────────────────────────────────────────────────
        오른쪽 44px을 합류 영역으로 비워두고, 각 줄이 짧은 tick으로 그 영역에 닿는다.
        세로선은 첫 줄 중심에서 마지막 줄 중심까지만 그린다 — 위아래로 새면
        '계속된다'로 읽힌다.
      */}
      <div className="relative pr-11">
        <ul className="flex flex-col">
          {labels.map((label) => (
            <li key={label} className="flex items-center" style={{ height: ROW }}>
              <span className="min-w-0 flex-1 text-right text-[12.5px] keep-all text-brand-ink">
                {label}
              </span>
              <span className="ml-2.5 h-px w-4 flex-none bg-brand-soft" aria-hidden />
            </li>
          ))}
        </ul>

        {/* 세로 합류선 */}
        <span
          aria-hidden
          className="absolute right-11 w-px bg-brand-soft"
          style={{ top: half, bottom: half }}
        />

        {/* 합류점 — 여기서 하나가 된다. 이 페이지에서 이 점은 Chapter마다 하나뿐이다 */}
        <span
          aria-hidden
          className="absolute right-11 -mr-[4px] h-[9px] w-[9px] rounded-full border-2 border-brand bg-canvas"
          style={{ top: '50%', marginTop: -4.5 }}
        />

        {/* 합류점에서 아래로 — 도착지를 향해 내려가는 선 */}
        {destination ? (
          <>
            {/* 합류점 → 하강선까지 이어지는 가로 구간. 오른쪽 끝을 하강선(right-4)에
                맞춰야 선이 끊기지 않는다(right-11 - right-4 = 28px) */}
            <span
              aria-hidden
              className="absolute right-4 h-px w-7 bg-brand-soft"
              style={{ top: '50%' }}
            />
            <span
              aria-hidden
              className="absolute right-4 bottom-0 w-px bg-brand-soft"
              style={{ top: '50%' }}
            />
          </>
        ) : null}
      </div>

      {destination ? (
        <>
          <div className="h-px bg-brand-edge" aria-hidden />
          <p className="flex items-baseline gap-1.5 text-[12.5px] keep-all leading-relaxed">
            <span aria-hidden className="flex-none text-brand-pressed">
              ↳
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-brand-ink">{destination}</span>
              <span className="text-brand-pressed">에서 만났어</span>
            </span>
          </p>
        </>
      ) : null}
    </section>
  );
}
