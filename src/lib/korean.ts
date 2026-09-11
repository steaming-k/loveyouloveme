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

/**
 * **조사만** 돌려준다 (v1.46 PremiumLens)
 *
 * `withXParticle()`은 `단어 + 조사`를 붙여 주는데, 인용부호가 끼면 쓸 수 없다 —
 * `'혼자 정리하는 시간'은`처럼 조사가 닫는 따옴표 **뒤에** 와야 하는 자리에서
 * `withTopicParticle("'혼자 정리하는 시간'")`은 마지막 글자를 `'`로 보고
 * 받침 없음으로 판정한다(실측: `'혼자 정리하는 시간'는`).
 *
 * 그래서 받침 판정의 기준이 되는 낱말과, 조사가 붙는 위치가 다를 때 쓴다.
 */
export function topicParticleOf(word: string): string {
  return josa(word, '은', '는');
}

export function subjectParticleOf(word: string): string {
  return josa(word, '이', '가');
}

/**
 * 공동격 조사 과/와 (v1.46 PremiumLens)
 *
 * 오행 라벨(`목·화·토·금·수`)과 별자리 원소 라벨(`불·흙·공기·물`)에 받침 없는 것이
 * 섞여 있다. 하드코딩하면 `화과 금이`·`공기과 물이`가 된다 — 브라우저 실측에서
 * 같은 계열의 오류(`계획과 유연함 사이은`)를 실제로 확인하고 추가했다.
 */
export function withCompanionParticle(word: string): string {
  return word + josa(word, '과', '와');
}

/**
 * 부사격 조사 으로/로 (v1.46 PremiumLens)
 *
 * ⚠️ **다른 조사와 규칙이 하나 다르다.** 받침이 `ㄹ`이면 `으로`가 아니라 `로`다
 * (`물로`이지 `물으로`가 아니다). 그래서 `josa()`를 그대로 쓸 수 없고 예외를
 * 먼저 본다 — 별자리 원소에 `불`과 `물`이 둘 다 있어서 이 예외가 실제로 걸린다.
 */
export function withInstrumentParticle(word: string): string {
  const lastChar = word.trim().at(-1);
  if (lastChar) {
    const code = lastChar.charCodeAt(0);
    const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
    // 종성 인덱스 8 = ㄹ
    if (isHangulSyllable && (code - 0xac00) % 28 === 8) return `${word}로`;
  }
  return word + josa(word, '으로', '로');
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
