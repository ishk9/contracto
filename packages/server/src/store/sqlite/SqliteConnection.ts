import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export class SqliteConnection {
  readonly db: DatabaseType;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.setPragmas();
    this.runMigrations();
  }

  private setPragmas(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
  }

  private runMigrations(): void {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationPath = join(__dirname, 'migrations', '001_initial.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    this.db.exec(sql);
  }

  close(): void {
    this.db.close();
  }
}
