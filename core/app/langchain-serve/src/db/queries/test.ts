import type { Database } from "better-sqlite3";
import type { TestRow } from "../schema";

export function getAllFromTest(db: Database): TestRow[] {
  const rows = db.prepare("SELECT * FROM test").all() as unknown as TestRow[];
  return rows;
}
