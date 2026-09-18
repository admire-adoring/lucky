/** 轻量 className 拼接（不引第三方依赖） */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
