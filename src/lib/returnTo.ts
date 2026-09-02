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

function isProfileRevisitReturn(searchParams: URLSearchParams | null | undefined): boolean {
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
