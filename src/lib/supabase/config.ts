/**
 * v1.47 — Supabase 연결 설정 (브라우저에 노출돼도 되는 값만)
 *
 * ⚠️ **service_role key를 읽지 않는다.** 이 앱의 모든 DB 접근은 사용자 세션 + RLS로만 한다.
 * ⚠️ 값이 없으면 `null`이다 — 그 상태가 **Guest local-first의 정상 상태**이고, 어떤 화면도
 *    이 값 때문에 막히지 않는다.
 *
 * `NEXT_PUBLIC_*`는 빌드 시점에 인라인되므로 `process.env[name]` 같은 동적 접근을 쓰지 않는다.
 */

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

export function supabaseConfigFrom(url: string | undefined, anonKey: string | undefined): SupabasePublicConfig | null {
  const trimmedUrl = url?.trim() ?? '';
  const trimmedKey = anonKey?.trim() ?? '';
  if (!trimmedUrl || !trimmedKey) return null;
  try {
    const parsed = new URL(trimmedUrl);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return null;
    }
  } catch {
    return null;
  }
  /* service_role/secret 키가 실수로 들어오면 연결하지 않는다 — 브라우저 번들에 실린다 */
  if (/^sb_secret_/.test(trimmedKey) || /service_role/.test(decodeJwtRole(trimmedKey) ?? '')) return null;
  return { url: trimmedUrl.replace(/\/+$/, ''), anonKey: trimmedKey };
}

function decodeJwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown };
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

export function supabaseConfig(): SupabasePublicConfig | null {
  return supabaseConfigFrom(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}
