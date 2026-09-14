/**
 * v1.47 Integration — **logical generationRequestId** (한 번의 분석 행위)
 *
 * ```
 * 분석이 시작될 때      begin(key) → 새 UUID
 * 실패 뒤 retry         begin(key) → 같은 UUID (아직 닫히지 않았다)
 * 결과가 확정됨         close(key)
 * 다시 분석             begin(key) → 새 UUID
 * ```
 *
 * ⚠️ HTTP 요청 id가 아니다. 서버 requestId는 요청마다 달라서 retry가 중복 analysis_run이 된다 —
 *    서버 requestId는 로그 대조(observability)에만 쓴다.
 * ⚠️ key는 입력 지문이다. 입력이 바뀌면 다른 분석이다.
 * ⚠️ 모듈 스코프(탭 단위)다. 새로고침하면 캐시도 비므로 그때의 요청은 새 생성이고, 새 id가 맞다.
 */

export interface LogicalRunRegistry {
  begin(key: string): string;
  close(key: string): void;
  peek(key: string): string | null;
}

export function createLogicalRunRegistry(newId: () => string = () => crypto.randomUUID()): LogicalRunRegistry {
  const open = new Map<string, string>();
  return {
    begin(key) {
      const existing = open.get(key);
      if (existing) return existing;
      const id = newId();
      open.set(key, id);
      return id;
    },
    close(key) {
      open.delete(key);
    },
    peek(key) {
      return open.get(key) ?? null;
    },
  };
}

/** Deep Report 생성 — 이 탭의 logical run */
export const deepReportRuns = createLogicalRunRegistry();
