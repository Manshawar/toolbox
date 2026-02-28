import { getTauriDb } from "./adapter";
import { db, testTable } from "./db";

export const testSql = async () => {
  const rows = await db.select().from(testTable).all();
  return rows;
};

export const createTable = async () => {
  try {
    const tauriDb = await getTauriDb();
    await tauriDb.execute(
      "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)"
    );
    return "Table created";
  } catch (error) {
    console.error(error);
    return "Table created failed";
  }
};

export const insertData = async (name = "test") => {
  try {
    await db.insert(testTable).values({ name }).run();
    return "Data inserted";
  } catch (error) {
    console.error(error);
    return "Data inserted failed";
  }
};

export const queryData = async () => {
  try {
    const rows = await db.select().from(testTable).all();
    console.log(rows);
    return rows;
  } catch (error) {
    console.error(error);
    return "Query data failed";
  }
};

export { db, testTable };
export type { TestRow, TestInsert } from "./schema";
