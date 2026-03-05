import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** 与前端 src/sql/schema 的 test 表一致 */
export const testTable = sqliteTable("test", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
});

export type TestRow = typeof testTable.$inferSelect;
export type TestInsert = typeof testTable.$inferInsert;
