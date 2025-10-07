import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const dbPath = resolveDbPath(config.dbUrl);
ensureDirectory(dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const init = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      tags TEXT,
      remind_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_search ON notes(title, content);
  `);
};
init();

export default db;

function resolveDbPath(url: string): string {
  if (!url) return ':memory:';
  if (url.startsWith(':memory:')) return ':memory:';
  if (url.startsWith('file:')) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  return url;
}

function ensureDirectory(filePath: string) {
  if (!filePath || filePath === ':memory:') return;
  const dir = path.dirname(path.isAbsolute(filePath) ? filePath : path.resolve(filePath));
  fs.mkdirSync(dir, { recursive: true });
}
