'use client';

import { useRouter } from 'next/navigation';

import { LovySequence } from '@/components/lovy/LovySequence';
import { BRAND } from '@/data/copy';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * Splash (S01) — **editorial cover + brand poster + 관찰의 시작** (v1.48)
 *
 * ══ 무엇을 고쳤나 ═══════════════════════════════════════════════════════════
 *
 * 예전 구조는 화면 정중앙의 세로 stack 하나였다:
 *
 * ```
 *          LOVE RESEARCH : EARTH
 *                 [러비]
 *                 럽유럽미
 *           ● 인간의 사랑을 관찰 중
 * ```
 *
 * 이 배치는 **캐릭터 앱의 기본형**이다 — 캐릭터를 가운데 놓고 이름을 밑에 붙이는 구조는
 * 브랜드가 아니라 마스코트를 소개한다. 스크린샷 한 장만 보면 '귀여운 캐릭터 앱'이고,
 * 그건 §2가 금지한 바로 그것이다(캐릭터가 서비스를 지배해서는 안 된다).
 *
 * ══ 지금 구조 ═══════════════════════════════════════════════════════════════
 *
 * ```
 * ──────────── LOVE RESEARCH : EARTH        ← 상단 편집 marker + rule
 *
 *                       ╭─ 러비 ─╮          ← 오른쪽으로 비대칭
 *                       │        │          ← 왼쪽은 비워 둔다
 *                       ╰────────╯
 *   럽유럽미                                  ← 좌측 정렬 · 화면에서 가장 강한 타이포
 *   ───
 *   인간의 사랑을 관찰 중
 * ```
 *
 * 좌측 정렬 · 비대칭 · 상단 marker · 하단 서명. 표지의 문법이다. 러비는 여전히 크게
 * 있지만 **주인공 자리가 아니라 관찰 대상 옆자리**에 있고, 화면의 focal point는
 * 서비스명이 가져간다.
 *
 * ⚠️ **움직이는 것은 `LovySequence` 하나뿐이다**(§20 — 의미 있는 motion만).
 * ⚠️ **화면 전체 tap은 그대로다.** 라우팅 조건(`completed.profile`)도 그대로다.
 * ⚠️ 우주·별·행성을 그리지 않는다. 이 화면에 남은 선은 상단 marker rule과 하단 서명
 * rule 둘뿐이고, 둘 다 **편집면을 여닫는 선**이지 장식이 아니다.
 */
export default function SplashPage() {
  const router = useRouter();
  const { answers, hydrated } = useSession();

  // 이미 관찰 기록이 있는 사용자는 홈으로 보낸다.
  const destination = hydrated && answers.completed.profile ? ROUTES.home : ROUTES.onboarding;

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={() => router.push(destination)}
        aria-label="관찰 시작하기"
        className="flex flex-1 flex-col px-gutter pt-[58px] pb-[10px] text-left"
      >
        {/* ── 상단 편집 marker ─────────────────────────────────────────────
            rule이 왼쪽 여백에서 시작해 라벨로 이어진다. 라벨을 가운데 띄우지
            않는 것만으로 '표지'와 '캐릭터 소개'가 갈린다. */}
        <span className="flex items-center gap-2.5">
          <span className="h-px w-7 flex-none bg-rule-ink" aria-hidden />
          <span className="text-[10px] font-semibold tracking-[0.26em] text-ink-muted">
            {BRAND.splashLabel}
          </span>
        </span>

        {/* 장면 + 서명을 한 덩어리로 묶어 남은 높이 안에서 시각 중앙에 둔다 —
            상단 marker와 하단 서명 줄은 표지의 위/아래 끝에 고정된다. */}
        <span className="flex flex-1 flex-col justify-center">
          {/* ── 관찰 장면 ──────────────────────────────────────────────────
              러비를 오른쪽으로 민다. 비대칭 자체가 '표지'를 만들고, 왼쪽의 빈 자리가
              여백이 된다 — 그 자리를 채우려고 선이나 점을 두지 않는다.

              ⚠️ 예전에는 왼쪽에 `관찰 마크 + 연결선 + 점`이 있었다. 마크를 빼자
              선과 점만 남았고, 그건 '관찰의 자국'이 아니라 **지우다 만 흔적**으로
              읽혔다. 요소를 줄일 때는 남은 것이 혼자서도 뜻을 갖는지 본다. */}
          <span className="flex items-center justify-end pr-1">
            <LovySequence size={178} priority />
          </span>

          {/* ── 브랜드 서명 ────────────────────────────────────────────────
              화면에서 가장 큰 활자. 예전 30px에서 올렸고, 아래에 짧은 rule을
              붙여 이름이 '제목'으로 읽히게 한다. */}
          <span className="mt-[46px] flex flex-col gap-3">
            <span className="text-[40px] leading-[1.1] font-bold tracking-[-1.6px] text-ink">
              {BRAND.name}
            </span>
            <span className="h-[2px] w-9 bg-brand" aria-hidden />
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-lovy-pulse rounded-full bg-brand" aria-hidden />
              <span className="text-sub text-ink-sub">{BRAND.splashCopy}</span>
            </span>
          </span>
        </span>
      </button>

      {/* 하단 서명 줄 — 표지의 밑단. rule 하나로 화면을 닫는다 */}
      <div className="flex-none px-gutter pb-[30px]">
        <div className="field-rule mb-3" />
        <p className="text-meta text-ink-faint">화면을 탭하면 관찰이 시작돼</p>
      </div>
    </div>
  );
}
