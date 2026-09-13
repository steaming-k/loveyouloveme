'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createAnalysisRunRepository } from '@/lib/persistence/analysisRunRepository';
import { hasMeaningfulSelfProfile, migrateLocalData, type MigrationReport } from '@/lib/persistence/localMigration';
import { createProfileRepository } from '@/lib/persistence/profileRepository';
import { createRelationshipTargetRepository } from '@/lib/persistence/relationshipTargetRepository';
import { createSupabaseGateway } from '@/lib/persistence/supabaseGateway';
import { ensureTargetRegistry, hasTargetContext, readTargetRegistry } from '@/lib/persistence/targetRegistry';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

import { useHistory } from './HistoryProvider';
import { useSession } from './SessionProvider';

/**
 * v1.47 — 계정(선택) 상태
 *
 * ══ 절대 규칙 ═══════════════════════════════════════════════════════════════
 *
 * ```
 * 막지 않는다     children을 항상 즉시 렌더한다. 로그인·네트워크를 기다리는 화면은 없다
 * 비활성이 기본   Supabase 설정이 없으면 status='disabled'이고 아무 요청도 보내지 않는다
 * 조용히 올리지 않는다  로그인만으로는 업로드하지 않는다. saveDeviceData()는 사용자가
 *                 '계정에 저장하기'를 눌렀을 때만 부른다
 * 로컬을 지우지 않는다  로그아웃 · 저장 · 클라우드 삭제 어느 것도 기기 데이터를 바꾸지 않는다
 * 보내지 않는다   이 Provider는 analytics 이벤트를 만들지 않는다(이메일 · 본문 · 별칭 포함)
 * ```
 */

export type AccountStatus = 'disabled' | 'loading' | 'signed_out' | 'signed_in';

export type AccountOutcome =
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'invalid_email' | 'invalid_code' | 'rate_limited' | 'failed' };

interface AccountContextValue {
  status: AccountStatus;
  email: string | null;
  /** 이 기기에 계정으로 옮길 만한 입력이 있는가 */
  hasDeviceData: boolean;
  migrationRunning: boolean;
  migrationReport: MigrationReport | null;
  sendCode: (email: string) => Promise<AccountOutcome>;
  verifyCode: (email: string, code: string) => Promise<AccountOutcome>;
  signOut: () => Promise<void>;
  saveDeviceData: () => Promise<MigrationReport | null>;
  deleteCloudData: () => Promise<AccountOutcome>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AccountProvider({ children }: { children: ReactNode }) {
  const { answers, hydrated } = useSession();
  const { entries } = useHistory();
  const [status, setStatus] = useState<AccountStatus>(isSupabaseConfigured() ? 'loading' : 'disabled');
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const client = getBrowserSupabase();
    if (!client) return;
    let active = true;

    const apply = (next: { id: string; email?: string | null } | null | undefined) => {
      if (!active) return;
      const id = next?.id ?? null;
      if (userIdRef.current !== id) setMigrationReport(null);
      userIdRef.current = id;
      setUser(next ? { id: next.id, email: next.email ?? null } : null);
      setStatus(next ? 'signed_in' : 'signed_out');
    };

    client.auth
      .getSession()
      .then(({ data }) => apply(data.session?.user))
      .catch(() => apply(null));
    const { data } = client.auth.onAuthStateChange((_event, session) => apply(session?.user));

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const sendCode = useCallback(async (email: string): Promise<AccountOutcome> => {
    const client = getBrowserSupabase();
    if (!client) return { ok: false, reason: 'disabled' };
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) return { ok: false, reason: 'invalid_email' };
    try {
      const { error } = await client.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) return { ok: false, reason: error.status === 429 ? 'rate_limited' : 'failed' };
      return { ok: true };
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }, []);

  const verifyCode = useCallback(async (email: string, code: string): Promise<AccountOutcome> => {
    const client = getBrowserSupabase();
    if (!client) return { ok: false, reason: 'disabled' };
    const token = code.replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(token)) return { ok: false, reason: 'invalid_code' };
    try {
      const { error } = await client.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
      if (error) return { ok: false, reason: error.status === 429 ? 'rate_limited' : 'invalid_code' };
      return { ok: true };
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    const client = getBrowserSupabase();
    if (!client) return;
    try {
      await client.auth.signOut();
    } finally {
      setMigrationReport(null);
    }
  }, []);

  /** ⚠️ 사용자가 '계정에 저장하기'를 눌렀을 때만 부른다 — consent:true의 근거가 그 클릭이다 */
  const saveDeviceData = useCallback(async (): Promise<MigrationReport | null> => {
    const client = getBrowserSupabase();
    if (!client || !hydrated) return null;
    setMigrationRunning(true);
    try {
      const report = await migrateLocalData({
        gateway: createSupabaseGateway(client),
        snapshot: { answers, history: entries, registry: ensureTargetRegistry() },
        consent: true,
      });
      setMigrationReport(report);
      return report;
    } finally {
      setMigrationRunning(false);
    }
  }, [answers, entries, hydrated]);

  /** 계정에 저장한 것만 지운다. 이 기기의 데이터는 그대로다 */
  const deleteCloudData = useCallback(async (): Promise<AccountOutcome> => {
    const client = getBrowserSupabase();
    if (!client) return { ok: false, reason: 'disabled' };
    const gateway = createSupabaseGateway(client);
    const runs = createAnalysisRunRepository(gateway);
    const targets = createRelationshipTargetRepository(gateway);

    const runList = await runs.list();
    if (!runList.ok) return { ok: false, reason: 'failed' };
    for (const run of runList.value) {
      const removed = await runs.remove(run.id);
      if (!removed.ok) return { ok: false, reason: 'failed' };
    }
    const targetList = await targets.list({ includeArchived: true });
    if (!targetList.ok) return { ok: false, reason: 'failed' };
    for (const target of targetList.value) {
      /* 사건은 FK CASCADE로 함께 지워진다 */
      const removed = await targets.remove(target.id);
      if (!removed.ok) return { ok: false, reason: 'failed' };
    }
    const profile = await createProfileRepository(gateway).remove();
    if (!profile.ok) return { ok: false, reason: 'failed' };
    setMigrationReport(null);
    return { ok: true };
  }, []);

  const hasDeviceData =
    hydrated &&
    (hasMeaningfulSelfProfile(answers) ||
      hasTargetContext(answers) ||
      entries.length > 0 ||
      (status === 'signed_in' && (readTargetRegistry()?.saved.length ?? 0) > 0));

  const value = useMemo<AccountContextValue>(
    () => ({
      status,
      email: user?.email ?? null,
      hasDeviceData,
      migrationRunning,
      migrationReport,
      sendCode,
      verifyCode,
      signOut,
      saveDeviceData,
      deleteCloudData,
    }),
    [
      status,
      user,
      hasDeviceData,
      migrationRunning,
      migrationReport,
      sendCode,
      verifyCode,
      signOut,
      saveDeviceData,
      deleteCloudData,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccount must be used inside <AccountProvider>');
  return context;
}
