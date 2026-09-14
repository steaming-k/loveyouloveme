/**
 * UT 참가자 초기화 범위 (v1.47 UT-2 Stability)
 *
 * 다음 참가자에게 이전 참가자의 상태가 **하나도** 보이지 않게, 이 브라우저의 럽유럽미 저장값을 비운다.
 *
 * ```
 * 지운다   lym.* 전부 — 세션 · 기록 · 상대 목록 · 사건 · Premium unlock/의향/복귀 · UT 응답 · AI 캐시 ·
 *          스크롤/펼침 · 동의 · analytics 큐 · 방문 경로
 * 남긴다   lym.ut-mode.v1     UT 탭 기억 — 다음 참가자도 UT다
 *          lym.cloudLinks.v1  Supabase 연결 목록(로컬 링크일 뿐) — 실제 저장 데이터는 이 도구가 건드리지 않는다
 *          lym.* 가 아닌 키   Supabase auth(sb-*) 등 — 지우지 않는다
 * ```
 *
 * ⚠️ Supabase에 실제로 저장된 데이터는 삭제하지 않는다(서버 호출 없음).
 */
export const UT_RESET_KEEP_KEYS: readonly string[] = ['lym.ut-mode.v1', 'lym.cloudLinks.v1'];

/** 순수 판정 — fixture가 값으로 고정한다 */
export function participantKeysToClear(keys: readonly string[]): string[] {
  return keys.filter((key) => key.startsWith('lym.') && !UT_RESET_KEEP_KEYS.includes(key));
}

function keysOf(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}

/** 브라우저 저장값을 비운다. 지운 키 개수를 돌려준다(키 이름은 화면에 출력하지 않아도 된다) */
export function clearParticipantStorage(): { local: number; session: number } {
  if (typeof window === 'undefined') return { local: 0, session: 0 };
  const result = { local: 0, session: 0 };
  for (const [name, storage] of [
    ['local', window.localStorage],
    ['session', window.sessionStorage],
  ] as const) {
    try {
      for (const key of participantKeysToClear(keysOf(storage))) {
        storage.removeItem(key);
        result[name] += 1;
      }
    } catch {
      // 저장소 접근이 막힌 브라우저 — 지울 것도 없다
    }
  }
  return result;
}
