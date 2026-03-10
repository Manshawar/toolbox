import fse from "fs-extra";
import { getStorePath } from "../config/env";
import { createWatchedFileCache } from "../utils/watchedFileCache";

function getConfigPath(): string | null {
  return getStorePath() ?? null;
}

const readJson = async (p: string): Promise<unknown> => {
  if (!(await fse.pathExists(p))) return null;
  return fse.readJson(p, { encoding: "utf-8" }) as Promise<unknown>;
};

let cache: ReturnType<typeof createWatchedFileCache> | null = null;
const getCache = () => {
  if (!cache) {
    const p = getConfigPath();
    if (p) cache = createWatchedFileCache(p, readJson);
  }
  return cache;
};

export const getStoreConfig = (): unknown | null => getCache()?.get() ?? null;
export const startWatchingStore = (): void => getCache()?.startWatching();
