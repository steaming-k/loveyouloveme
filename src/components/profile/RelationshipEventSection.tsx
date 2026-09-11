'use client';

import { useState } from 'react';

import { ChoiceChip } from '@/components/common/ChoiceChip';
import { Tag } from '@/components/common/primitives';
import { Lovy } from '@/components/lovy/Lovy';
import {
  RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH,
  RELATIONSHIP_EVENT_LABEL,
  RELATIONSHIP_EVENT_MAX,
  RELATIONSHIP_EVENT_OPTIONS,
  RELATIONSHIP_EVENT_PLACEHOLDER,
  RELATIONSHIP_EVENT_REACTION_MAX_LENGTH,
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
  const { answers, addRelationshipEvent, updateRelationshipEvent, removeRelationshipEvent } =
    useSession();
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

  /** 고치는 중에는 상한이 걸리지 않는다 — 개수가 늘지 않기 때문이다 */
  const full = events.length >= RELATIONSHIP_EVENT_MAX && editingId === null;
  const canSubmit = draftType !== null && description.trim().length > 0;

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
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex min-h-11 items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[10.5px] font-semibold tracking-[0.05em] text-ink-muted">
            기억나는 장면 · 선택
          </span>
          <span className="text-caption font-medium">기억나는 장면이 있었어?</span>
          <span className="text-[11.5px] keep-all text-ink-faint">
            갈등이나 호감 신호처럼 관계를 이해하는 데 중요한 일이 있었다면 알려줘.
          </span>
        </span>
        <Tag tone={events.length > 0 ? 'brand' : 'neutral'}>
          {events.length > 0 ? `${events.length}개` : open ? '접기' : '펼치기'}
        </Tag>
      </button>

      {open ? (
        <div className="flex flex-col gap-3 pt-1">
          {/*
            이미 알려준 장면. **사용자가 쓴 문장을 그대로 보여준다** — 요약하거나
            다듬지 않는다. 화면에서 문장이 달라지면 리포트에 실릴 문장과 어긋난다.
          */}
          {events.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {events.map((event) => (
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
            §12 우선순위 3 — 러비 체크포인트. **행동을 지시하지 않는다.**
            사건을 하나라도 받았을 때만, 러비가 무엇을 받았는지만 말한다.
          */}
          {events.length > 0 ? (
            <div className="flex items-center gap-2 rounded-row bg-brand-tint px-3 py-2.5">
              <Lovy pose="note" size={32} decorative />
              <p className="text-[11.5px] keep-all leading-relaxed text-brand-pressed">
                기억해뒀어. 이건 네가 알려준 장면으로만 쓸게 — 상대 마음을 내가 정하진
                않아.
              </p>
            </div>
          ) : null}

          {full ? (
            <p className="text-[11px] text-ink-faint">
              가장 기억나는 장면 {RELATIONSHIP_EVENT_MAX}개까지만 받을게. 지우면 다시
              적을 수 있어.
            </p>
          ) : draftType === null ? (
            /* 종류 먼저 고른다 — 무엇을 적어야 하는지가 라벨에서 드러나게 한다(§7) */
            <div className="flex flex-col gap-2">
              <p className="text-[11.5px] font-semibold text-[#555]">어떤 장면이었어?</p>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="기억나는 장면의 종류"
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
                <input
                  type="text"
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value.slice(0, RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH),
                    )
                  }
                  maxLength={RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH}
                  placeholder={RELATIONSHIP_EVENT_PLACEHOLDER[draftType]}
                  className="min-h-11 rounded-row border border-line bg-surface px-3.5 text-caption outline-none transition-[border-color] t-fast placeholder:text-ink-faint focus:border-brand"
                />
              </label>

              {reactionOpen ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11.5px] font-semibold text-[#555]">
                    그때 나는 어떻게 반응했어? · 선택
                  </span>
                  <input
                    type="text"
                    value={reaction}
                    onChange={(event) =>
                      setReaction(
                        event.target.value.slice(0, RELATIONSHIP_EVENT_REACTION_MAX_LENGTH),
                      )
                    }
                    maxLength={RELATIONSHIP_EVENT_REACTION_MAX_LENGTH}
                    placeholder="예) 아무 말 안 하고 넘겼어"
                    className="min-h-11 rounded-row border border-line bg-surface px-3.5 text-caption outline-none transition-[border-color] t-fast placeholder:text-ink-faint focus:border-brand"
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
                {editingId === null ? '이 장면 추가하기' : '이 장면 고치기'}
              </button>
            </div>
          )}

          <p className="text-[11px] keep-all leading-relaxed text-ink-faint">
            안 적어도 괜찮아. 적어준 장면은 동기화율 점수에는 들어가지 않고, 리포트에서
            네가 무엇을 기억하는지 보는 데만 써.
          </p>
        </div>
      ) : null}
    </div>
  );
}
