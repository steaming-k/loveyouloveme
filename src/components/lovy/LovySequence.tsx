'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import {
  LOVY_ASSETS,
  LOVY_HOME_SEQUENCE,
  lovyRenderSize,
  type LovySequenceFrame,
} from '@/data/lovy';
import { cn } from '@/lib/cn';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * 러비 관찰 시퀀스 — 첫 화면이 살아 있게 만드는 유일한 loop (v1.46 · §15~§19 · §28)
 *
 * ══ 왜 GIF/Lottie가 아니라 PNG crossfade인가 ═══════════════════════════════
 *
 * ```
 * GIF      재생을 멈출 수 없다(hidden tab에서도 디코딩이 돈다) · reduced-motion 대응 불가
 *          · 색이 뭉개진다 · 파일이 크다
 * Lottie   런타임 라이브러리가 늘어난다 · 캐릭터를 다시 그려야 한다(새 에셋 금지)
 * PNG      이미 있는 에셋 그대로 · next/image가 크기별로 내려보낸다 · 언제든 멈출 수 있다
 * ```
 *
 * §15가 "단순 GIF보다 기존 러비 PNG 여러 장을 자연스럽게 전환하는 방식을 우선 검토"
 * 하라고 한 이유가 마지막 줄이다 — **멈출 수 있어야 예외 상황을 지킬 수 있다.**
 *
 * ══ §28 Infinite Motion 금지의 **유일한 예외**가 여기다 ══════════════════
 *
 * 그래서 예외를 예외로 만드는 조건을 전부 코드로 세운다:
 *
 * ```
 * prefers-reduced-motion   타이머를 아예 시작하지 않는다 → 정적 러비 1장
 * document 숨김            타이머를 멈춘다 → 보이지 않는 탭에서 돌지 않는다
 * 프레임 1장뿐             타이머를 만들지 않는다
 * ```
 *
 * ⚠️ **CLS 0.** 박스 크기는 네 프레임의 렌더 크기 중 최대값으로 **고정**이고, 프레임은
 * 전부 그 안에 `absolute`로 겹쳐 있다. 바뀌는 것은 `opacity`·`transform`뿐이라
 * 레이아웃이 한 번도 다시 계산되지 않는다.
 *
 * ⚠️ **hydration mismatch 0.** 서버 렌더와 첫 클라이언트 렌더가 모두 `index = 0`이다.
 * `prefersReducedMotion()`은 **effect 안에서만** 호출한다(그 함수 주석의 규칙).
 *
 * ⚠️ **스크린리더에게는 정지 화면이다.** 이미지 네 장이 번갈아 읽히면 소음이므로
 * 프레임 이미지는 전부 `alt=""`이고, 대신 첫 프레임의 설명 한 줄만 시각적으로 숨긴
 * 텍스트로 둔다. 움직임은 정보가 아니라 분위기다.
 */
