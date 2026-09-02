import type {
  Confidence,
  ObservedLabel,
  ObservedSignal,
  ObservedSignalCategory,
  ObservedSignalStrength,
  PhotoObservation,
} from '@/types';

/**
 * Cross-photo Signal Aggregation (v1.10 · §2 · §4 · §5)
 *
 * **여기가 '몇 장에서 반복됐는가'를 판정하는 유일한 곳이다.**
 *
 * 역할 분리(§4):
 *   AI      → 사진 한 장에서 무엇이 보이는가 (`PhotoObservation`)
 *   이 파일 → 그게 몇 개의 서로 다른 장면에서 반복됐는가 (`ObservedSignal`)
 *
 * Provider에게 반복 여부·occurrenceCount를 물어보지 않는 이유는 단순하다 —
 * Provider는 사진을 한 장씩 보므로 **애초에 알 수 없고**, 물어보면 지어낸다.
 *
 * 이 파일은 서버·클라이언트 양쪽에서 쓰이므로 `server-only`를 붙이지 않는다.
 */

/* ------------------------------------------------ LEVEL 2 정규화 */

interface CategoryRule {
  category: ObservedSignalCategory;
  /** 사용자에게 보여줄 활동 이름 */
  label: string;
  keywords: readonly string[];
}

/**
 * 관찰 라벨 → 활동 범주.
 *
 * ⚠️ **순서가 의미를 가진다.** 위에서부터 처음 걸리는 규칙을 쓴다.
 * '북카페'가 cafe가 아니라 reading으로, '카페'가 food가 아니라 cafe로 가려면
 * reading이 cafe보다, cafe가 food보다 위에 있어야 한다.
 *
 * ⚠️ 여기 없는 라벨은 `other`로 남는다. 억지로 범주를 만들지 않는다 —
 * 범주를 넓게 잡을수록 '반복'이 쉽게 만들어지고, 그건 없는 근거를 만드는 것과 같다.
 */
const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: 'sports',
    label: '스포츠 관람·운동',
    keywords: [
      '야구', '축구', '농구', '배구', '경기장', '구장', '스타디움', '경기 관람', '경기관람',
      '유니폼', '응원', '골프', '테니스', '배드민턴', '러닝', '마라톤', '헬스', '운동',
      '클라이밍', '서핑', '스키', '스노보드', '볼링', '당구', '수영',
      'baseball', 'soccer', 'football', 'basketball', 'stadium', 'gym', 'workout', 'jersey',
    ],
  },
  {
    category: 'outdoor',
    label: '야외 활동',
    keywords: [
      '등산', '등산로', '등산복', '산', '트레킹', '하이킹', '캠핑', '텐트', '공원', '피크닉',
      '바다', '해변', '계곡', '강가', '숲', '산책', '자전거', '낚시', '야외', '노을',
      'hiking', 'mountain', 'camping', 'park', 'beach', 'outdoor', 'trail',
    ],
  },
  {
    category: 'travel',
    label: '여행',
    keywords: [
      '여행', '공항', '비행기', '캐리어', '호텔', '리조트', '관광', '유적', '랜드마크',
      '기차역', '터미널', '항구', '해외', '숙소', '여행지',
      'travel', 'airport', 'hotel', 'landmark', 'tourist', 'trip',
    ],
  },
  {
    category: 'culture',
    label: '문화 활동',
    keywords: [
      '전시', '전시장', '미술관', '박물관', '갤러리', '공연', '콘서트', '페스티벌',
      '영화관', '극장', '뮤지컬', '연극', '아트',
      'exhibition', 'museum', 'gallery', 'concert', 'festival', 'theater', 'theatre',
    ],
  },
  {
    category: 'reading',
    label: '책과 함께',
    keywords: ['책', '서점', '도서관', '독서', '북카페', 'book', 'library', 'bookstore', 'reading'],
  },
  {
    category: 'cafe',
    label: '카페 방문',
    keywords: [
      '카페', '커피', '라떼', '아메리카노', '에스프레소', '카페 테이블', '디저트 카페',
      'cafe', 'café', 'coffee', 'latte', 'espresso',
    ],
  },
  {
    category: 'food',
    label: '음식',
    keywords: [
      '음식', '식사', '요리', '식당', '레스토랑', '디저트', '케이크', '베이커리', '브런치',
      '맥주', '와인', '술', '파스타', '고기', '회', '분식', '한식', '일식', '중식',
      'food', 'restaurant', 'dish', 'meal', 'dessert', 'dining',
    ],
  },
  {
    category: 'pet',
    label: '반려동물과 함께',
    keywords: ['반려동물', '강아지', '고양이', '반려견', '반려묘', '펫', 'dog', 'cat', 'pet', 'puppy'],
  },
  {
    /**
     * ⚠️ 여기서 멈춘다. '다른 사람과 함께 찍힌 장면'까지가 관찰이고,
     * 그 사람이 누구인지(친구·연인·가족)는 추론하지 않는다(§9).
     */
    category: 'social',
    label: '다른 사람과 함께',
    keywords: [
      '다른 사람', '여러 사람', '사람들', '단체', '모임', '함께 있는', '함께 찍',
      'group of people', 'people together', 'multiple people',
    ],
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

/** 관찰 라벨 하나를 활동 범주로 정규화한다. 해당 없으면 null — `other`를 만들지 않는다. */
export function categorizeLabel(
  raw: string,
): { category: ObservedSignalCategory; label: string } | null {
  const text = normalize(raw);
  if (text.length === 0) return null;

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => text.includes(normalize(keyword)))) {
      return { category: rule.category, label: rule.label };
    }
  }
  return null;
}

