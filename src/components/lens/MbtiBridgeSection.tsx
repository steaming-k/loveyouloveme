import { Lovy } from '@/components/lovy/Lovy';
import { MBTI_LENS_COPY } from '@/data/copy';
import type { MbtiAxisBridge, MbtiBridgeReport, MbtiBridgeState } from '@/types';

/**
 * MBTI × Relationship Signal Bridge — 화면 (v1.24 P3-1 §11 ~ §19)
 *
 * '그런데 실제 관계에서는?'을 담당하는 섹션. 이 화면의 목적은 MBTI를 더 보여주는 것이
 * 아니라, **성향 렌즈와 사용자가 직접 답한 관계 신호를 나란히 놓는 것**이다.
 *
 * 정보 위계
 *   러비의 발견(mint · 혼잣말)  →  근거(neutral · 실제 답변)  →  축별 비교(보고서)
 * 실제 관계 답변이 항상 MBTI보다 **높은 신뢰 위계**로 읽히도록, 근거와 비교 row는
 * 러비 블록이 아니라 보고서 톤(중립 · 좌측 rule · divider)으로 그린다.
 *
 * ⚠️ 여기서 계산하지 않는다. `buildMbtiBridge`가 만든 값을 그대로 표시할 뿐이고,
 * 상태 chip도 색으로 좋고 나쁨을 칠하지 않는다(같은 방향/다름은 우열이 아니다).
 */

function StateChip({ state }: { state: MbtiBridgeState }) {
  return (
    <span className="flex-none rounded-[5px] bg-chip px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
      {MBTI_LENS_COPY.bridgeState[state]}
    </span>
  );
}

