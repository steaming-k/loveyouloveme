/**
 * History 표시용 날짜 포맷.
 *
 * 항목은 **분석 시점(날짜)으로만** 구분한다 — 상대 이름·연애 기간·'몇 번째 관계'로 라벨링하지
 * 않는다(§2). 그래서 이 파일이 History 항목 식별의 유일한 표시 규칙이다.
 */

/** `2026.08.31` */
export function formatEntryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '날짜 미상';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}
