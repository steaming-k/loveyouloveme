/**
 * Observed Me 사진 파이프라인 E2E (v1.10 · v1.17에서 fixture 교체)
 *
 * `/api/ai/observed-profile`을 **실제 라우트 그대로** 호출해서
 * 사진 1장씩 Provider 호출 → 민감 라벨 제거 → 규칙 집계 → 신호/상태까지 확인한다.
 *
 * 사용법:
 *   1) .env.local 에 AI_MODE=mock (또는 real + AI_API_KEY)
 *   2) npm run dev
 *   3) node tests/run-observed-e2e.mjs
 *
 * ⚠️ **mock과 real은 서로 다른 것을 검증한다 — 섞어 읽지 않는다.**
 *
 *   - `AI_MODE=mock`: **배선 검증.** mock provider는 사진을 보지 않고 photoId 해시로
 *     3개 관찰 세트에 고정 배정한다 — 그래서 반복/단일 신호가 항상 같은 모양으로 나온다는
 *     걸 이용해 집계 로직(occurrenceCount·strength·confidence·observedState) 자체를
 *     결정론적으로 검증할 수 있다. 아래 "mock 전용" 블록이 이 가정 위에서만 성립한다.
 *   - `AI_MODE=real`: **배선 + Provider 왕복 검증.** 이 fixture(TINY_IMAGE)는 내용이
 *     없는 합성 1x1 이미지라, 실제 Vision이 "인식할 게 없다"고 정직하게 응답하는 것도
 *     **정상 결과**다(§7 No Pattern ≠ No Information) — 그래서 mock 전용 블록의 반복
 *     강도·occurrenceCount 같은 **내용 의존 검증은 real에서 실행하지 않는다.** 대신
 *     요청이 구조적으로 왕복하는지(ok/mode/promptVersion/observedState/금지 문구
 *     비노출)만 확인한다. 실제 사용자 사진 같은 콘텐츠 인식 품질은 이 스크립트의
 *     범위가 아니다 — `test:ai:e2e`도 같은 이유로 real 모드에서 trait 개수를
 *     요구하지 않는다.
 */

const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

/**
 * 1x1 PNG — `tests/run-provider-e2e.mjs`가 이미 real Vision Provider로 검증한
 * 것과 **동일한 이미지**를 재사용한다.
 *
 * ⚠️ v1.17까지 이 자리엔 손으로 만든 1x1 JPEG(단일 컴포넌트 grayscale, SOI~EOI 마커는
 * 전부 있었다)가 있었는데, real Provider에 단독으로 보내도 매번 `INVALID_OUTPUT`으로
 * 거부됐다(같은 요청 경로에 이 PNG를 대신 보내면 `ok:true`로 성공 — 진단으로 직접 비교
 * 확인). 제품 Vision 로직·Observed Me 판정 로직은 이 diff에서 손대지 않았다 — 문제는
 * 항상 이 스크립트가 들고 있던 fixture 쪽이었다.
 */
const TINY_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

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
      images: photoIds.map((imageId) => ({ imageId, dataUrl: TINY_IMAGE })),
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

  // --- 모드 무관 · 배선 검증 (mock/real 둘 다 반드시 성립해야 한다) ---
  check('promptVersion이 v1.10 사진 프롬프트다', data.meta.promptVersion === 'observed-v2-photo',
    data.meta.promptVersion);
  check('mode가 demo가 아니다 (Provider 경로를 실제로 탔다)',
    data.meta.mode === 'real' || data.meta.mode === 'mock', data.meta.mode);
  check('observedState가 채워졌다', typeof data.observedState === 'string', String(data.observedState));

  const withSignal = data.traits.filter((trait) => trait.signal);
  check('모든 trait에 집계 신호가 붙어 있다 (§17 provenance)',
    withSignal.length === data.traits.length, `${withSignal.length}/${data.traits.length}`);

  check('모든 신호가 실제로 보낸 photoId만 참조한다',
    data.traits.every((t) => t.signal.photoIds.every((id) => PHOTO_IDS.includes(id))));

  const allText = JSON.stringify(data);
  check("'규칙 기반 데모' 문구가 노출되지 않는다 (§25)", !allText.includes('규칙 기반 데모'));
  check("'실제 사진 내용을 분석하지 않았어' 문구가 노출되지 않는다 (§25)",
    !allText.includes('실제 사진 내용을 분석하지 않았어'));
  check("'생활 패턴' 표현이 결과에 없다 (§6)", !allText.includes('생활 패턴'));

  if (data.meta.mode === 'mock') {
    // --- mock 전용 · 내용 의존 검증 ---
    // mock provider는 photoId 해시로 항상 같은 3개 세트에 배정하므로, 반복/단일 강도가
    // 결정론적으로 나온다는 가정 위에서만 이 검증들이 의미가 있다(§78 위 안내 참고).
    check('mock 모드는 mock임을 한계로 밝힌다 (§21)',
      data.limitations.some((item) => item.includes('mock')), data.limitations.join(' | '));

    check('관찰이 1개 이상 나왔다', data.traits.length > 0, `실제 ${data.traits.length}`);

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
  } else {
    // --- real 전용 안내 · PASS로 세지 않는다 ---
    // 합성 1x1 이미지는 내용이 없어 "인식 못 함"이 정답인 응답이다. mock 전용 블록의
    // 반복 강도·occurrenceCount 검증은 여기서 억지로 통과시키지 않는다 — 애초에
    // 이 fixture로는 검증할 수 없는 항목이라는 뜻이지, 통과했다는 뜻이 아니다.
    console.log(
      `  ℹ️ mode=${data.meta.mode} — 합성 이미지라 내용 의존 검증(반복 강도·occurrenceCount 등)은 ` +
        `건너뜀. traits=${data.traits.length}건도 0이면 정상(§7 No Pattern ≠ No Information). ` +
        `실제 사진 콘텐츠 인식 품질은 이 스크립트의 검증 범위가 아니다.`,
    );
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
