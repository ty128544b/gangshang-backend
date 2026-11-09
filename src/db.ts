// SQLite（libsql 文件库）+ drizzle，启动时自动跑 drizzle 迁移。
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

export type AppDb = ReturnType<typeof drizzle<typeof schema>>;

export function dbFilePath(dataDir: string): string {
  return join(dataDir, "gangshang.db");
}

/** 打开数据库并跑完 drizzle/ 下的全部迁移（幂等，重复启动不重复建表）。 */
export async function openDb(
  dataDir: string,
  migrationsDir: string,
): Promise<AppDb> {
  mkdirSync(dataDir, { recursive: true });
  const file = dbFilePath(dataDir);
  const client = createClient({ url: `file:${file}` });
  const db = drizzle(client, { schema });
  // WAL：并发读 + 单写者不互相阻塞；备份前做 checkpoint 再导出。
  await client.execute("PRAGMA journal_mode=WAL;");
  await migrate(db, { migrationsFolder: migrationsDir });
  return db;
}

/** 备份前把 WAL 刷回主文件，保证导出的 .db 文件自包含。 */
export async function checkpoint(db: AppDb): Promise<void> {
  await db.run("PRAGMA wal_checkpoint(TRUNCATE);");
}

/** 若存在恢复文件（管理员通过 /admin/restore 上传），启动时用它替换当前库。
 *  返回 true 表示发生过替换。 */
export function swapRestoredDb(dataDir: string): boolean {
  const restored = join(dataDir, "gangshang.db.restored");
  const current = dbFilePath(dataDir);
  if (!existsSync(restored)) return false;
  if (existsSync(current)) rmSync(current, { force: true });
  const wal = `${current}-wal`;
  const shm = `${current}-shm`;
  if (existsSync(wal)) rmSync(wal, { force: true });
  if (existsSync(shm)) rmSync(shm, { force: true });
  renameSync(restored, current);
  return true;
}

export { schema };
