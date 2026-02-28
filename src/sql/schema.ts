import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** 与 createTable 中建表语句一致 */
export const testTable = sqliteTable("test", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
});

export type TestRow = typeof testTable.$inferSelect;
export type TestInsert = typeof testTable.$inferInsert;
