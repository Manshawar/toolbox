import path from "node:path";
import fse from "fs-extra";
import { getStorePath } from "../config/env";
import { WatchedFileCache } from "../utils/watchedFileCache";



/** 构建 store 配置文件的绝对路径；无 store 目录时返回 null */
function getStoreConfigPath(): string | null {
  const storePath = getStorePath();
  if (!storePath) return null;
  return path.join(path.dirname(storePath));
}

/** 读取 JSON 配置的通用方法，供 WatchedFileCache 使用 */
async function readStoreConfig(filePath: string): Promise<unknown> {
  debugger;
  const exists = await fse.pathExists(filePath);
  if (!exists) return null;
  return fse.readJson(filePath, { encoding: "utf-8" }) as Promise<unknown>;
}

/** 懒加载的缓存单例：仅在首次 get/startWatching 且路径有效时创建 */
function getStoreFileCache(): WatchedFileCache | null {
  const configPath = getStoreConfigPath();
  if (!configPath) return null;

  const config = {
    [configPath]: readStoreConfig,
  };
  return WatchedFileCache.getInstance(config);
}

/**
 * Store 配置服务：基于 WatchedFileCache 封装。
 * - get()：取当前内存中的 store 配置（文件变更后由监听自动更新）
 * - startWatching()：开始监听配置所在目录，变更时重新读入
 */
export function getStoreConfig(): unknown | null {
  const cache = getStoreFileCache();
  if (!cache) return null;

  const configPath = getStoreConfigPath();
  return configPath ? cache.get(configPath) ?? null : null;
}

/**
 * 开始监听 store 配置目录；重复调用仅首次生效。
 */
export function startWatchingStore(): void {
  const cache = getStoreFileCache();
  if (!cache) return;
  cache.startWatching();
}