/** MBTI LENS → RELATIONSHIP SIGNAL → INTERPRETATION 3개 층을 항상 같은 순서로 */
function BridgeLayer({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-faint">{label}</dt>
      <dd className="text-[12.5px] keep-all leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

function AxisBridgeRow({ bridge }: { bridge: MbtiAxisBridge }) {
  return (
    <li className="flex flex-col gap-2.5 border-t border-line-soft pt-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        {/*
          두 라벨 사이에 비교 기호를 둔다 — 붙여 쓰면 'ENERGY = 개인 시간'처럼
          같은 것을 가리키는 이름으로 읽힌다. 아래 각주가 한 번 더 못박는다.
        */}
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
            {bridge.mbtiEyebrow}
          </span>
          <span className="text-[10px] text-ink-faint" aria-hidden>
            ↔
          </span>
          <span className="text-[12px] keep-all text-ink-sub">{bridge.signalAxisLabel}</span>
        </p>
        <StateChip state={bridge.state} />
      </div>

      <dl className="flex flex-col gap-2.5">
        <BridgeLayer label={MBTI_LENS_COPY.bridgeLensLabel}>{bridge.lensLine}</BridgeLayer>

        <BridgeLayer label={MBTI_LENS_COPY.bridgeSignalLabel}>
          {bridge.signalLine}
          {/* 실제 저장된 answer label만 인용한다 — 자유서술 원문이 아니다 */}
          <span className="mt-0.5 block text-[11.5px] text-ink-muted">
            나: {bridge.signalMinePhrase} · 상대: {bridge.signalTheirsPhrase}
          </span>
        </BridgeLayer>

        <BridgeLayer label={MBTI_LENS_COPY.bridgeInterpretationLabel}>
          {bridge.interpretation}
        </BridgeLayer>
      </dl>
    </li>
  );
}

export function MbtiBridgeSection({ bridge }: { bridge: MbtiBridgeReport }) {
  /**
   * 관계 답변이 아직 비교 가능한 수준이 아니면 억지 Surprise를 만들지 않고 정직하게
   * 제한만 말한다. MBTI Lens 본문(01·02)은 위에서 이미 그대로 보여줬다.
   */
  if (!bridge.available) {
    return (
      <div className="flex flex-col gap-1.5 border-l-2 border-line-strong pl-3.5">
        <p className="text-[13.5px] font-semibold keep-all">
          {MBTI_LENS_COPY.bridgeLowDataTitle}
        </p>
        <p className="text-caption keep-all leading-relaxed text-ink-sub">
          {MBTI_LENS_COPY.bridgeLowDataBody}
        </p>
      </div>
    );
  }

  /**
   * 근거 블록을 **관찰 바로 아래에** 둔다. 예전에는 관찰 옆에 근거를 한 번 적고 아래
   * 상세 블록에서 같은 문장을 또 적어서, 실측에서 '둘 다 I / 나: 혼자 있는 시간 5/5 ·
   * 상대: 거의 안 챙김'이 두 번 나왔다. 관찰이 어느 블록에서 나왔는지(`source`)를 알고
   * 있으므로, 그 블록을 위로 올리면 중복 없이 §19(근거를 즉시 확인 가능)를 지킬 수 있다.
   */
  const patternFirst = bridge.surprise?.source === 'pattern';

  const axisBlock =
    bridge.axisBridges.length > 0 ? (
      <ul
        key="axis"
        className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4"
      >
        {bridge.axisBridges.map((item) => (
          <AxisBridgeRow key={item.mbtiAxisKey} bridge={item} />
        ))}

        <li className="border-t border-line-soft pt-3 text-[11px] keep-all leading-relaxed text-ink-muted">
          {MBTI_LENS_COPY.bridgeAxisFootnote}
        </li>
      </ul>
    ) : null;

  const patternBlock = bridge.pattern ? (
    <div key="pattern" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-meta font-semibold tracking-[0.04em] text-ink-muted">전체 그림</h3>
        <StateChip state={bridge.pattern.state} />
      </div>

      {/* 두 개수를 나란히 읽을 뿐, 합산하지 않는다 */}
      <dl className="flex flex-col gap-2 border-l-2 border-line-strong pl-3.5">
        <BridgeLayer label={MBTI_LENS_COPY.bridgeLensLabel}>
          {bridge.pattern.lensLine}
        </BridgeLayer>
        <BridgeLayer label={MBTI_LENS_COPY.bridgeSignalLabel}>
          {bridge.pattern.signalLine}
        </BridgeLayer>
        <BridgeLayer label={MBTI_LENS_COPY.bridgeInterpretationLabel}>
          {bridge.pattern.interpretation}
        </BridgeLayer>
      </dl>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {/*
        가장 눈에 띄는 지점 — 러비의 발견. 규칙이 정한 우선순위로 고른 하나뿐이고,
        비교 가능한 근거가 없으면 아예 렌더되지 않는다(없는 Surprise를 만들지 않는다).
        근거는 바로 아래 블록이 보고서 톤으로 말한다 — 실제 관계 답변이 MBTI보다 높은
        신뢰 위계로 읽혀야 하므로, 러비 블록 안에 답변을 다시 적지 않는다.
      */}
      {bridge.surprise ? (
        <aside className="flex items-start gap-2.5">
          <Lovy pose="question" size={36} decorative className="-mt-0.5" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-mint-ink">
              {MBTI_LENS_COPY.bridgeSurpriseLabel}
            </p>
            <p className="text-[14.5px] font-semibold leading-[1.5] keep-all text-ink">
              {bridge.surprise.hook}
            </p>
          </div>
        </aside>
      ) : null}

      {patternFirst ? (
        <>
          {patternBlock}
          {axisBlock}
        </>
      ) : (
        <>
          {axisBlock}
          {patternBlock}
        </>
      )}

      {/*
        비교하지 않은 축 — UNKNOWN을 실패로 숨기지 않는다. 억지로 이어 붙이는 것보다
        '이 축은 비교할 답변이 없다'가 정직하다.
      */}
      {bridge.unmappedAxes.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-faint">
            {MBTI_LENS_COPY.bridgeUnmappedTitle}
          </p>
          <p className="text-[11.5px] keep-all leading-relaxed text-ink-muted">
            {bridge.unmappedAxes.map((axis) => axis.label).join(' · ')}
          </p>
          <p className="text-[11.5px] keep-all leading-relaxed text-ink-muted">
            {MBTI_LENS_COPY.bridgeUnmappedBody}
          </p>
        </div>
      ) : null}
    </div>
  );
}
