/**
 * 공유 카드 이미지 저장
 *
 * Canvas 2D로 카드를 직접 그려 PNG로 내려준다.
 * 사진·관계 경험·상대 정보 같은 민감한 입력은 호출하는 쪽에서 제외한 값만 넘긴다.
 */

const WIDTH = 1080;
const HEIGHT = 1350;
const PADDING = 88;

export interface ShareCardSpec {
  variant: 'compatibility' | 'mirror';
  eyebrow: string;
  /** 큰 숫자 (동기화율). Mirror 카드에서는 생략 */
  bigValue?: string;
  bigValueCaption?: string;
  /** 본문 문장 (줄 단위) */
  headlineLines: string[];
  /** 하단 보조 라인 */
  footnote: string;
  /** 항목 리스트 (선택) */
  items?: string[];
  lovySrc: string;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  // 한국어는 어절 단위로 끊는다.
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function downloadShareCard(spec: ShareCardSpec, filename: string): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const onPurple = spec.variant === 'compatibility';
  const background = onPurple ? '#8F74F0' : '#FFFFFF';
  const primaryText = onPurple ? '#FFFFFF' : '#222222';
  const mutedText = onPurple ? 'rgba(255,255,255,0.8)' : '#9A968E';
  const ruleColor = onPurple ? 'rgba(255,255,255,0.25)' : '#EFEDE9';

  ctx.fillStyle = onPurple ? '#6B54C4' : '#FAFAF7';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 카드
  const cardTop = 60;
  const cardHeight = HEIGHT - 120;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(60, cardTop, WIDTH - 120, cardHeight, 56);
  ctx.fill();

  if (!onPurple) {
    ctx.strokeStyle = '#E7E5E2';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  let y = cardTop + PADDING + 20;
  const contentWidth = WIDTH - 120 - PADDING * 2;
  const left = 60 + PADDING;

  // eyebrow
  ctx.fillStyle = onPurple ? mutedText : '#7A5EE0';
  ctx.font = '600 30px Pretendard, system-ui, sans-serif';
  ctx.fillText(spec.eyebrow, left, y);
  y += 78;

  // big value
  if (spec.bigValue) {
    ctx.fillStyle = primaryText;
    ctx.font = '600 260px Pretendard, system-ui, sans-serif';
    ctx.fillText(spec.bigValue, left, y + 180);

    if (spec.bigValueCaption) {
      const valueWidth = ctx.measureText(spec.bigValue).width;
      ctx.font = '400 40px Pretendard, system-ui, sans-serif';
      ctx.fillStyle = mutedText;
      ctx.fillText(spec.bigValueCaption, left + valueWidth + 28, y + 180);
    }
    y += 260;
  }

  // headline
  ctx.fillStyle = primaryText;
  ctx.font = `600 ${spec.bigValue ? 46 : 62}px Pretendard, system-ui, sans-serif`;
  const lineHeight = spec.bigValue ? 72 : 92;

  for (const line of spec.headlineLines) {
    for (const wrapped of wrapText(ctx, line, contentWidth)) {
      ctx.fillText(wrapped, left, y);
      y += lineHeight;
    }
  }

  // items
  if (spec.items && spec.items.length > 0) {
    y += 24;
    ctx.font = '400 34px Pretendard, system-ui, sans-serif';
    ctx.fillStyle = mutedText;
    for (const item of spec.items) {
      ctx.fillText(`· ${item}`, left, y);
      y += 52;
    }
  }

  // footer
  const footerY = cardTop + cardHeight - PADDING - 20;
  ctx.strokeStyle = ruleColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, footerY - 72);
  ctx.lineTo(left + contentWidth, footerY - 72);
  ctx.stroke();

  const lovy = await loadImage(spec.lovySrc);
  let footerTextLeft = left;
  if (lovy) {
    const lovyHeight = 96;
    const lovyWidth = (lovy.width / lovy.height) * lovyHeight;
    ctx.drawImage(lovy, left, footerY - 56, lovyWidth, lovyHeight);
    footerTextLeft = left + lovyWidth + 24;
  }

  ctx.font = '400 28px Pretendard, system-ui, sans-serif';
  ctx.fillStyle = mutedText;
  for (const [index, line] of wrapText(ctx, spec.footnote, contentWidth - 140).entries()) {
    ctx.fillText(line, footerTextLeft, footerY + index * 40);
  }

  const url = canvas.toDataURL('image/png');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  return true;
}
