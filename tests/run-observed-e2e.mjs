/**
 * Observed Me 사진 파이프라인 E2E (v1.10)
 *
 * `/api/ai/observed-profile`을 **실제 라우트 그대로** 호출해서
 * 사진 1장씩 Provider 호출 → 민감 라벨 제거 → 규칙 집계 → 신호/상태까지 확인한다.
 *
 * 사용법:
 *   1) .env.local 에 AI_MODE=mock (또는 real + AI_API_KEY)
 *   2) npm run dev
 *   3) node tests/run-observed-e2e.mjs
 *
 * ⚠️ AI_MODE=mock이면 이건 **배선 검증**이지 실제 Vision 검증이 아니다.
 *    mock provider는 사진을 보지 않고 photoId 해시로 고정 관찰을 돌려준다.
 *    실제 사진 검증은 AI_MODE=real + 실제 Key로 같은 스크립트를 돌려야 한다.
 */

const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

/** 1x1 JPEG — 라우트의 MIME·크기 검증을 통과하는 최소 이미지 */
const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/9oACAEBAAA/AKrAf//Z';

const failures = [];
let passed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
    return;
  }
  failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function analyze(photoIds) {
  const response = await fetch(`${BASE_URL}/api/ai/observed-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-lym-session': `e2e-${Date.now()}` },
    body: JSON.stringify({
      // 사진이 0장이어도 fingerprint는 비면 안 된다 — 빈 값은 '잘못된 요청'으로 먼저 걸린다.
      inputFingerprint: photoIds.join('|') || 'empty',
      images: photoIds.map((imageId) => ({ imageId, dataUrl: TINY_JPEG })),
    }),
  });
  return response.json();
}

/* 5장 — mock provider가 photoId 해시로 세 가지 관찰 세트에 나눠 배정한다.
   그래서 반복 신호와 단일 신호가 함께 나오는 상태를 만들 수 있다. */
const PHOTO_IDS = ['up-1', 'up-2', 'up-3', 'up-4', 'up-5', 'up-6'];

console.log(`Observed E2E — ${BASE_URL}\n`);

const result = await analyze(PHOTO_IDS);

check('요청이 성공했다', result.ok === true, JSON.stringify(result).slice(0, 200));

if (result.ok) {
  const data = result.data;
  console.log(`\n  mode=${data.meta.mode} promptVersion=${data.meta.promptVersion} state=${data.observedState}`);
  console.log(`  usable=${data.evidenceCoverage.usableImageCount}/${data.evidenceCoverage.imageCount}\n`);

  for (const trait of data.traits) {
    console.log(
      `  [${trait.signal?.strength ?? '-'}] ${trait.label} · ${trait.observation}\n` +
        `        근거: ${trait.evidence.map((e) => `${e.imageId}(${e.description})`).join(' / ')}`,
    );
  }
  console.log('');

  check('promptVersion이 v1.10 사진 프롬프트다', data.meta.promptVersion === 'observed-v2-photo',
    data.meta.promptVersion);
  check('mode가 demo가 아니다 (Provider 경로를 실제로 탔다)',
    data.meta.mode === 'real' || data.meta.mode === 'mock', data.meta.mode);
  check('observedState가 채워졌다', typeof data.observedState === 'string', String(data.observedState));
  check('관찰이 1개 이상 나왔다', data.traits.length > 0, `실제 ${data.traits.length}`);

  const withSignal = data.traits.filter((trait) => trait.signal);
  check('모든 trait에 집계 신호가 붙어 있다 (§17 provenance)',
    withSignal.length === data.traits.length, `${withSignal.length}/${data.traits.length}`);

  check('모든 신호가 실제로 보낸 photoId만 참조한다',
    data.traits.every((t) => t.signal.photoIds.every((id) => PHOTO_IDS.includes(id))));

  check('occurrenceCount가 photoIds 수를 넘지 않는다 (§5 과대계산 금지)',
    data.traits.every((t) => t.signal.occurrenceCount <= t.signal.photoIds.length));

  check('strength가 occurrenceCount와 일치한다',
    data.traits.every((t) => {
      const n = t.signal.occurrenceCount;
      const expected = n >= 3 ? 'strong_repeated' : n === 2 ? 'repeated' : 'single';
      return t.signal.strength === expected;
    }));

  check('confidence가 반복 강도와 일치한다',
    data.traits.every((t) => {
      const map = { strong_repeated: 'high', repeated: 'medium', single: 'low' };
      return t.confidence === map[t.signal.strength];
    }));

  check('반복 신호가 있으면 state가 repeated_found다',
    data.traits.some((t) => t.signal.strength !== 'single')
      ? data.observedState === 'repeated_found'
      : data.observedState !== 'repeated_found', data.observedState);

  const allText = JSON.stringify(data);
  check("'규칙 기반 데모' 문구가 노출되지 않는다 (§25)", !allText.includes('규칙 기반 데모'));
  check("'실제 사진 내용을 분석하지 않았어' 문구가 노출되지 않는다 (§25)",
    !allText.includes('실제 사진 내용을 분석하지 않았어'));
  check("'생활 패턴' 표현이 결과에 없다 (§6)", !allText.includes('생활 패턴'));

  if (data.meta.mode === 'mock') {
    check('mock 모드는 mock임을 한계로 밝힌다 (§21)',
      data.limitations.some((item) => item.includes('mock')), data.limitations.join(' | '));
  }
}

/* 사진 0장 — '반복 없음'이 아니라 '쓸 이미지 없음'으로 분류돼야 한다(§8) */
const empty = await analyze([]);
check('사진 0장은 NO_USABLE_IMAGE로 분류된다',
  empty.ok === false && empty.reason === 'NO_USABLE_IMAGE', JSON.stringify(empty));

console.log(`\n통과 ${passed}건`);
if (failures.length > 0) {
  console.error(`\n실패 ${failures.length}건:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('ALL PASS');
