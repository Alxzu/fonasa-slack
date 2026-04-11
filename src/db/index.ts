import { join } from "node:path";
import { SQL } from "bun";
import { logger } from "../logger";

const log = logger.child({ module: "db" });

let db: SQL | null = null;

export function getDb(): SQL {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    db = new SQL({ url });
    log.info("Database connection created");
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    log.info("Database connection closed");
  }
}

export async function runMigrations(sql: SQL): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  const migrationsDir = join(import.meta.dir, "..", "migrations");
  const glob = new Bun.Glob("*.sql");
  const files: string[] = [];
  for await (const file of glob.scan(migrationsDir)) {
    files.push(file);
  }
  files.sort();

  const applied = await sql`SELECT name FROM _migrations`;
  const appliedSet = new Set(applied.map((r: { name: string }) => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    log.info({ migration: file }, "Applying migration");
    const content = await Bun.file(join(migrationsDir, file)).text();

    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    });

    log.info({ migration: file }, "Migration applied");
  }
}
