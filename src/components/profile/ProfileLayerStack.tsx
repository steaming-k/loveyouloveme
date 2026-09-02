import { cn } from '@/lib/cn';
import type { MbtiType, ProfileLayer } from '@/types';

const MARKER_CLASS: Record<ProfileLayer['id'], string> = {
  observed: 'bg-mint-tint border border-mint',
  declared: 'bg-brand-edge',
  relationship: 'bg-brand',
};

const TITLE_CLASS: Record<ProfileLayer['id'], string> = {
  observed: 'text-mint-text',
  declared: 'text-brand-pressed',
  relationship: 'text-brand-pressed',
};

const CHIP_CLASS: Record<ProfileLayer['id'], string> = {
  observed: 'bg-sunken text-[#555]',
  declared: 'bg-sunken text-[#555]',
  relationship: 'bg-brand-tint text-brand-deep',
};

/**
 * Relationship Profile (S18)
 * 세 데이터를 별개 카드 3개로 나열하지 않고, 하나의 흐름으로 연결한 뒤
 * 마지막에 '세 관찰을 합친 결과' 한 줄로 묶는다.
 *
 * mbti는 Supporting Information으로만 붙는다 — 3-Layer 타임라인 안에 넣지 않고,
 * 요약 문장의 근거로도 쓰지 않는다('INFP라서 ~하다' 같은 단정 금지).
 */
export function ProfileLayerStack({
  layers,
  coreInsight,
  mbti,
}: {
  layers: ProfileLayer[];
  coreInsight: string;
  mbti?: MbtiType | null;
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 pt-[18px] pb-4">
      <ol className="flex flex-col">
        {layers.map((layer, index) => {
          const last = index === layers.length - 1;

          return (
            <li key={layer.id} className="flex gap-3">
              <div className="flex w-[22px] flex-none flex-col items-center">
                <span
                  className={cn('h-[22px] w-[22px] flex-none rounded-[7px]', MARKER_CLASS[layer.id])}
                  aria-hidden
                />
                {last ? null : <span className="my-1 w-px flex-1 bg-rule" aria-hidden />}
              </div>

              <div className={cn('min-w-0 flex-1', last ? 'pb-[18px]' : 'pb-4')}>
                <p
                  className={cn(
                    'mb-1.5 text-[11px] font-semibold tracking-[0.05em]',
                    TITLE_CLASS[layer.id],
                  )}
                >
                  {layer.title} · {layer.caption}
                </p>

                {layer.items.length > 0 ? (
                  <ul className="flex flex-wrap gap-[5px]">
                    {layer.items.map((item, itemIndex) => (
                      <li
                        key={`${item}-${itemIndex}`}
                        className={cn(
                          'rounded-tag px-2.5 py-1.5 text-[12.5px] keep-all',
                          CHIP_CLASS[layer.id],
                        )}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-meta text-ink-muted">아직 기록이 없어</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 border-t border-dashed border-line-strong pt-4">
        <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted">
          세 관찰을 합친 결과
        </p>
        <p className="text-insight keep-all">{coreInsight}</p>
      </div>

      {mbti ? (
        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line-soft pt-3.5">
          <p className="text-[11px] font-semibold tracking-[0.05em] text-ink-muted">
            PERSONALITY LENS · 참고
          </p>
          <span className="rounded-tag bg-sunken px-2.5 py-1 text-[12.5px] font-medium text-[#555]">
            {mbti}
          </span>
        </div>
      ) : null}
    </div>
  );
}