/** 사진 한 장의 모든 라벨 (scenes + activities + objects + environment) */
function allLabels(observation: PhotoObservation): string[] {
  const groups: (readonly ObservedLabel[] | undefined)[] = [
    observation.scenes,
    observation.activities,
    observation.objects,
    observation.environment,
  ];
  return groups
    .flatMap((group) => group ?? [])
    .map((entry) => entry.label.trim())
    .filter((label) => label.length > 0);
}

/**
 * 사진 한 장이 만드는 범주별 신호.
 *
 * ⚠️ **사진 한 장은 한 범주에 대해 1회만 센다.** 한 사진에 '야구장'·'유니폼'·'경기 관람'이
 * 다 있어도 스포츠 3회가 아니라 1회다 — 라벨을 많이 뽑았다고 반복이 되면 안 된다.
 */
function categoriesInPhoto(
  observation: PhotoObservation,
): Map<ObservedSignalCategory, { label: string; evidence: string[] }> {
  const result = new Map<ObservedSignalCategory, { label: string; evidence: string[] }>();
  if (!observation.usable) return result;

  for (const raw of allLabels(observation)) {
    const matched = categorizeLabel(raw);
    if (!matched) continue;

    const existing = result.get(matched.category);
    if (existing) {
      if (!existing.evidence.includes(raw)) existing.evidence.push(raw);
    } else {
      result.set(matched.category, { label: matched.label, evidence: [raw] });
    }
  }

  return result;
}

/**
 * 사진 한 장이 특정 범주에 대해 내놓은 원본 관찰 라벨들.
 * §17 Evidence Provenance — '어느 사진에서 무엇을 보고 이 신호가 나왔는지'를 화면이
 * 사진 단위로 다시 보여줄 수 있어야 한다.
 */
export function evidenceLabelsInPhoto(
  observation: PhotoObservation,
  category: ObservedSignalCategory,
): string[] {
  return categoriesInPhoto(observation).get(category)?.evidence ?? [];
}

/* --------------------------------------- 중복처럼 보이는 사진 묶기 (§5) */

/** 이 값 이상으로 라벨이 겹치면 '같은 날 같은 장소에서 연속 촬영한 것 같다'고 본다 */
const DUPLICATE_LIKE_THRESHOLD = 0.75;
/** 라벨이 이보다 적으면 비교 자체가 신뢰할 수 없다 — 묶지 않는다 */
const MIN_LABELS_FOR_DUPLICATE_CHECK = 2;

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

