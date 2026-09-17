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
import {
  applyMigrationLinks,
  cloudIdsForUser,
  forgetUser,
  linkOf,
  readCloudLinks,
  recoverCloudLink,
  saveActiveRelationshipWith,
  writeCloudLinks,
} from '@/lib/persistence/cloudLinks';
import { persistDeepReportSnapshot as persistSnapshotWith } from '@/lib/persistence/deepReportSnapshot';
import { hydrateSavedRelationship } from '@/lib/persistence/savedRelationships';
import { hasMeaningfulSelfProfile, migrateLocalData, type MigrationReport } from '@/lib/persistence/localMigration';
import { createProfileRepository } from '@/lib/persistence/profileRepository';
import { createRelationshipTargetRepository } from '@/lib/persistence/relationshipTargetRepository';
import { createSupabaseGateway } from '@/lib/persistence/supabaseGateway';
import { ensureTargetRegistry, hasTargetContext, readTargetRegistry } from '@/lib/persistence/targetRegistry';
import { getBrowserSupabase } from '@/lib/supabase/client';
import type { SavedRelationshipSummary } from '@/lib/persistence/types';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { AiMode, AiNarrativeStatus, DeepNarrativeBundle, RelationshipDeepReport } from '@/types';

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
 * 조용히 올리지 않는다  로그인만으로는 업로드하지 않는다. saveDeviceData() · saveActiveRelationship()은
 *                 사용자가 동의 버튼을 눌렀을 때만 부른다
 * 로컬을 지우지 않는다  로그아웃 · 저장 · 클라우드 삭제 어느 것도 기기 데이터를 바꾸지 않는다
 * 보내지 않는다   이 Provider는 analytics 이벤트를 만들지 않는다(이메일 · 본문 · 별칭 포함)
 * ```
 *
 * v1.47 Integration — 저장한 관계의 렌더된 Deep Report는 `persistDeepReportSnapshot`으로 남긴다
 * (조건은 `lib/persistence/deepReportSnapshot.ts`). link를 잃어버린 기기는 로그인 뒤 **읽기만** 해서
 * 같은 관계를 다시 잇는다(`recoverCloudLink`).
 */

export type AccountStatus = 'disabled' | 'loading' | 'signed_out' | 'signed_in';

export type AccountOutcome =
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'invalid_email' | 'invalid_code' | 'rate_limited' | 'failed' };

export interface DeepReportSnapshotInput {
  rendered: boolean;
  status: AiNarrativeStatus;
  mode: AiMode | null;
  bundle: DeepNarrativeBundle | null;
  report: RelationshipDeepReport | null;
}

interface AccountContextValue {
  status: AccountStatus;
  email: string | null;
  /** 이 기기에 계정으로 옮길 만한 입력이 있는가 */
  hasDeviceData: boolean;
  /** 로그인한 사용자가 지금 보고 있는 관계를 저장했는가 */
  activeRelationshipSaved: boolean;
  /** 지금 상대가 이 사용자의 어떤 cloud 관계인가(저장했을 때만) */
  activeCloudTargetId: string | null;
  /** 저장한 관계 요약. null = 아직 읽지 않음 */
  savedRelationships: SavedRelationshipSummary[] | null;
  savedRelationshipsStatus: 'idle' | 'loading' | 'ready' | 'failed';
  migrationRunning: boolean;
  migrationReport: MigrationReport | null;
  sendCode: (email: string) => Promise<AccountOutcome>;
  verifyCode: (email: string, code: string) => Promise<AccountOutcome>;
  signOut: () => Promise<void>;
  saveDeviceData: () => Promise<MigrationReport | null>;
  saveActiveRelationship: () => Promise<AccountOutcome>;
  persistDeepReportSnapshot: (input: DeepReportSnapshotInput) => Promise<void>;
  refreshSavedRelationships: () => Promise<void>;
  openSavedRelationship: (cloudTargetId: string) => Promise<AccountOutcome>;
  deleteCloudData: () => Promise<AccountOutcome>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AccountProvider({ children }: { children: ReactNode }) {
  const { answers, hydrated, applySavedRelationship } = useSession();
  const { entries } = useHistory();
  const [status, setStatus] = useState<AccountStatus>(isSupabaseConfigured() ? 'loading' : 'disabled');
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [activeRelationshipSaved, setActiveRelationshipSaved] = useState(false);
  const [linksVersion, setLinksVersion] = useState(0);
  const [activeCloudTargetId, setActiveCloudTargetId] = useState<string | null>(null);
  const [savedRelationships, setSavedRelationships] = useState<SavedRelationshipSummary[] | null>(null);
  const [savedRelationshipsStatus, setSavedRelationshipsStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const userIdRef = useRef<string | null>(null);
  /** 상대가 바뀌면(새로운 사람 · 전환) 이 값이 바뀐다 — 저장 여부를 다시 본다 */
  const activeAnalysisKey = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;

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

  /* 이 사용자 · 지금 상대의 저장 여부. link가 없으면 읽기만 해서 복구를 시도한다(업로드 없음) */
  useEffect(() => {
    if (status !== 'signed_in' || !hydrated || !user) {
      setActiveRelationshipSaved(false);
      setActiveCloudTargetId(null);
      return;
    }
    let active = true;
    const localTargetId = ensureTargetRegistry().activeTargetId;
    const links = readCloudLinks();
    const existing = linkOf(links, user.id, localTargetId);
    if (existing) {
      setActiveRelationshipSaved(true);
      setActiveCloudTargetId(existing.cloudTargetId);
      return;
    }
    setActiveRelationshipSaved(false);
    setActiveCloudTargetId(null);
    const client = getBrowserSupabase();
    if (!client) return;
    void recoverCloudLink({
      gateway: createSupabaseGateway(client),
      userId: user.id,
      localTargetId,
      links,
      now: new Date().toISOString(),
    }).then((result) => {
      if (!active || !result.recovered) return;
      writeCloudLinks(result.links);
      setActiveRelationshipSaved(true);
      setActiveCloudTargetId(result.link?.cloudTargetId ?? null);
    });
    return () => {
      active = false;
    };
  }, [status, hydrated, user, linksVersion, activeAnalysisKey]);

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
    const userId = userIdRef.current;
    if (!client || !hydrated || !userId) return null;
    setMigrationRunning(true);
    try {
      const report = await migrateLocalData({
        gateway: createSupabaseGateway(client),
        snapshot: { answers, history: entries, registry: ensureTargetRegistry() },
        consent: true,
        /* local/cloud id 분리 — 이 사용자가 이미 저장한 관계만 같은 cloud id로 잇는다(다른 계정 link는 보지 않는다) */
        existingCloudIds: cloudIdsForUser(readCloudLinks(), userId),
        expectedUserId: userId,
      });
      /* 동의해서 계정에 들어간 상대마다 link — 이후 그 관계의 분석은 다시 묻지 않고 남길 수 있다 */
      writeCloudLinks(applyMigrationLinks(readCloudLinks(), userId, report.links, new Date().toISOString()));
      setLinksVersion((version) => version + 1);
      setMigrationReport(report);
      return report;
    } finally {
      setMigrationRunning(false);
    }
  }, [answers, entries, hydrated]);

  /** ⚠️ '이 관계 저장하기' 동의 버튼에서만 부른다 — 나 최소값 · 지금 상대 · 사건 · link */
  const saveActiveRelationship = useCallback(async (): Promise<AccountOutcome> => {
    const client = getBrowserSupabase();
    const userId = userIdRef.current;
    if (!client) return { ok: false, reason: 'disabled' };
    if (!hydrated || !userId) return { ok: false, reason: 'failed' };
    const result = await saveActiveRelationshipWith({
      gateway: createSupabaseGateway(client),
      userId,
      answers,
      registry: ensureTargetRegistry(),
      links: readCloudLinks(),
      now: new Date().toISOString(),
    });
    if (!result.saved) return { ok: false, reason: 'failed' };
    writeCloudLinks(result.links);
    setLinksVersion((version) => version + 1);
    return { ok: true };
  }, [answers, hydrated]);

  /** 렌더된 Deep Report — 저장 조건은 lib 한 곳에서 판정한다. Guest는 요청 0 */
  const persistDeepReportSnapshot = useCallback(
    async (input: DeepReportSnapshotInput): Promise<void> => {
      if (!hydrated) return;
      const client = getBrowserSupabase();
      await persistSnapshotWith({
        ...input,
        gateway: client ? createSupabaseGateway(client) : null,
        userId: client ? userIdRef.current : null,
        links: readCloudLinks(),
        localTargetId: ensureTargetRegistry().activeTargetId,
        events: answers.target.events,
      });
    },
    [answers.target.events, hydrated],
  );

  /** 저장한 관계 목록 — 읽기만 한다(로그인만으로 쓰기 0) */
  const refreshSavedRelationships = useCallback(async (): Promise<void> => {
    const client = getBrowserSupabase();
    if (!client || !userIdRef.current) {
      setSavedRelationships(null);
      setSavedRelationshipsStatus('idle');
      return;
    }
    setSavedRelationshipsStatus('loading');
    const listed = await createRelationshipTargetRepository(createSupabaseGateway(client)).listSummaries();
    if (!listed.ok) {
      setSavedRelationshipsStatus('failed');
      return;
    }
    setSavedRelationships(listed.value);
    setSavedRelationshipsStatus('ready');
  }, []);

  useEffect(() => {
    if (status !== 'signed_in' || !user) {
      setSavedRelationships(null);
      setSavedRelationshipsStatus('idle');
      return;
    }
    void refreshSavedRelationships();
  }, [status, user, linksVersion, refreshSavedRelationships]);

  /** 저장한 관계 열기 — 목록 클릭에서만 부른다. 지금 상대는 기기 목록에 보관된다 */
  const openSavedRelationship = useCallback(
    async (cloudTargetId: string): Promise<AccountOutcome> => {
      const client = getBrowserSupabase();
      const userId = userIdRef.current;
      if (!client) return { ok: false, reason: 'disabled' };
      if (!hydrated || !userId) return { ok: false, reason: 'failed' };
      const result = await hydrateSavedRelationship({
        gateway: createSupabaseGateway(client),
        userId,
        cloudTargetId,
        answers,
        registry: ensureTargetRegistry(),
        links: readCloudLinks(),
        now: new Date().toISOString(),
        newAnalysisId: crypto.randomUUID(),
      });
      if (!result.ok) return { ok: false, reason: 'failed' };
      writeCloudLinks(result.links);
      if (!result.alreadyActive) applySavedRelationship({ answers: result.answers, registry: result.registry });
      setLinksVersion((version) => version + 1);
      return { ok: true };
    },
    [answers, hydrated, applySavedRelationship],
  );

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
    /* 이 사용자의 link만 지운다 — 같은 기기의 다른 계정 link는 그대로 */
    const userId = userIdRef.current;
    if (userId) writeCloudLinks(forgetUser(readCloudLinks(), userId));
    setLinksVersion((version) => version + 1);
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
      activeRelationshipSaved,
      activeCloudTargetId,
      savedRelationships,
      savedRelationshipsStatus,
      migrationRunning,
      migrationReport,
      sendCode,
      verifyCode,
      signOut,
      saveDeviceData,
      saveActiveRelationship,
      persistDeepReportSnapshot,
      refreshSavedRelationships,
      openSavedRelationship,
      deleteCloudData,
    }),
    [
      status,
      user,
      hasDeviceData,
      activeRelationshipSaved,
      activeCloudTargetId,
      savedRelationships,
      savedRelationshipsStatus,
      migrationRunning,
      migrationReport,
      sendCode,
      verifyCode,
      signOut,
      saveDeviceData,
      saveActiveRelationship,
      persistDeepReportSnapshot,
      refreshSavedRelationships,
      openSavedRelationship,
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
