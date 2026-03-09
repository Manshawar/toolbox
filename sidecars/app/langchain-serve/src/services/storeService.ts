import path from "node:path";
import { watch } from "node:fs";
import fse from "fs-extra";
import { getStorePath } from "../config/env";

const STORE_CONFIG_JSON = "llm_config.json";
const DEBOUNCE_MS = 150;

/**
 * Store 配置服务单例：读取一次 JSON 后监听文件变更并更新内存，对外通过 get() 取缓存。
 */
class StoreService {
  private static instance: StoreService | null = null;

  private cached: unknown | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private unwatch: (() => void) | null = null;

  private constructor() {}

  static getInstance(): StoreService {
    if (StoreService.instance === null) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  private getConfigPath(): string | null {
    const storePath = getStorePath();
    if (!storePath) return null;
    return path.join(path.dirname(storePath), STORE_CONFIG_JSON);
  }

  private async loadIntoCache(): Promise<void> {
    const configPath = this.getConfigPath();
    if (!configPath) return;
    try {
      if (!(await fse.pathExists(configPath))) {
        this.cached = null;
        return;
      }
      this.cached = (await fse.readJson(configPath, { encoding: "utf-8" })) as unknown;
    } catch {
      this.cached = null;
    }
  }

  /** 取当前内存中的 store 配置；文件变更后由监听自动更新后再读即为新数据 */
  get(): unknown | null {
    return this.cached;
  }

  /**
   * 读取一次 store 并开始监听目录下 .json 变更，变更时重新读入内存。
   * 重复调用仅首次生效（单例只启动一次监听）。
   */
  startWatching(): void {
    if (this.unwatch !== null) return;

    const storePath = getStorePath();
    if (!storePath) return;
    const dir = path.dirname(storePath);
    const configPath = this.getConfigPath();
    if (!configPath) return;

    const onFileChange = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        void this.loadIntoCache();
      }, DEBOUNCE_MS);
    };

    try {
      void this.loadIntoCache();
      const watcher = watch(dir, { recursive: false }, (_eventType, filename) => {
        if (filename?.endsWith(".json")) onFileChange();
      });
      this.unwatch = () => {
        watcher.close();
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.unwatch = null;
      };
    } catch {
      // 监听未启动，get() 仍可返回 null 或后续手动再调 startWatching
    }
  }
}

/** 单例：任意处 import 后 storeService.get() / storeService.startWatching() 均为同一实例、同一份缓存 */
export const storeService = StoreService.getInstance();
