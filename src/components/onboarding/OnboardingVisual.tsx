import { Lovy } from '@/components/lovy/Lovy';
import type { LovyPose } from '@/data/lovy';

/**
 * 온보딩 시각 요소 (v1.46 · §20~§23 리뉴얼)
 *
 * ══ 캐릭터 매핑 — 왜 이 네 장인가 (§22) ═══════════════════════════════════
 *
 * ```
 * ① Hook      observe   돋보기 — 관찰이 시작되는 장면
 * ② Evidence  connect   흩어진 자료를 모으는 모습 — 이 장이 설명하는 행동 그 자체
 * ③ Mirror    ponder    아직 결론을 내리지 않고 생각하는 모습
 * ④ History   book      기록 노트를 펼쳐 든 모습
 * ```
 *
 * ⚠️ **새 이미지를 만들지 않았다.** 네 포즈 전부 이미 `public/lovy/`에 있고,
 * `docs/캐릭터`에서 추가로 복사한 파일도 없다(§22).
 *
 * ⚠️ **`crystal`(관측 구슬)을 걷어냈다.** v1.45까지 마지막 장이 구슬 안에 커플이
 * 들어 있는 그림이었는데, 그건 관찰자가 아니라 **점쟁이의 도구**로 읽힌다 —
 * `docs/design-guide.md §2`가 "러비는 관찰자다. 상담가·점쟁이·전문가로 보이게 쓰지
 * 않는다"고 적어둔 바로 그 선이고, 온보딩 마지막 장은 그 인상이 가장 오래 남는
 * 자리다. 같은 이유로 새 온보딩 어디에도 `crystal`·`wand`를 쓰지 않는다.
 *
 * ⚠️ **캐릭터가 시각 위계를 이기지 않는다**(v1.45 §26과 같은 규칙). 제목이 먼저
 * 읽히고, 캐릭터는 본문 옆 96px 고정이다.
 *
 * ⚠️ **1장 캐릭터만 `priority`다**(§38 Performance). v1.45까지 온보딩 캐릭터는 3장
 * 하나뿐이었고 그건 fold 아래였는데, 이제 1장 상단에 96px 이미지가 생겨 **LCP 요소가
 * 바뀌었다**(브라우저 실측: `observe.png`가 LCP로 잡히고 Next가 경고했다). 2~4장까지
 * preload하면 첫 화면에서 쓰지도 않을 이미지 3장을 함께 내려받으므로, 위에 있는 한 장만
 * 붙인다.
 */

/** 각 장의 캐릭터. 크기를 한 곳에서 고정한다 — 장마다 다르면 넘길 때 크기가 튄다 */
const SLIDE_LOVY_SIZE = 96;

/**
 * §23 — 캐릭터는 본문보다 **살짝 늦게** 들어온다.
 *
 * ⚠️ 지연을 크게 두지 않는다. 120ms는 '본문 다음에 캐릭터'라는 순서를 만들되
 * 사용자가 기다린다고 느끼지 않는 범위다. 이 값이 200ms를 넘으면 넘기는 손이
 * 캐릭터보다 빨라져서 **빈 자리가 먼저 보인다.**
 */
export function SlideLovy({ pose, priority = false }: { pose: LovyPose; priority?: boolean }) {
  return (
    <span
      className="reveal-up flex-none [animation-delay:120ms]"
      style={{ width: SLIDE_LOVY_SIZE }}
    >
      <Lovy pose={pose} size={SLIDE_LOVY_SIZE} decorative priority={priority} />
    </span>
  );
}

/** 온보딩 ① — 나와 상대의 신호를 항목별로 비교한다는 것을 그림으로 먼저 보여준다 */
const SIGNAL_ROWS = [
  { mine: 64, theirs: 58, diverges: false },
  { mine: 40, theirs: 76, diverges: false },
  { mine: 72, theirs: 34, diverges: true },
  { mine: 52, theirs: 50, diverges: false },
] as const;

