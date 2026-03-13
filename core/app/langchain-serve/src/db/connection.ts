/**
 * better-sqlite3 单例，仅在 DB_PATH 存在时创建
 */
import Database from "better-sqlite3";
import { getDbPath } from "../config/env";
import { logger } from "../utils/logger";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database | null {
  const dbPath = getDbPath();
  if (!dbPath) {
    logger.debug("db: DB_PATH not set, database disabled");
    return null;
  }
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    logger.info({ dbPath }, "db: opened");
  }
  return dbInstance;
}
