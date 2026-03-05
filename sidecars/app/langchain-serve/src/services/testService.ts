import { getDb } from "../db/connection";
import { getAllFromTest } from "../db/queries/test";

export function listTest(): unknown[] {
  const db = getDb();
  if (!db) return [];
  return getAllFromTest(db);
}
