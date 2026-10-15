/* ============================================================================
   命令错误的统一形态
   ----------------------------------------------------------------------------
   壳层把领域层错误序列化成 { code, message }（见 shell 的 ApiError），
   这里把它换回 Error 实例：code 给调用方分支（冲突不关弹窗、找不到退列表），
   message 给人读。code 的取值与 server::Error::code()（src-tauri/src/server/error.rs）一一对应；
   unknown = 壳层之外抛的（浏览器里 invoke 不可用、序列化失败这类）。
   ============================================================================ */

export type ApiErrorCode = 'db' | 'io' | 'notFound' | 'conflict' | 'invalid' | 'unknown'

const CODES: readonly ApiErrorCode[] = ['db', 'io', 'notFound', 'conflict', 'invalid', 'unknown']

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }

  /* 既有展示走 String(error) / 模板串 —— 覆盖掉 Error 默认的 "Error: 前缀"拼法 */
  override toString(): string {
    return this.message
  }
}

/** 壳层回的 { code, message }（或任何意外抛出）→ ApiError。 */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  const shape = err as { code?: unknown; message?: unknown } | null
  if (shape && typeof shape === 'object' && typeof shape.message === 'string') {
    const raw = typeof shape.code === 'string' ? shape.code : ''
    const code = (CODES as readonly string[]).includes(raw) ? (raw as ApiErrorCode) : 'unknown'
    return new ApiError(code, shape.message)
  }
  return new ApiError('unknown', String(err))
}

/** invoke 的拒绝统一在这一层换掉 —— 页面与 hook 拿到的错误永远是 ApiError。 */
export async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    throw toApiError(err)
  }
}
