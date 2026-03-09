import path from "node:path";
import { watch } from "node:fs";
import _ from "lodash";

/** 单个文件的读取描述：给定路径，返回读取结果 */
export type FileReader = (filePath: string) => Promise<unknown>;

/**
 * 配置项：键为文件路径（查询用），值为该路径的读取方法。
 * 查询时用路径取缓存；文件变更时重新读取并更新缓存。
 */
export type WatchedFileCacheConfig = Record<string, FileReader>;

const DEBOUNCE_MS = 150;

/**
 * 单例：按路径监听文件，内存缓存 + 变更时重新读取。
 * - new/初始化时传入「路径 -> 读取方法」对象
 * - get(path)：未变则返回内存缓存，已变则返回最新读取结果（由监听自动更新）
 * - startWatching()：开始监听，重复调用仅首次生效
 */
export class WatchedFileCache {
  private static instance: WatchedFileCache | null = null;

  /** 路径 -> 当前缓存值 */
  private readonly cache = new Map<string, unknown | null>();

  /** 路径 -> 该路径的读取方法 */
  private readonly readers: Map<string, FileReader> = new Map();

  /** 目录 -> 该目录下需要监听的路径列表 */
  private readonly pathsByDir: Map<string, string[]>;

  /** 目录 -> 防抖后的重载函数 */
  private readonly debouncedReloadByDir = new Map<
    string,
    ReturnType<typeof _.debounce>
  >();

  /** 目录 -> 取消监听的函数 */
  private readonly unwatchers = new Map<string, () => void>();

  private constructor(config: WatchedFileCacheConfig) {
    _.forEach(config, (reader, filePath) => {
      this.readers.set(filePath, reader);
      this.cache.set(filePath, null);
    });

    const grouped = _.groupBy(Object.keys(config), (p) => path.dirname(p));
    this.pathsByDir = new Map(Object.entries(grouped) as [string, string[]][]);

    this.pathsByDir.forEach((paths, dir) => {
      this.debouncedReloadByDir.set(
        dir,
        _.debounce(() => {
          _.forEach(paths, (p) => void this.loadPath(p));
        }, DEBOUNCE_MS),
      );
    });
  }

  /**
   * 获取单例。首次调用时传入配置（路径 -> 读取方法），之后可传空对象。
   */
  static getInstance(config: WatchedFileCacheConfig): WatchedFileCache {
    if (WatchedFileCache.instance === null) {
      WatchedFileCache.instance = new WatchedFileCache(config);
    }
    return WatchedFileCache.instance;
  }

  /**
   * 按路径取当前值：未变则来自内存，已变则由监听更新后再取即为最新。
   */
  get(filePath: string): unknown | null {
    return this.cache.get(filePath) ?? null;
  }

  /**
   * 对指定路径执行一次读取并写入缓存。
   */
  private async loadPath(filePath: string): Promise<void> {
    const reader = this.readers.get(filePath);
    if (!reader) return;

    try {
      const value = await reader(filePath);
      this.cache.set(filePath, value);
    } catch {
      this.cache.set(filePath, null);
    }
  }

  /**
   * 目录下某文件变更时，对该目录下所有配置过的路径重新读取（防抖）。
   */
  private scheduleReloadForDir(dir: string): void {
    this.debouncedReloadByDir.get(dir)?.();
  }

  /**
   * 开始监听所有配置路径所在目录；文件变更时自动重新读取并更新缓存。
   * 重复调用仅首次生效。
   */
  startWatching(): void {
    this.pathsByDir.forEach((pathsInDir, dir) => {
      if (this.unwatchers.has(dir)) return;

      try {
        _.forEach(pathsInDir, (p) => void this.loadPath(p));

        const watcher = watch(dir, { recursive: false }, (_eventType, filename) => {
          if (!filename) return;
          const fullPath = path.join(dir, filename);
          if (this.readers.has(fullPath)) this.scheduleReloadForDir(dir);
        });

        this.unwatchers.set(dir, () => {
          watcher.close();
          this.debouncedReloadByDir.get(dir)?.cancel();
          this.debouncedReloadByDir.delete(dir);
          this.unwatchers.delete(dir);
        });
      } catch {
        // 该目录监听失败，其他目录照常
      }
    });
  }
}
