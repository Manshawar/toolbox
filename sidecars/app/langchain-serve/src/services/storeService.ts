import fs from "fs/promises";
import { getStorePath } from "../config/env";

export async function readStore(): Promise<unknown | null> {
  const storePath = getStorePath();
  if (!storePath) return null;
  try {
    const raw = await fs.readFile(storePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
