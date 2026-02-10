import { invoke } from '@tauri-apps/api/core';

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI__;
}

/**
 * 从 Tauri Store 读取指定 key 的值（JSON 兼容类型）。
 * 一次 invoke 完成，非 Tauri 环境或出错时返回 null，调用方无需关心实现。
 */
export async function read<T = unknown>(path: string, key: string): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const value = await invoke<unknown | null>('store_read', { path, key });
    return (value ?? null) as T | null;
  } catch (e) {
    console.warn(`[tauri-store] read failed: ${path}#${key}`, e);
    return null;
  }
}

/**
 * 将值写入 Tauri Store 的指定 key 并落盘（value 需 JSON 可序列化）。
 * 一次 invoke 完成，非 Tauri 环境或出错时静默跳过，调用方无需关心实现。
 */
export async function write(path: string, key: string, value: unknown): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('store_write', { path, key, value });
  } catch (e) {
    console.warn(`[tauri-store] write failed: ${path}#${key}`, e);
  }
}

/**
 * 先读当前值，用 updater 得到新值后再写入。
 * 适合局部更新：read → 合并/修改 → write，调用方无需关心读写细节。
 */
export async function update<T = unknown>(
  path: string,
  key: string,
  updater: (current: T | null) => T,
): Promise<void> {
  const current = await read<T>(path, key);
  const next = updater(current);
  await write(path, key, next);
}
