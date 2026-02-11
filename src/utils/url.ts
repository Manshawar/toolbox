/** 是否为完整 URL（http/https） */
export function isUrl(path: string): boolean {
  return /^https?:\/\//.test(path);
}
