/**
 * 펼침 상태 보관소 (v1.46.2 §Navigation)
 *
 * 스크롤 위치만 되돌리면 반쪽이다. 사용자가 **별자리 렌즈를 펼쳐서 읽다가** 다른
 * 화면을 열고 돌아왔을 때 그 카드가 다시 접혀 있으면, 같은 위치라도 화면에 있는
 * 것이 달라서 "내가 보던 자리"가 아니다.
 *
 * `scrollRestore`와 같은 판단을 따른다:
 *   - sessionStorage다. 탭을 닫으면 사라지고 다른 탭·기기와 공유되지 않는다
 *   - 담는 것은 **열려 있던 항목의 id 목록**뿐이다(`mbti` · `saju` · `cross`).
 *     답변·해석 문장은 담지 않는다
 *   - 키는 호출부가 준다. 분석 id로 범위를 나눠 **새 분석은 새 키**가 된다(§7)
 */

const PREFIX = 'lym.open.v1:';

export function readOpenState(key: string): string[] {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function writeOpenState(key: string, values: readonly string[]): void {
  try {
    if (values.length === 0) window.sessionStorage.removeItem(PREFIX + key);
    else window.sessionStorage.setItem(PREFIX + key, JSON.stringify([...values]));
  } catch {
    /* 저장 실패는 기능 실패가 아니다 — 다음 복귀에서 접힌 채로 보일 뿐이다 */
  }
}
