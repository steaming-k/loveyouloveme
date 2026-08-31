/**
 * 한글 받침 유무에 따라 조사를 고른다. 데이터(PAST_FACTOR_LABEL 등)에 '취미', '대화', '배려'처럼
 * 받침 없는 단어가 섞여 있어서, 목적격 조사를 '을'로 하드코딩하면 "취미 공유을" 같은 오류가 난다.
 */
export function withObjectParticle(word: string): string {
  return word + josa(word, '을', '를');
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
