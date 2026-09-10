/**
 * 한글 받침 유무에 따라 조사를 고른다. 데이터(PAST_FACTOR_LABEL 등)에 '취미', '대화', '배려'처럼
 * 받침 없는 단어가 섞여 있어서, 목적격 조사를 '을'로 하드코딩하면 "취미 공유을" 같은 오류가 난다.
 */
export function withObjectParticle(word: string): string {
  return word + josa(word, '을', '를');
}

/** 주제격 조사 은/는 — '취미 공유은(는)' 같은 표기를 피한다 */
export function withTopicParticle(word: string): string {
  return word + josa(word, '은', '는');
}

/** 주격 조사 이/가 — '취미 공유이(가)' 같은 표기를 피한다 */
export function withSubjectParticle(word: string): string {
  return word + josa(word, '이', '가');
}

/**
 * 서술격 조사 이야/야 (v1.45)
 *
 * Premium Chapter의 강조 문장이 축 라벨을 문장 끝에 놓는다
 * (`중요한 건 ○○야`). 하드코딩하면 받침 있는 라벨에서 `연락야`·`애정 표현야`가 된다 —
 * 실측에서 실제로 그렇게 나왔다.
 */
export function withCopula(word: string): string {
  return word + josa(word, '이야', '야');
}

function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const lastChar = word.trim().at(-1);
  if (!lastChar) return withoutBatchim;

  const code = lastChar.charCodeAt(0);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  if (!isHangulSyllable) return withoutBatchim;

  const hasBatchim = (code - 0xac00) % 28 !== 0;
  return hasBatchim ? withBatchim : withoutBatchim;
}
