'use client';

import { useState } from 'react';

import { ChoiceChip } from '@/components/common/ChoiceChip';
import { OptionalDisclosureButton } from '@/components/common/OptionalDisclosureButton';
import { Lovy } from '@/components/lovy/Lovy';
import {
  RELATIONSHIP_EVENT_LABEL,
  RELATIONSHIP_EVENT_OPTIONS,
  RELATIONSHIP_EVENT_PLACEHOLDER,
  RELATIONSHIP_EVENT_VISIBLE_DEFAULT,
} from '@/data/relationshipEvents';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionProvider';
import type { RelationshipEventType } from '@/types';

/**
 * S19 관계 사건 입력 — '기억나는 장면이 있었어?' (v1.46 · §6~§9 · §14)
 *
 * ══ 이 섹션이 지키는 것 ═════════════════════════════════════════════════════
 *
 * ```
 * 선택 입력이다            0개로 넘어가도 아무 것도 막지 않는다(§9 Skip 가능)
 * 결론을 고르게 하지 않는다  종류 라벨의 주어는 항상 사용자다(§7)
 * 점수에 넣지 않는다        `known/4` 카운트·동기화율에 들어가지 않는다(§11)
 * ```
 *
 * ⚠️ **MBTI·'좋아하는 것'과 같은 Progressive Disclosure 패턴을 재사용한다**(v1.13 §8).
 * 새 장문 Survey 화면을 만들지 않는다 — 상대 정보 입력 안의 접히는 optional section이다.
 *
 * ⚠️ **`점수를 더 정확하게 만들려면 적어달라`고 말하지 않는다.** 이 입력이 하는 일은
 * 리포트의 맥락을 선명하게 하는 것뿐이고, 그렇게만 말한다(MBTI 섹션이 v1.2부터
 * 지켜온 문구 규칙과 같다).
 *
 * ⚠️ **날짜·장소·상대 이름을 묻지 않는다**(§8). 그 세 개가 들어오는 순간 이 화면은
 * 관계 일지 입력 폼이 되고, 그건 이 제품이 만들지 않기로 한 것이다.
 */
