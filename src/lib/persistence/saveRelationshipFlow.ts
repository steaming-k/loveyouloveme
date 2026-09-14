/**
 * v1.47 Integration — **'이 관계 저장하기' 흐름의 단계** (순수 함수 · UI는 이 값만 그린다)
 *
 * ```
 * hidden    Supabase 설정 없음 · 계정 상태 확인 중 · 아직 결과를 보지 않음 · 저장할 상대 입력 없음
 * offer     결과를 본 뒤 — "이 관계를 저장해둘까?"
 * auth      Guest가 눌렀다 — 기존 이메일 코드 · 메일 링크 로그인(인라인)
 * consent   로그인됨 — "이 기기에 입력한 정보를 이 계정에 저장할까?" (로그인만으로 업로드하지 않는다)
 * saving    저장 중
 * saved     이 사용자가 이 관계를 저장함 — "저장됨"
 * failed    저장 실패 — 이 기기 데이터는 그대로
 * ```
 */

export type SaveRelationshipStage = 'hidden' | 'offer' | 'auth' | 'consent' | 'saving' | 'saved' | 'failed';

export const SAVE_RELATIONSHIP_COPY = {
  offerTitle: '이 관계를 저장해둘까?',
  offerDetail: '다음에 다시 보고, 새로운 기록과 비교할 수 있어.',
  cta: '이 관계 저장하기',
  authLead: '저장하려면 이메일로 로그인해줘. 로그인만 해서는 아무것도 올리지 않아.',
  consentQuestion: '이 기기에 입력한 정보를 이 계정에 저장할까?',
  consentDetail: '내 답변, 이 상대 정보와 적어둔 사건, 이 관계의 분석 결과를 계정에 남겨. 사진은 올리지 않아.',
  consentConfirm: '저장하기',
  later: '나중에',
  saving: '저장하는 중',
  saved: '저장됨',
  savedDetail: '같은 계정으로 로그인하면 이 관계를 다시 볼 수 있어.',
  failed: '지금은 저장하지 못했어. 이 기기에 입력한 정보는 그대로 있어.',
  retry: '다시 시도',
} as const;

export function saveRelationshipStage(input: {
  accountStatus: 'disabled' | 'loading' | 'signed_out' | 'signed_in';
  /** 결과(첫 핵심 신호)를 이미 봤는가 — 첫 가치 전에는 제안하지 않는다 */
  hasValue: boolean;
  hasTargetContext: boolean;
  /** 로그인한 사용자가 이 관계를 이미 저장했는가 */
  linked: boolean;
  /** 사용자가 CTA를 눌렀는가 */
  intent: 'none' | 'requested';
  saving: boolean;
  failed: boolean;
}): SaveRelationshipStage {
  if (input.accountStatus === 'disabled' || input.accountStatus === 'loading') return 'hidden';
  if (!input.hasValue || !input.hasTargetContext) return 'hidden';
  if (input.accountStatus === 'signed_in' && input.linked) return 'saved';
  if (input.saving) return 'saving';
  if (input.failed) return 'failed';
  if (input.intent === 'none') return 'offer';
  return input.accountStatus === 'signed_in' ? 'consent' : 'auth';
}