/**
 * 서로 아주 비슷한 사진들을 한 그룹으로 묶는다.
 *
 * ⚠️ 이건 **완전한 중복 탐지가 아니다**(§5에서 허용한 duplicate-like grouping이다).
 * 픽셀·EXIF를 보지 않고 관찰 라벨 집합만 비교하므로, 정말 다른 날 같은 카페에 간 사진도
 * 한 그룹으로 묶일 수 있다. 그 방향의 오류(반복을 **덜** 세는 쪽)를 일부러 택했다 —
 * 반대 방향은 없는 생활 근거를 만들어내는 것이기 때문이다.
 *
 * @returns 사진 id 그룹 목록. 묶이지 않은 사진은 혼자 있는 그룹이 된다.
 */
export function groupDuplicateLikePhotos(
  observations: readonly PhotoObservation[],
): string[][] {
  const usable = observations.filter((item) => item.usable);
  const tokens = new Map<string, Set<string>>();
  for (const observation of usable) {
    tokens.set(observation.photoId, new Set(allLabels(observation).map(normalize)));
  }

  const groups: string[][] = [];
  const assigned = new Set<string>();

  for (const observation of usable) {
    if (assigned.has(observation.photoId)) continue;

    const group = [observation.photoId];
    assigned.add(observation.photoId);
    const base = tokens.get(observation.photoId)!;

    if (base.size >= MIN_LABELS_FOR_DUPLICATE_CHECK) {
      for (const other of usable) {
        if (assigned.has(other.photoId)) continue;
        const candidate = tokens.get(other.photoId)!;
        if (candidate.size < MIN_LABELS_FOR_DUPLICATE_CHECK) continue;
        if (jaccard(base, candidate) >= DUPLICATE_LIKE_THRESHOLD) {
          group.push(other.photoId);
          assigned.add(other.photoId);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/* ------------------------------------------------ LEVEL 3 집계 */

/** 신호 하나가 들고 다닐 근거 라벨 상한 — 화면 '근거 보기'가 목록으로 읽히는 길이 */
const MAX_EVIDENCE_PER_SIGNAL = 5;
/** 신호 개수 상한. 개수를 채우려고 약한 신호를 남기지 않는다(§61) */
export const MAX_OBSERVED_SIGNALS = 6;

export function strengthFromOccurrence(occurrenceCount: number): ObservedSignalStrength {
  if (occurrenceCount >= 3) return 'strong_repeated';
  if (occurrenceCount === 2) return 'repeated';
  return 'single';
}

/**
 * 사진별 관찰을 가로질러 활동 신호를 집계한다.
 *
 * `occurrenceCount`는 사진 장수가 아니라 **서로 다른 장면 그룹의 수**다 —
 * 같은 장면으로 보이는 사진 5장은 1회로 센다(§5).
 */
export function aggregatePhotoObservations(
  observations: readonly PhotoObservation[],
): ObservedSignal[] {
  const groups = groupDuplicateLikePhotos(observations);
  const groupIndexByPhoto = new Map<string, number>();
  groups.forEach((group, index) => {
    for (const photoId of group) groupIndexByPhoto.set(photoId, index);
  });

  interface Accumulator {
    label: string;
    photoIds: string[];
    groupIndexes: Set<number>;
    evidence: string[];
  }

  const byCategory = new Map<ObservedSignalCategory, Accumulator>();

  for (const observation of observations) {
    const groupIndex = groupIndexByPhoto.get(observation.photoId);
    if (groupIndex === undefined) continue;

    for (const [category, found] of categoriesInPhoto(observation)) {
      const accumulator = byCategory.get(category) ?? {
        label: found.label,
        photoIds: [],
        groupIndexes: new Set<number>(),
        evidence: [],
      };

      if (!accumulator.photoIds.includes(observation.photoId)) {
        accumulator.photoIds.push(observation.photoId);
      }
      accumulator.groupIndexes.add(groupIndex);
      for (const item of found.evidence) {
        if (accumulator.evidence.length >= MAX_EVIDENCE_PER_SIGNAL) break;
        if (!accumulator.evidence.includes(item)) accumulator.evidence.push(item);
      }

      byCategory.set(category, accumulator);
    }
  }

  const signals: ObservedSignal[] = [];
  for (const [category, accumulator] of byCategory) {
    const occurrenceCount = accumulator.groupIndexes.size;
    signals.push({
      id: `sig_${category}`,
      category,
      label: accumulator.label,
      photoIds: [...accumulator.photoIds],
      occurrenceCount,
      evidence: [...accumulator.evidence],
      strength: strengthFromOccurrence(occurrenceCount),
      hasDuplicateLikePhotos: accumulator.photoIds.length > occurrenceCount,
    });
  }

  // 반복이 강한 신호를 먼저. 같은 강도면 사진 수, 그다음 id로 안정 정렬한다
  // (id 정렬이 없으면 Map 삽입 순서에 따라 결과가 흔들려 QA 기대값을 쓸 수 없다).
  signals.sort(
    (a, b) =>
      b.occurrenceCount - a.occurrenceCount ||
      b.photoIds.length - a.photoIds.length ||
      a.id.localeCompare(b.id),
  );

  return signals.slice(0, MAX_OBSERVED_SIGNALS);
}

/* ------------------------------------------------ LEVEL 4 표현 (§6 · §15) */

/**
 * 신호를 사용자에게 설명하는 문장.
 *
 * ⚠️ 규칙이 만든다. AI에게 다시 물어보지 않는 이유는, 이 문장이 말해야 하는 내용이
 * **집계 결과 그 자체**(몇 장에서 보였는가)이기 때문이다. 여기에 AI 문장을 끼우면
 * 규칙이 센 숫자와 다른 뉘앙스가 섞일 수 있고, 그건 §5의 판정을 흐리는 것이다.
 *
 * ⚠️ '생활 패턴'이라는 말을 쓰지 않는다(§6). 반복 근거가 강해도 '~일 가능성이 있어 보여'
 * 수준까지만 간다(§2 LEVEL 4).
 */
export function describeSignal(signal: ObservedSignal): string {
  if (signal.strength === 'single') {
    /**
     * ⚠️ 사진 장수와 장면 수가 다를 수 있다. 비슷해 보이는 사진 3장을 한 장면으로 묶었을 때
     * '한 장에서만 확인했어'라고 하면 **사용자가 올린 사진 수와 어긋나** 오히려 틀린 말이 된다.
     * 묶었다는 사실을 그대로 말한다.
     */
    return signal.hasDuplicateLikePhotos
      ? `비슷해 보이는 사진 ${signal.photoIds.length}장에서 봤는데, 서로 다른 장면으로는 한 번이야. 아직 평소 활동이라고 보긴 어려워.`
      : '사진 한 장에서만 확인했어. 아직 평소 활동이라고 보긴 어려워.';
  }

  if (signal.hasDuplicateLikePhotos) {
    return `사진 ${signal.photoIds.length}장에서 보였는데, 비슷해 보이는 사진끼리 묶으면 서로 다른 장면은 ${signal.occurrenceCount}번이야.`;
  }

  if (signal.strength === 'repeated') {
    return `사진 ${signal.photoIds.length}장에서 비슷한 장면이 보였어. 반복인지는 아직 조심스러워.`;
  }

  return `사진 ${signal.photoIds.length}장에서 비슷한 장면이 반복해서 보였어. 평소 즐기는 활동 중 하나일 가능성이 있어 보여.`;
}

/**
 * `confidence`는 '이 사람이 진짜 그런 사람일 확률'이 아니라
 * **'이미지에서 이 관찰을 뒷받침하는 신호가 얼마나 명확한가'**다(§6).
 * 반복 횟수가 곧 신호의 명확도이므로 그대로 매핑한다.
 */
export function strengthToConfidence(strength: ObservedSignalStrength): Confidence {
  if (strength === 'strong_repeated') return 'high';
  if (strength === 'repeated') return 'medium';
  return 'low';
}

/** 반복 신호(2장 이상)만 */
export function repeatedSignals(signals: readonly ObservedSignal[]): ObservedSignal[] {
  return signals.filter((signal) => signal.strength !== 'single');
}
