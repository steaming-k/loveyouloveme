/**
 * v1.47 — **stable id** (migration 멱등성의 근거)
 *
 * 로컬 사건 id는 `evt-<time36>-<rand36>`이고 UUID가 아니다. 로컬 모양을 바꾸지 않고,
 * 클라우드 id를 `(targetId, localEventId)`에서 **결정론적으로** 만든다(RFC 4122 v5 · SHA-1).
 * 그래서 새로고침 · 재로그인 · 재시도에도 같은 행을 가리키고, 중복 행이 생기지 않는다.
 *
 * ⚠️ 이미 UUID인 로컬 id(클라우드에서 불러온 사건)는 **그대로** 쓴다 — 다시 해시하면
 *    불러온 사건을 다시 저장할 때 새 행이 생긴다.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 고정 namespace — 값을 바꾸면 기존 계정의 멱등성이 깨진다 */
export const ID_NAMESPACE = {
  event: '6f1d2c3b-4a59-4e87-9c10-2b3a4d5e6f70',
  analysisRun: '0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d',
  /** v1.47 Clean Base — (userId, localTargetId) → cloudTargetId */
  target: '3c2b1a09-8f7e-4d6c-b5a4-9382716a5b4c',
} as const;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function newUuid(): string {
  return crypto.randomUUID();
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function deterministicUuid(namespace: string, name: string): Promise<string> {
  const ns = uuidToBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(ns.length + nameBytes.length);
  input.set(ns, 0);
  input.set(nameBytes, ns.length);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', input));
  const bytes = hash.slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

export async function cloudEventIdOf(targetId: string, localEventId: string): Promise<string> {
  if (isUuid(localEventId)) return localEventId.toLowerCase();
  return deterministicUuid(ID_NAMESPACE.event, `${targetId.toLowerCase()}:${localEventId}`);
}

/**
 * History 스냅샷 id — **사용자 id가 섞인다**(v1.47 Clean Base). 같은 기기의 History를 두 계정이 각각
 * 저장해도 PK가 겹치지 않는다. 같은 사용자의 재시도는 같은 id(멱등).
 */
export async function analysisRunIdOfHistoryEntry(userId: string, entryId: string): Promise<string> {
  return deterministicUuid(ID_NAMESPACE.analysisRun, `history:${userId.toLowerCase()}:${entryId}`);
}

/**
 * (userId, localTargetId) → cloudTargetId (v1.47 Clean Base §12)
 *
 * 로컬 상대 id는 이 기기의 슬롯 이름이다. 그대로 cloud PK로 쓰면 같은 기기의 두 계정이 같은 행을 두고
 * 부딪친다. 사용자 id를 섞어 **계정마다 다른** 결정론 UUID를 만든다 — 같은 사용자의 재시도 · 재로그인은
 * 같은 id(멱등), 다른 사용자는 다른 id다.
 */
export async function cloudTargetIdOf(userId: string, localTargetId: string): Promise<string> {
  return deterministicUuid(ID_NAMESPACE.target, `${userId.toLowerCase()}:${localTargetId.toLowerCase()}`);
}

/**
 * analysis_runs.idempotency_key = sha256(userId | targetId | analysisType | sourceFingerprint | generationRequestId)
 *
 * ⚠️ 해시만 저장한다 — 요청 id · 지문 원문은 행에 남지 않는다.
 */
export async function analysisIdempotencyKeyOf(parts: {
  userId: string;
  targetId: string | null;
  analysisType: string;
  sourceFingerprint: string | null;
  generationRequestId: string;
}): Promise<string> {
  const joined = [
    parts.userId.toLowerCase(),
    parts.targetId ?? '-',
    parts.analysisType,
    parts.sourceFingerprint ?? '-',
    parts.generationRequestId,
  ].join('|');
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined)));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
