import type { RelationshipJob, RelationshipStage, RelationshipStatus } from '@/types';

/**
 * Relationship Job별 문구 (v1.40 · §37.6)
 *
 * ⚠️ **여기 있는 것은 전부 framing이다.** 판정·근거·점수는 한 글자도 만들지 않는다.
 * 같은 GAP을 두고 "무엇을 확인할까"와 "어떻게 조율할까" 중 어느 쪽으로 말할지만
 * 고른다. 사실이 아니라 사실의 사용법이 바뀐다.
 *
 * ⚠️ **러비는 Job마다 성격이 바뀌지 않는다.** 같은 관찰자다. `ended`에서 조금 덜
 * 장난스러워지는 정도이고, 상담사·치료사 화법으로 갈아타지 않는다(§37.14).
 *
 * ⚠️ **없는 데이터를 말하지 않는다.** `long_term`에 가사·재정·양육·주거가 한 글자도
 * 없는 것은 실수가 아니다 — 이 제품은 그 데이터를 받지 않는다(§37.3).
 */

export interface StageJobCopy {
  /** 이 Job에서 사용자가 지금 하려는 일. 개발·문서용 한 문장 */
  readonly job: string;
  /** 동기화율 아래 한 줄 — 점수를 무엇으로 쓰라는 안내 */
  readonly scoreUse: string;
  /** LEVEL 3 섹션 제목 */
  readonly nowWhatTitle: string;
  /** LEVEL 3 섹션 캡션 */
  readonly nowWhatCaption: string;
  /** 04-a 서브블록 라벨 */
  readonly actionLabel: string;
  /** 04-b 서브블록 라벨 */
  readonly questionLabel: string;
  /** 확인이 필요한 신호를 이 Job에서 무엇으로 쓰는가 (한 단어급) */
  readonly frictionVerb: string;
  /** Mirror 결과에서 이 관찰을 어디에 쓰는가 */
  readonly mirrorUse: string;
}

/**
 * `frictionVerb`가 Job별로 다른 것이 이 버전의 핵심이다.
 *
 * ```
 * unknown    확인       아직 모르니 물어본다
 * talking    확인       진전 전에 서로의 기대를 맞춰본다
 * dating     조율       이미 아는 차이를 어떻게 다룰지
 * long_term  조율       반복되는 장면에서 대화 방식을 만든다
 * ended      회고       주어가 나로 바뀐다
 * none       관찰       상대가 없으니 내 기준을 본다
 * ```
 */
export const STAGE_JOB_COPY: Record<RelationshipJob, StageJobCopy> = {
  none: {
    job: '내 관계 기준을 이해한다',
    scoreUse: '지금은 비교할 상대가 없으니, 네 기준부터 정리해뒀어.',
    nowWhatTitle: '그래서 뭘 알아둘까',
    nowWhatCaption: '네가 답한 기준을 기준으로 정리했어. 상대에 대한 추측은 넣지 않았어.',
    actionLabel: '알아두면 좋은 것',
    questionLabel: '나에게 물어볼 질문',
    frictionVerb: '관찰',
    mirrorUse: '앞으로 관계에서 확인할 기준',
  },
  unknown: {
    job: '상대를 알아가기 전에 내 기준을 확인한다',
    scoreUse: '아직 아는 게 적어서 이 숫자는 참고용이야. 지금은 알아가는 게 먼저야.',
    nowWhatTitle: '그래서 뭘 물어볼까',
    nowWhatCaption: '네가 알려준 것만 기준으로 했어. 모르는 건 모른다고 두고 질문으로 만들었어.',
    actionLabel: '알아둘 것',
    questionLabel: '알아가며 물어볼 질문',
    frictionVerb: '확인',
    mirrorUse: '이 사람을 알아갈 때 확인할 기준',
  },
  talking: {
    job: '관계가 더 진전되기 전에 기대 차이를 확인한다',
    scoreUse: '이 숫자는 결론이 아니야. 지금 확인해두면 좋은 게 어디인지 보는 데 써.',
    nowWhatTitle: '그래서 뭘 확인해볼까',
    nowWhatCaption: '네가 알려준 이 사람의 취향과 관계 방식을 기준으로 생각해봤어.',
    actionLabel: '이 사람에게 다가갈 때',
    questionLabel: '이야기해볼 질문',
    frictionVerb: '확인',
    mirrorUse: '이 관계가 더 깊어지기 전에 확인할 기준',
  },
  dating: {
    job: '이미 아는 기대 차이를 조율한다',
    scoreUse: '이 숫자보다, 지금 실제로 어디에서 기대가 다른지 보는 게 더 쓸모 있어.',
    nowWhatTitle: '그래서 뭘 맞춰볼까',
    nowWhatCaption: '네가 알려준 이 사람의 관계 방식을 기준으로, 지금 조율해볼 지점을 봤어.',
    actionLabel: '지금 관계에서 맞춰볼 것',
    questionLabel: '같이 이야기해볼 질문',
    frictionVerb: '조율',
    mirrorUse: '지금 이 관계에서 조율할 기준',
  },
  long_term: {
    job: '반복되는 기대 차이를 다루는 방식을 만든다',
    scoreUse: '오래 함께한 관계에서 이 숫자는 요약일 뿐이야. 반복되는 지점을 보는 데 써.',
    nowWhatTitle: '그래서 반복되는 지점을 어떻게 다룰까',
    nowWhatCaption: '네가 알려준 관계 방식을 기준으로, 자주 반복될 수 있는 지점을 봤어.',
    actionLabel: '반복될 때 맞춰볼 것',
    questionLabel: '한 번쯤 같이 이야기해볼 질문',
    frictionVerb: '조율',
    mirrorUse: '이 관계에서 반복되는 기준',
  },
  ended: {
    job: '관계를 한 번 정리하고 내 기준을 남긴다',
    scoreUse: '이 숫자는 관계가 왜 끝났는지 설명하지 않아. 당시 어떤 기대가 달랐는지 보는 참고값이야.',
    nowWhatTitle: '그래서 뭐가 남았을까',
    // ⚠️ 한계를 말하는 문장이지만 `상대의 마음`이라는 표현 자체를 쓰지 않는다 — Ended Safety
    // fixture가 그 어휘를 통째로 금지하고, 문구 하나를 위해 그 금지선을 느슨하게 만들지 않는다.
    // 뜻은 그대로 남는다.
    nowWhatCaption: '이 관계에서 네가 답한 기준을 정리했어. 왜 그렇게 됐는지는 여기서 알 수 없어.',
    actionLabel: '돌아볼 것',
    questionLabel: '나에게 물어볼 질문',
    frictionVerb: '회고',
    mirrorUse: '이 관계가 내 기준에 남긴 것',
  },
};

