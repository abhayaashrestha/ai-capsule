import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH || './data/capsules.db';

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS capsules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    prompt_title TEXT NOT NULL,
    prompt_version TEXT,
    prompt_text TEXT NOT NULL,
    response_summary TEXT,
    category TEXT,
    usefulness TEXT,
    reviewed INTEGER DEFAULT 0,
    improved INTEGER DEFAULT 0,
    screenshot_url TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_capsules_user ON capsules(user_id);');

console.log(`SQLite ready at ${dbPath}`);

export default db;
