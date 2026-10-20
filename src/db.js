import { DatabaseSync } from 'node:sqlite'; // built into Node 22.13+, no native build needed
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dbPath =
  process.env.DB_PATH ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'quran.db');
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export function transaction(fn) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS surahs (
      id INTEGER PRIMARY KEY,
      name_arabic TEXT NOT NULL,
      name_english TEXT NOT NULL,
      name_translation TEXT,
      revelation_type TEXT,
      ayah_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ayahs (
      id INTEGER PRIMARY KEY,           -- 1..6236 (global ayah number)
      surah_id INTEGER NOT NULL REFERENCES surahs(id),
      ayah_number INTEGER NOT NULL,
      text_arabic TEXT NOT NULL,      -- Uthmani text with full tashkeel, unmodified
      text_plain TEXT NOT NULL,       -- same text without harakat, for searching only
      juz INTEGER,
      page INTEGER,
      UNIQUE (surah_id, ayah_number)
    );
    CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ayah_id INTEGER NOT NULL REFERENCES ayahs(id),
      language TEXT NOT NULL,
      translator TEXT NOT NULL,
      text TEXT NOT NULL,
      UNIQUE (ayah_id, translator)
    );
    CREATE INDEX IF NOT EXISTS idx_ayahs_juz ON ayahs(juz);
    CREATE INDEX IF NOT EXISTS idx_tr_ayah ON translations(ayah_id);
  `);
}