/**
 * `ended`·`none`에서 상대에게 물어볼 질문 대신 내주는 **회고 질문**.
 *
 * ⚠️ 주어가 전부 **나**다. 상대에게 연락하게 만드는 문장은 하나도 없다.
 * ⚠️ 원인을 캐거나 후회를 유도하지 않는다. `왜 헤어졌을까` · `무엇을 잘못했을까`처럼
 *    답이 나올 수 없는 질문은 만들지 않는다 — 그건 회고가 아니라 반추다(§37.13).
 * ⚠️ 개수를 3개로 묶었다. 회고는 **한 번 정리하고 닫는** 것이고, 더 파헤치라는
 *    연쇄 CTA를 두지 않는다.
 */
export const REFLECTION_QUESTIONS: Record<'ended' | 'none', readonly string[]> = {
  ended: [
    '그 관계에서 생각보다 중요하게 느꼈던 건 뭐였지?',
    '내가 말한 기준과 실제로 힘들었던 지점이 달랐던 곳이 있었나?',
    '다음에는 어떤 신호를 조금 더 일찍 확인해보고 싶어?',
  ],
  none: [
    '지금 내가 관계에서 가장 중요하게 보는 건 뭐지?',
    '전에는 괜찮았는데 지금은 다르게 느껴지는 기준이 있나?',
    '누군가를 알아갈 때 어떤 걸 먼저 확인하고 싶어?',
  ],
};

/**
 * S05 관계 상태 선택지의 설명 한 줄 (v1.40).
 *
 * v1.39까지 `dating`·`married`·`ended`에는 `준비 중`이 붙어 있었다. 그 상태에 맞는
 * 리포트가 없었기 때문이고, **없는 것을 있다고 말하지 않는다**는 원칙을 지킨 표시였다.
 * v1.40에서 세 상태에 실제 Job이 생겼으므로 라벨을 무엇을 받는지로 바꾼다.
 */
export const STATUS_DESCRIPTION: Record<RelationshipStatus, string> = {
  solo_none: '내 기준부터 관찰해볼게',
  solo_exp: '지난 경험에서 내 기준을 찾아볼게',
  crush: '그 사람과 뭐가 같고 다른지 볼게',
  dating: '지금 관계에서 맞춰볼 지점을 볼게',
  married: '반복되는 지점을 어떻게 다룰지 볼게',
  ended: '이 관계가 남긴 기준을 정리해볼게',
};

/** 문서·프로토타입 패널용 단계 라벨 (사용자 화면에는 내부 enum을 노출하지 않는다) */
export const STAGE_DEBUG_LABEL: Record<RelationshipStage, string> = {
  none: '상대 없음',
  talking: '알아가는 중',
  dating: '연애 중',
  long_term: '오래 함께',
  ended: '관계 종료',
};
