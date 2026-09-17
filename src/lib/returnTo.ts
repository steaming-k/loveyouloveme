/**
 * Edit Return Context (v1.11 §26/§27/§30)
 *
 * Profile Revisit(`/profile/result?view=revisit`)에서 '수정'을 누르면 기존 입력 Route
 * (Observed/Declared/Past)로 보낸다 — **새 입력 UI를 만들지 않는다.** 대신 그 Route가
 * 수정을 마쳤을 때 원래 Funnel 다음 단계로 계속 밀고 가지 않고 Profile Revisit으로
 * 돌아오게 하기 위해, `from` 쿼리 파라미터 하나만 화면 사이로 들고 다닌다.
 *
 * ⚠️ 이 파일이 하는 일은 '다음 이동 목적지 계산'뿐이다. 질문 화면 UI는 건드리지 않는다.
 */

export const RETURN_TO_PARAM = 'from';
export const PROFILE_REVISIT_RETURN = 'profile-revisit';

/**
 * 렌즈·Premium 리포트에서 입력 화면으로 **잠깐 다녀오는** 경우 (v1.48.3)
 *
 * ══ 왜 필요했나 ═══════════════════════════════════════════════════════════
 *
 * `다른 렌즈` 화면의 `MBTI Lens · 정보 입력하기`는 전용 입력 화면이 없어서 퍼널
 * 스텝(`/profile/declared/4`)을 그대로 빌려 쓴다. 그런데 그 화면은 자기가 퍼널의
 * 마지막 스텝이라 제출하면 다음 퍼널(`/profile/past/1`)로 밀고 나간다 — 렌즈를
 * 보려던 사용자가 **과거 관계 질문 리스트로 튕겨 나갔다.**
 *
 * 사주·별자리는 전용 화면(`/lens/birth`)이 있고 그 화면이 Contextual Back으로
 * 들어온 곳에 돌려보내기 때문에 같은 문제가 없었다. MBTI만 빌려 쓰는 구조였다.
 *
 * ══ 왜 목적지를 여기 적지 않나 ════════════════════════════════════════════
 *
 * `profile-revisit`처럼 돌아갈 주소를 이 파일에 하나 더 박아두지 않는다. 이 입구는
 * `다른 렌즈` 말고도 Premium 리포트 카드 · MBTI 렌즈 본문 등 여러 곳이고, v1.46.3이
 * 같은 상황에서 내린 결론이 **'앱 안에서 왔으면 직전 화면으로 돌아간다'**였다
 * (`hooks/useContextualBack.ts`). 그래서 이 값은 목적지가 아니라 **'퍼널을 계속
 * 진행하지 말라'는 표시**이고, 실제 복귀는 Contextual Back이 맡는다.
 */
export const LENS_RETURN = 'lens';

export function isLensReturn(searchParams: URLSearchParams | null | undefined): boolean {
  return searchParams?.get(RETURN_TO_PARAM) === LENS_RETURN;
}

/** 입력 화면으로 보낼 때 붙인다. 목적지 Route는 호출부가 그대로 고른다 */
export function withLensReturn(href: string): string {
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}${RETURN_TO_PARAM}=${LENS_RETURN}`;
}

export function isProfileRevisitReturn(searchParams: URLSearchParams | null | undefined): boolean {
  return searchParams?.get(RETURN_TO_PARAM) === PROFILE_REVISIT_RETURN;
}

/**
 * 여러 단계로 이어지는 Funnel(Declared 1→2→3→4, Past 1→2→3)에서 중간 스텝으로 이동할 때
 * `from`을 잃어버리지 않도록 그대로 붙여 돌려준다. `from`이 없으면 원래 href 그대로.
 */
export function withReturnTo(href: string, searchParams: URLSearchParams | null | undefined): string {
  if (!isProfileRevisitReturn(searchParams)) return href;
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}${RETURN_TO_PARAM}=${PROFILE_REVISIT_RETURN}`;
}

/**
 * Funnel 세그먼트의 **마지막** 스텝이 완료됐을 때 쓴다.
 * `from=profile-revisit`이면 원래 다음 Funnel 화면 대신 Profile Revisit으로 돌려보낸다.
 */
export function resolveReturnDestination(
  searchParams: URLSearchParams | null | undefined,
  defaultNext: string,
): string {
  if (!isProfileRevisitReturn(searchParams)) return defaultNext;
  return '/profile/result?view=revisit';
}
