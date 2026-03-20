export interface StandardResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 统一返回结构：
 * - 前端 axios 拦截器按 `code / message / data` 解析
 * - 成功：code=1
 * - 失败：code=-1，data=null
 */
export function success<T>(data: T, message = "ok", code = 200): StandardResponse<T> {
  return { code, message, data };
}

export function fail(message: string, data: unknown = null, code = 500): StandardResponse<unknown> {
  return { code, message, data };
}