export function SignalPreview() {
  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface px-[18px] py-5">
      <div className="flex justify-between text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
        <span>나</span>
        <span>SIGNAL</span>
        <span>그 사람</span>
      </div>

      <div className="flex flex-col gap-[11px]" aria-hidden>
        {SIGNAL_ROWS.map((row, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <span className="h-2 rounded-full bg-brand" style={{ width: row.mine }} />
            <span
              className={
                row.diverges
                  ? 'h-px flex-1 border-t border-dashed border-friction'
                  : 'h-px flex-1 bg-line'
              }
            />
            <span className="h-2 rounded-full bg-brand-soft" style={{ width: row.theirs }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 온보딩 ② — 러비가 **무엇을 근거로 보는지** 세 줄로 보여준다 (v1.46 §21 Page 2).
 *
 * ⚠️ 이 목록은 실제 Evidence 계층과 **같은 이름**이다(`내가 답한 내용` ·
 * `관계 경험` · `내가 알려준 장면`). 온보딩에서 부르는 이름과 리포트 근거 칩에
 * 보이는 이름이 다르면, 사용자는 나중에 같은 것을 두 번 배워야 한다.
 *
 * ⚠️ **AI·사진 관찰을 여기 넣지 않았다.** 둘 다 실제 근거 source이지만 선택
 * 입력이라 모든 사용자에게 해당하지 않고, 온보딩에서 약속한 것이 화면에 없는
 * 상태가 가장 나쁘다. 여기 있는 셋은 누구에게나 있다.
 */
const EVIDENCE_ROWS = [
  { label: '내가 답한 내용', text: '"연락은 별로 중요하지 않아."' },
  { label: '관계 경험', text: '"연락이 줄어드는 게 가장 힘들었어."' },
  { label: '내가 알려준 장면', text: '"답장 간격이 하루 정도 길어졌어."' },
] as const;

export function EvidencePreview() {
  return (
    <ul className="flex flex-col gap-2">
      {EVIDENCE_ROWS.map((row) => (
        <li
          key={row.label}
          className="flex flex-col gap-1 rounded-row border border-line bg-surface px-[15px] py-3"
        >
          <span className="text-[10.5px] font-semibold tracking-[0.05em] text-mint-ink">
            {row.label}
          </span>
          <span className="text-[13px] keep-all leading-snug">{row.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** 온보딩 ③ — Declared Me vs Relationship Me 의 어긋남 */
export function GapPreview({
  gap,
}: {
  gap: {
    declaredLabel: string;
    declaredText: string;
    relationshipLabel: string;
    relationshipText: string;
  };
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[16px] border border-dashed border-dash bg-surface px-[18px] py-4">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
          {gap.declaredLabel}
        </p>
        <p className="text-body keep-all">{gap.declaredText}</p>
      </div>

      <div className="flex items-center gap-2 pl-[18px]">
        <span className="h-4 w-px bg-friction" aria-hidden />
        <span className="text-[11px] font-semibold text-friction-text">GAP</span>
      </div>

      <div className="rounded-[16px] border border-brand bg-brand-tint px-[18px] py-4">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-brand-pressed">
          {gap.relationshipLabel}
        </p>
        <p className="text-body keep-all">{gap.relationshipText}</p>
      </div>
    </div>
  );
}

/**
 * 온보딩 ④ — 두 기록 사이의 **변화** (v1.46 §21 Page 4).
 *
 * ⚠️ 날짜를 실제처럼 보이게 쓰지 않는다(`6월` · `지금`). 온보딩 그림에 그럴듯한
 * 날짜가 박히면 사용자가 자기 기록이 이미 있다고 오해할 수 있다.
 *
 * ⚠️ **성장 서사를 만들지 않는다.** `좋아졌어`가 아니라 `달라진 지점`이다 —
 * History Task의 안전 규칙(`scanHistoryNarrative`)이 금지하는 것을 온보딩이
 * 미리 약속해버리면 안 된다.
 */
const HISTORY_ROWS = [
  { when: '처음 관찰', value: '연락 · 별로 중요하지 않음', tone: 'past' as const },
  { when: '지금', value: '연락 · 꽤 중요하게 답함', tone: 'now' as const },
] as const;

export function HistoryPreview() {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface px-[18px] py-4">
      {HISTORY_ROWS.map((row, index) => (
        <div key={row.when} className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="w-[52px] flex-none text-[10.5px] font-semibold tracking-[0.04em] text-ink-muted">
              {row.when}
            </span>
            <span
              className={
                row.tone === 'now'
                  ? 'text-[13px] font-semibold keep-all text-ink'
                  : 'text-[13px] keep-all text-ink-sub'
              }
            >
              {row.value}
            </span>
          </div>
          {index === 0 ? (
            <span className="ml-[26px] h-3 w-px bg-line-strong" aria-hidden />
          ) : null}
        </div>
      ))}
      <p className="border-t border-line-soft pt-2.5 text-[11px] text-ink-faint">
        달라진 지점만 짚어줄게. 좋아졌다·나빠졌다고는 말하지 않아.
      </p>
    </div>
  );
}
