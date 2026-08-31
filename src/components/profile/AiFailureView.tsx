import { Lovy } from '@/components/lovy/Lovy';
import type { AiFailureReason } from '@/types';

/**
 * AI 실패 화면 (§34)
 *
 * ⚠️ 기술 오류코드(`ERR_OBSERVE_TIMEOUT`, HTTP 502 등)를 사용자에게 그대로 보여주지 않는다.
 * 러비의 말로 '무엇이 안 됐는지'만 전한다. 그리고 **없는 결과를 있는 척하지 않는다.**
 */

const MESSAGE: Record<AiFailureReason, { title: string; body: string }> = {
  NETWORK_ERROR: {
    title: '사진을 읽다가 통신이 끊겼어.',
    body: '연결을 확인하고 다시 시도해줄래? 고른 사진은 그대로 있어.',
  },
  TIMEOUT: {
    title: '관찰이 생각보다 오래 걸리네.',
    body: '지금은 응답이 늦는 것 같아. 잠시 뒤에 다시 시도해보자.',
  },
  INVALID_OUTPUT: {
    title: '관찰 결과를 제대로 읽지 못했어.',
    body: '이상한 형태로 돌아와서 그대로 보여주지 않을게. 다시 시도해볼까?',
  },
  POLICY_BLOCK: {
    title: '이 사진들로는 분석을 진행할 수 없었어.',
    body: '다른 사진으로 바꿔서 다시 시도해볼 수 있어.',
  },
  NO_USABLE_IMAGE: {
    title: '분석에 쓸 수 있는 사진이 없었어.',
    body: '샘플 타일 말고 실제 사진을 올려주면 관찰해볼 수 있어.',
  },
  RATE_LIMIT: {
    title: '요청이 조금 몰렸어.',
    body: '잠시 뒤에 다시 시도해줄래?',
  },
  SERVER_ERROR: {
    title: '관측 장비에 문제가 생겼어.',
    body: '잠깐 다시 확인해볼게. 입력한 내용은 그대로 있어.',
  },
  CONFIG_ERROR: {
    title: '아직 분석 연결이 준비되지 않았어.',
    body: '지금은 사진 관찰을 건너뛰고 질문으로 계속할 수 있어.',
  },
};

export function AiFailureView({
  reason,
  retryCount = 0,
}: {
  reason: AiFailureReason;
  retryCount?: number;
}) {
  const copy = MESSAGE[reason];

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-3.5 pb-10 text-center"
      role="alert"
    >
      <Lovy pose="laptop" size={130} decorative />
      <h2 className="text-section keep-all">{copy.title}</h2>
      <p className="text-sub keep-all leading-relaxed text-ink-sub">{copy.body}</p>

      {retryCount >= 2 ? (
        <p className="text-meta keep-all leading-relaxed text-ink-faint">
          계속 안 되면 사진 관찰은 건너뛰고 질문으로 이어가도 괜찮아. 관찰 기록은 질문만으로도
          만들 수 있어.
        </p>
      ) : null}
    </div>
  );
}
