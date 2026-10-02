// Локальная база SQLite: задачи, повторяющиеся серии и настройки. Всё хранится только на телефоне.
import * as SQLite from 'expo-sqlite';
import type { CatKey } from '../theme';

export type Status = 'plan' | 'done' | 'late' | 'missed';

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  start: number; // минуты от полуночи
  dur: number; // минуты
  cat: CatKey;
  title: string;
  status: Status;
  rem: number[]; // за сколько минут напомнить (0 = в момент начала)
  insist: boolean;
  seriesId: string | null;
  updatedAt: number;
}

export interface Series {
  id: string;
  title: string;
  cat: CatKey;
  start: number;
  dur: number;
  days: boolean[]; // Пн..Вс
  rem: number[];
  insist: boolean;
  fromDate: string;
  genUntil: string; // до какого дня включительно уже созданы задачи
}

const db = SQLite.openDatabaseSync('planner.db');

db.execSync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  start INTEGER NOT NULL,
  dur INTEGER NOT NULL,
  cat TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  rem TEXT NOT NULL,
  insist INTEGER NOT NULL,
  series_id TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_date ON tasks(date);
CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY NOT NULL,
  v TEXT NOT NULL
);
`);

type Row = {
  id: string; date: string; start: number; dur: number; cat: string; title: string;
  status: string; rem: string; insist: number; series_id: string | null; updated_at: number;
};

function toTask(r: Row): Task {
  return {
    id: r.id, date: r.date, start: r.start, dur: r.dur, cat: r.cat as CatKey, title: r.title,
    status: r.status as Status, rem: JSON.parse(r.rem), insist: !!r.insist, seriesId: r.series_id, updatedAt: r.updated_at,
  };
}

export const DB = {
  allTasks(): Task[] {
    return db.getAllSync<Row>('SELECT * FROM tasks ORDER BY date, start').map(toTask);
  },
  upsertTask(t: Task) {
    db.runSync(
      `INSERT OR REPLACE INTO tasks (id, date, start, dur, cat, title, status, rem, insist, series_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t.id, t.date, t.start, t.dur, t.cat, t.title, t.status, JSON.stringify(t.rem), t.insist ? 1 : 0, t.seriesId, t.updatedAt,
    );
  },
  upsertMany(ts: Task[]) {
    if (!ts.length) return;
    db.withTransactionSync(() => ts.forEach((t) => DB.upsertTask(t)));
  },
  deleteTask(id: string) {
    db.runSync('DELETE FROM tasks WHERE id = ?', id);
  },
  allSeries(): Series[] {
    return db.getAllSync<{ data: string }>('SELECT data FROM series').map((r) => JSON.parse(r.data));
  },
  upsertSeries(s: Series) {
    db.runSync('INSERT OR REPLACE INTO series (id, data) VALUES (?, ?)', s.id, JSON.stringify(s));
  },
  deleteSeries(id: string) {
    db.runSync('DELETE FROM series WHERE id = ?', id);
  },
  get<T>(k: string, fallback: T): T {
    const r = db.getFirstSync<{ v: string }>('SELECT v FROM kv WHERE k = ?', k);
    if (!r) return fallback;
    try {
      return JSON.parse(r.v) as T;
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    db.runSync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', k, JSON.stringify(v));
  },
};
