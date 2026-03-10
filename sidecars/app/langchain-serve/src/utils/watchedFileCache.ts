import path from "node:path";
import { watch } from "node:fs";

const DEBOUNCE_MS = 150;

export type ReadFile = (filePath: string) => Promise<unknown>;

/**
 * 单文件监听缓存：内部完成 load / 防抖重载 / watch，对外只暴露 get 与 startWatching。
 */
export function createWatchedFileCache(
  filePath: string,
  readFile: ReadFile
): { get(): unknown | null; startWatching(): void } {
  let cached: unknown | null = null;
  let watcher: ReturnType<typeof watch> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);

  async function load(): Promise<void> {
    try {
      cached = await readFile(filePath);
    } catch {
      cached = null;
    }
  }

  function reloadDebounced(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void load();
    }, DEBOUNCE_MS);
  }

  return {
    get: () => cached,
    startWatching() {
      if (watcher) return;
      void load();
      watcher = watch(dir, { recursive: false }, (_, filename) => {
        if (filename === basename) reloadDebounced();
      });
    },
  };
}