export function RelationshipEventSection() {
  const {
    answers,
    addRelationshipEvent,
    updateRelationshipEvent,
    removeRelationshipEvent,
    storageStatus,
    droppedEventCount,
  } = useSession();
  const events = answers.target.events;

  const [open, setOpen] = useState(false);
  /** 작성 중인 항목. null이면 폼이 닫힌 상태다 */
  const [draftType, setDraftType] = useState<RelationshipEventType | null>(null);
  const [description, setDescription] = useState('');
  const [reaction, setReaction] = useState('');
  const [reactionOpen, setReactionOpen] = useState(false);
  /**
   * 지금 고치고 있는 항목의 id. null이면 새로 적는 중이다.
   *
   * ⚠️ **고치기를 '지우고 다시 적기'로 구현하지 않는다.** 그러면 id가 새로 발급되고,
   * 리포트의 `{source:'user_reported_event', eventId}` 근거가 조용히 다른 것을
   * 가리키게 된다. 오타 하나를 고쳤다는 이유로 근거의 정체성이 바뀌면 안 된다.
   */
  const [editingId, setEditingId] = useState<string | null>(null);
  /**
   * v1.46.4 §40 — 목록을 **전부 펼쳐두지 않는다.** 393×852에서 장면 20개를 한꺼번에
   * 그리면 이 섹션 하나가 화면을 삼킨다. 기본은 최근 것부터
   * `RELATIONSHIP_EVENT_VISIBLE_DEFAULT`개이고, 나머지는 사용자가 직접 펼친다.
   *
   * ⚠️ **저장은 전부 되어 있다.** 접는 것은 표현이지 보관이 아니다 — 접힌 장면도
   * 리포트의 근거 후보이고, 삭제하지 않는 한 사라지지 않는다.
   */
  const [showAll, setShowAll] = useState(false);

  const canSubmit = draftType !== null && description.trim().length > 0;

  /**
   * 최근 장면이 위로 온다. **저장 순서를 바꾸지 않는다** — `events`는 그대로 두고
   * 화면용 복사본만 뒤집는다(근거 id·순서를 표현이 흔들면 안 된다).
   */
  const ordered = [...events].reverse();
  const visible = showAll ? ordered : ordered.slice(0, RELATIONSHIP_EVENT_VISIBLE_DEFAULT);
  const hiddenCount = ordered.length - visible.length;

  const resetDraft = () => {
    setDraftType(null);
    setDescription('');
    setReaction('');
    setReactionOpen(false);
    setEditingId(null);
  };

  const startEdit = (id: string) => {
    const event = events.find((item) => item.id === id);
    if (!event) return;
    setEditingId(id);
    setDraftType(event.type);
    setDescription(event.description);
    setReaction(event.myReaction ?? '');
    setReactionOpen(Boolean(event.myReaction));
  };

  const submit = () => {
    if (!draftType) return;
    if (editingId !== null) {
      updateRelationshipEvent(editingId, { type: draftType, description, myReaction: reaction });
      resetDraft();
      return;
    }
    if (addRelationshipEvent(draftType, description, reaction)) resetDraft();
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface p-4">
      {/*
        260914 UT 후속 P1 — STEP 4 가시성(열면 무엇이 달라지는지) · STEP 5 '장면' → '사건'.
        호감 · 갈등처럼 **일 단위**로 떠올리는 게 쉽다는 UT 반응을 따랐다. 내부 타입 · 저장 구조는 그대로다.

        v1.46.4 §5 — **개수를 미리 말하지 않는다.** 예전 카피는 상한(3개)을 암시했고,
        그래서 두 번째 사건을 적을 때부터 '이제 하나 남았네'가 됐다. 여러 개여도 된다는 사실이 먼저다.
      */}
      <OptionalDisclosureButton
        panelId="target-event-panel"
        open={open}
        onToggle={() => setOpen((prev) => !prev)}
        eyebrow="기억나는 사건"
        title="기억나는 사건이 있었어?"
        hint="갈등이나 호감 신호처럼 기억에 남은 일이 있다면 알려줘. 여러 개 적어도 돼."
        benefit="알려주면 리포트가 네가 기억하는 일과 이어져서 더 구체적이 돼"
        filledLabel={events.length > 0 ? `${events.length}개` : undefined}
      />

      {open ? (
        <div id="target-event-panel" className="flex flex-col gap-3 pt-1">
          {/*
            ══ 입력 폼이 목록보다 **위에** 있다 (v1.46.4 HARDENING PHASE 2) ═══════

            Candidate 배치는 `목록 → 러비 메모 → 폼`이었다. 장면이 0~3개일 때는
            자연스럽지만, 393×852에서 10개가 되면 **입력 폼이 화면 두 개 아래로
            밀린다.** 장면을 더 적으러 이 섹션을 연 사용자가 자기가 이미 적은 것을
            한참 스크롤한 뒤에야 쓸 칸을 만나는 구조다.

            지금은 '적는 자리'가 언제나 맨 위에 있고 목록이 그 아래에 쌓인다. 목록을
            줄인 것이 아니라 순서를 바꾼 것뿐이다.
          */}
          {draftType === null ? (
            /* 종류 먼저 고른다 — 무엇을 적어야 하는지가 라벨에서 드러나게 한다(§7) */
            <div className="flex flex-col gap-2">
              <p className="text-[11.5px] font-semibold text-[#555]">어떤 일이었어?</p>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="기억나는 사건의 종류"
              >
                {RELATIONSHIP_EVENT_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    label={option.label}
                    selected={false}
                    onToggle={() => setDraftType(option.value)}
                  />
                ))}
              </div>
              {/*
                UT-1 P1-B §5 — **종류는 선택 입력이다.**

                지금까지 종류를 고르지 않으면 본문 칸 자체가 열리지 않았다. 그래서
                '분류하기는 애매한데 기억나는 장면'을 가진 사용자는 아무것도 적지
                못했다 — 선택 입력이라고 말해놓고 통과 조건으로 쓰고 있었다.

                ⚠️ **분류를 우리가 대신 하지 않는다.** 이 길로 들어오면 종류는
                `other`(기타)로 저장되고, 그 값도 **사용자가 고른 것**이다(이 버튼을
                눌렀다는 사실이 선택이다). 본문을 읽고 종류를 추론하는 코드는
                만들지 않는다 — 그게 §5의 attribution 규칙이다.
              */}
              <button
                type="button"
                onClick={() => setDraftType('other')}
                className="flex min-h-11 items-center text-[11.5px] text-ink-muted press-scale"
              >
                고르기 애매하면 그냥 적어도 돼 →
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-semibold tracking-[0.04em] text-mint-ink">
                  {RELATIONSHIP_EVENT_LABEL[draftType]}
                </span>
                <button
                  type="button"
                  onClick={resetDraft}
                  className="min-h-11 text-[11.5px] text-ink-muted press-scale"
                >
                  {editingId === null ? '종류 다시 고르기' : '고치기 취소'}
                </button>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold text-[#555]">
                  무슨 일이 있었어?
                </span>
                {/*
                  v1.46.4 §5 · §39 — **한 줄 input이 아니라 textarea다.**

                  예전 80자 input은 "한 줄로 기억되는 길이"라는 제품 판단이었는데, 실제로
                  사람들이 적고 싶어한 것은 장면이었다. 한 줄 칸은 그 자체가 '짧게 적어라'는
                  지시이고, 80자에서 잘리면 근거로 되짚을 때 의미가 왜곡된다(§10).

                  ⚠️ **남은 글자 수를 보여주지 않는다.** 카운터는 곧 상한 안내이고,
                  그러면 technical guard가 다시 UX cap이 된다.

                  ⚠️ **`maxLength`도 없다**(v1.46.4 HARDENING PHASE 1-1). Candidate는
                  500자를 걸어뒀는데, 그건 이름이 무엇이든 **사용자가 더 못 쓰게 만드는
                  제품 상한**이었다. 지금 남은 상한은 복원 파서의 손상 데이터 방어
                  하나뿐이고(20,000자) 그 값은 이 화면이 알지도 못한다.
                */}
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder={RELATIONSHIP_EVENT_PLACEHOLDER[draftType]}
                  className="min-h-[76px] resize-y rounded-row border border-line bg-surface px-3.5 py-2.5 text-caption leading-relaxed outline-none transition-[border-color] t-fast placeholder:text-ink-faint focus:border-brand"
                />
              </label>

              {reactionOpen ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-[#555]">
                    그때 나는 어떻게 반응했어? · 선택
                  </span>
                  <textarea
                    value={reaction}
                    onChange={(event) => setReaction(event.target.value)}
                    rows={2}
                    placeholder="예) 아무 말 안 하고 넘겼어"
                    className="min-h-[56px] resize-y rounded-row border border-line bg-surface px-3.5 py-2.5 text-caption leading-relaxed outline-none transition-[border-color] t-fast placeholder:text-ink-faint focus:border-brand"
                  />
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => setReactionOpen(true)}
                  className="flex min-h-11 items-center text-[11.5px] text-ink-muted press-scale"
                >
                  + 그때 내 반응도 적을래 (선택)
                </button>
              )}

              <button
                type="button"
                disabled={!canSubmit}
                onClick={submit}
                className={cn(
                  // 색 전환도 `press-scale`이 함께 담당한다(globals.css 주석 참고)
                  'flex min-h-11 items-center justify-center rounded-row border text-caption font-medium press-scale',
                  canSubmit
                    ? 'border-brand bg-brand-tint text-brand-pressed'
                    : 'border-line bg-surface text-ink-faint',
                )}
              >
                {editingId === null ? '이 사건 추가하기' : '이 사건 고치기'}
              </button>
            </div>
          )}

          {/*
            이미 알려준 장면. **사용자가 쓴 문장을 그대로 보여준다** — 요약하거나
            다듬지 않는다. 화면에서 문장이 달라지면 리포트에 실릴 문장과 어긋난다.
          */}
          {events.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {visible.map((event) => (
                <li
                  key={event.id}
                  className={cn(
                    'flex items-start justify-between gap-2 rounded-row border bg-sunken px-3 py-2.5 transition-colors t-fast',
                    editingId === event.id ? 'border-brand' : 'border-line',
                  )}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10.5px] font-semibold tracking-[0.04em] text-mint-ink">
                      {RELATIONSHIP_EVENT_LABEL[event.type]}
                    </span>
                    <span className="text-caption keep-all leading-relaxed">
                      {event.description}
                    </span>
                    {event.myReaction ? (
                      <span className="text-[11.5px] keep-all text-ink-sub">
                        그때 나는 · {event.myReaction}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-none items-center">
                    <button
                      type="button"
                      onClick={() => startEdit(event.id)}
                      aria-label={`'${event.description}' 고치기`}
                      className="flex min-h-11 items-center px-2 text-[11.5px] text-ink-muted press-scale"
                    >
                      고치기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // 고치는 중인 항목을 지우면 폼도 함께 닫는다 — 없는 항목을 고칠 수 없다.
                        if (editingId === event.id) resetDraft();
                        removeRelationshipEvent(event.id);
                      }}
                      aria-label={`'${event.description}' 삭제`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted press-scale active:bg-line/60"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {/*
            §40 — 나머지를 펼치는 길. **접혀 있다는 사실과 개수를 함께 말한다** —
            "더 보기"만 있으면 몇 개가 더 있는지 모르고, 그러면 사용자가 자기가
            알려준 것이 다 있는지 확인할 수 없다.
          */}
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex min-h-11 items-center text-[11.5px] text-ink-muted press-scale"
            >
              이전에 적은 사건 {hiddenCount}개 더 보기 ↓
            </button>
          ) : null}
          {showAll && ordered.length > RELATIONSHIP_EVENT_VISIBLE_DEFAULT ? (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="flex min-h-11 items-center text-[11.5px] text-ink-muted press-scale"
            >
              최근 {RELATIONSHIP_EVENT_VISIBLE_DEFAULT}개만 보기 ↑
            </button>
          ) : null}

          {/*
            §12 우선순위 3 — 러비 체크포인트. **행동을 지시하지 않는다.**
            사건을 하나라도 받았을 때만, 러비가 무엇을 받았는지만 말한다.
          */}
          {events.length > 0 ? (
            <div className="flex items-center gap-2 rounded-row bg-brand-tint px-3 py-2.5">
              <Lovy pose="note" size={32} decorative />
              <p className="text-[11.5px] keep-all leading-relaxed text-brand-pressed">
                기억해뒀어. 이건 네가 알려준 사건으로만 쓸게 — 상대 마음을 내가 정하진
                않아.
              </p>
            </div>
          ) : null}

          {/*
            v1.46.4 §6 — **저장이 실제로 위태로울 때만** 말한다. `ok`에서는 이 자리에
            아무것도 없다. 예전에는 저장 실패를 통째로 삼켰기 때문에 사용자가 방금 적은
            장면이 사라져도 알 방법이 없었다.
          */}
          {/*
            PHASE 1-1 — 복원에서 버려진 장면이 있으면 **말한다.** Candidate에서는
            조용히 사라졌다. 되살리려 시도하지 않는다 — 손상된 값을 추정으로 복구하는
            것이 더 나쁘다(v1.44 BUG-002가 세운 규칙).
          */}
          {droppedEventCount > 0 ? (
            <p className="rounded-row bg-[#FDECEC] px-3 py-2.5 text-[11.5px] keep-all leading-relaxed text-[#9B2C2C]">
              저장돼 있던 사건 {droppedEventCount}개를 불러오지 못했어. 내용이 손상돼서
              그대로 보여줄 수 없었어 — 기억나는 사건이면 다시 적어줘.
            </p>
          ) : null}

          {storageStatus === 'full' ? (
            <p className="rounded-row bg-[#FDECEC] px-3 py-2.5 text-[11.5px] keep-all leading-relaxed text-[#9B2C2C]">
              이 브라우저에 더 저장하지 못했어. 방금 적은 내용이 새로고침 뒤에는 없을 수
              있어 — 오래된 사건을 몇 개 지우면 다시 저장돼.
            </p>
          ) : storageStatus === 'near' ? (
            <p className="rounded-row bg-sunken px-3 py-2.5 text-[11.5px] keep-all leading-relaxed text-ink-sub">
              저장해둔 게 꽤 쌓였어. 지금은 문제없지만, 더 이상 안 보는 사건은 지워도 돼.
            </p>
          ) : null}

          <p className="text-[11px] keep-all leading-relaxed text-ink-faint">
            안 적어도 괜찮아. 적어준 사건은 동기화율 점수에는 들어가지 않고, 리포트에서
            네가 무엇을 기억하는지 보는 데만 써.
          </p>
        </div>
      ) : null}
    </div>
  );
}