export function LovySequence({
  frames = LOVY_HOME_SEQUENCE,
  size,
  className,
  priority = false,
}: {
  frames?: readonly LovySequenceFrame[];
  /** `Lovy`의 `size`와 같은 의미 — 포즈별 보정 배율이 곱해진다 */
  size: number;
  className?: string;
  /** 첫 프레임만 `priority`가 된다 — 나머지는 lazy다 */
  priority?: boolean;
}) {
  const [index, setIndex] = useState(0);
  /**
   * 모션이 실제로 돌고 있는가. **초기값은 항상 false**다 — SSR과 첫 렌더가 같아야 하고,
   * effect가 `prefers-reduced-motion`을 확인한 뒤에만 true가 된다.
   */
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (frames.length < 2) return;
    if (prefersReducedMotion()) return;
    setRunning(true);

    let timer: number | null = null;

    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    /**
     * §19 — 상태가 바뀌는 주기. 각 프레임이 화면에 머무는 시간이고, crossfade
     * (`--motion-slow` 400ms)는 이 안에서 일어난다.
     *
     * ⚠️ 빠르게 만들지 않는다. 3.2초는 '살아 있다'와 '산만하다' 사이에서 앞쪽이고,
     * 첫 화면은 사용자가 탭하기까지 몇 초를 머무는 자리다 — 그 사이에 루프가 두 바퀴
     * 돌면 그건 배경이 아니라 광고다.
     */
    const schedule = () => {
      clear();
      timer = window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % frames.length);
        schedule();
      }, 3200);
    };

    /**
     * §19 — 탭이 가려지면 멈춘다.
     *
     * ⚠️ 프레임을 되감지 않는다. 돌아왔을 때 보던 장면에서 이어지는 것이 맞고,
     * 처음으로 튀면 그게 오히려 '뭔가 다시 시작했다'는 신호가 된다.
     */
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clear();
      else schedule();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clear();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [frames]);

  /**
   * 고정 박스. **네 프레임 전부를 계산해서 최대값을 쓴다.**
   *
   * ⚠️ v1.46 PremiumLens에서 첫 프레임이 `hero`(509×558)에서 `chart`(291×298)로
   * 바뀌면서 캔버스는 전부 정방형이 됐지만, **이 계산은 그대로 필요하다** —
   * `LOVY_VISUAL_SCALE`이 포즈마다 달라서 렌더 크기가 여전히 같지 않다
   * (실측: chart 221×226 · notice 202×202 · observe 208×213 · record 208×213).
   * 한 프레임만 재면 다른 프레임에서 이미지가 박스를 넘거나 남는다.
   */
  const sizes = frames.map((frame) => lovyRenderSize(frame.pose, size));
  const boxWidth = Math.max(...sizes.map((item) => item.width));
  const boxHeight = Math.max(...sizes.map((item) => item.height));

  const current = frames[index] ?? frames[0]!;

  return (
    <div
      className={cn('relative flex-none', className)}
      style={{ width: boxWidth, height: boxHeight }}
    >
      {frames.map((frame, frameIndex) => {
        const asset = LOVY_ASSETS[frame.pose];
        const { width, height } = sizes[frameIndex]!;
        const active = frameIndex === index;

        return (
          <Image
            key={frame.pose}
            src={asset.src}
            alt=""
            aria-hidden
            width={width}
            height={height}
            priority={priority && frameIndex === 0}
            /*
              §17 — opacity crossfade + 아주 작은 scale·translateY.

              ⚠️ 숫자를 키우지 않는다. `scale(0.98)` · `translateY(3px)`는 "장면이
              바뀌었다"를 느끼게 하는 최소치이고, 이보다 크면 캐릭터가 튀어 오르는
              것처럼 보인다(§17 — 갑자기 튀거나 크게 확대되지 않는다).

              ⚠️ 두 프레임이 동시에 반투명한 구간이 생기지 않도록 **들어오는 쪽에만**
              `--motion-slow`를 주고 나가는 쪽은 같은 시간에 사라진다 — 겹치는 동안
              러비가 두 겹으로 보이지 않게 하려면 중앙 정렬이 정확해야 하고, 그래서
              모든 프레임이 같은 박스의 정중앙에 놓인다.
            */
            className="absolute left-1/2 top-1/2 object-contain"
            style={{
              width,
              height,
              transform: active
                ? 'translate(-50%, -50%) scale(1)'
                : 'translate(-50%, calc(-50% + 3px)) scale(0.98)',
              opacity: active ? 1 : 0,
              transition:
                'opacity var(--motion-slow) var(--ease-observe), transform var(--motion-slow) var(--ease-observe)',
            }}
          />
        );
      })}

      {/*
        §18 발견 blink — 작대기 3개.

        ⚠️ **발견 프레임이 화면에 있을 때만 mount된다.** 그래서 CSS animation이
        `2회`로 끝나고, 다음 바퀴에 요소가 다시 mount되면 다시 2회 재생된다 —
        재생 횟수를 JS로 셀 필요가 없다(§28 infinite 금지).

        ⚠️ 모션이 꺼져 있으면(`running === false` — reduced-motion·프레임 1장)
        아예 렌더하지 않는다. 깜빡이지 않는 작대기 3개는 의미 없는 장식이다.
      */}
      {running && current.discovery ? (
        <span
          aria-hidden
          className="absolute left-[6%] top-[14%] flex items-end gap-[3px]"
        >
          <span className="animate-lovy-blink h-2 w-[3px] origin-bottom rounded-full bg-mint-deep" />
          <span className="animate-lovy-blink h-3 w-[3px] origin-bottom rounded-full bg-mint-deep [animation-delay:110ms]" />
          <span className="animate-lovy-blink h-2 w-[3px] origin-bottom rounded-full bg-mint-deep [animation-delay:220ms]" />
        </span>
      ) : null}

      {/* 스크린리더용 — 움직임과 무관하게 **한 줄만** 읽힌다 */}
      <span className="sr-only">{frames[0]!.caption}</span>
    </div>
  );
}
