type ClassValue = string | number | false | null | undefined;

/** 조건부 className 결합 유틸 */
export function cn(...values: ClassValue[]): string {
  return values.filter((value) => typeof value === 'string' && value.length > 0).join(' ');
}
