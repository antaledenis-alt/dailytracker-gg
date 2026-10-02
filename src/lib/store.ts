// Глобальное состояние приложения: задачи, настройки, экран, всплывающие сообщения.
// Всё изменяется через функции-действия ниже, сохраняется в SQLite и умеет «Отменить».
import { useSyncExternalStore } from 'react';
import { DB, Series, Status, Task } from './db';
import { addDaysKey, dowKey, todayKey, ts, uid, windowKeys } from './date';
import { readSignInfo, SignInfo } from './signing';
import type { CatKey } from '../theme';

export type Tab = 'today' | 'weeks' | 'stats';

export interface Settings {
  rem: number[]; // напоминания по умолчанию
  insistEvery: number; // минут между настойчивыми повторами
  insistCount: number;
  endCheck: boolean; // спросить результат, когда задача закончилась
  manualSignedAt: number | null; // если срок подписи не удалось прочитать
}

export interface EditorState {
  mode: 'new' | 'edit';
  taskId?: string;
  date?: string;
  start?: number;
}

export interface Toast {
  id: string;
  text: string;
  undo?: () => void;
  tone?: 'ok' | 'info';
}

export interface State {
  tasks: Task[];
  series: Series[];
  settings: Settings;
  sign: SignInfo;
  tab: Tab;
  day: string;
  editor: EditorState | null;
  sheetTask: string | null;
  settingsOpen: boolean;
  toast: Toast | null;
  clock: number; // обновляется раз в 30 секунд, чтобы двигалась линия «сейчас»
}

const DEFAULT_SETTINGS: Settings = { rem: [5, 0], insistEvery: 5, insistCount: 3, endCheck: true, manualSignedAt: null };

let state: State = {
  tasks: DB.allTasks(),
  series: DB.allSeries(),
  settings: { ...DEFAULT_SETTINGS, ...DB.get<Partial<Settings>>('settings', {}) },
  sign: readSignInfo(),
  tab: 'today',
  day: todayKey(),
  editor: null,
  sheetTask: null,
  settingsOpen: false,
  toast: null,
  clock: Date.now(),
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}
export function getState() {
  return state;
}
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useApp(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ---------- изменения задач с возможностью отмены ----------

function findTask(id: string) {
  return state.tasks.find((t) => t.id === id) ?? null;
}

type Before = Map<string, Task | null>;

function apply(put: Task[], del: string[]): Before {
  const before: Before = new Map();
  put.forEach((t) => before.set(t.id, findTask(t.id)));
  del.forEach((id) => before.set(id, findTask(id)));
  const delSet = new Set(del);
  const putMap = new Map(put.map((t) => [t.id, t]));
  let tasks = state.tasks.filter((t) => !delSet.has(t.id)).map((t) => putMap.get(t.id) ?? t);
  put.forEach((t) => {
    if (!before.get(t.id)) tasks.push(t);
  });
  tasks = tasks.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  DB.upsertMany(put);
  del.forEach((id) => DB.deleteTask(id));
  set({ tasks });
  return before;
}

function restore(before: Before) {
  const put: Task[] = [];
  const del: string[] = [];
  before.forEach((t, id) => (t ? put.push(t) : del.push(id)));
  apply(put, del);
  set({ toast: null });
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function showToast(text: string, undo?: () => void, tone: Toast['tone'] = 'ok') {
  if (toastTimer) clearTimeout(toastTimer);
  set({ toast: { id: uid(), text, undo, tone } });
  toastTimer = setTimeout(() => set({ toast: null }), 4000);
}

function commit(put: Task[], del: string[], text?: string) {
  const before = apply(put, del);
  if (text) showToast(text, () => restore(before));
}

// ---------- действия ----------

export interface TaskInput {
  title: string;
  cat: CatKey;
  date: string;
  start: number;
  dur: number;
  rem: number[];
  insist: boolean;
  days: boolean[]; // повтор по дням недели (Пн..Вс), все false = без повтора
}

function makeTask(i: Omit<TaskInput, 'days'>, seriesId: string | null = null): Task {
  return {
    id: uid(), date: i.date, start: i.start, dur: i.dur, cat: i.cat, title: i.title.trim() || 'Без названия',
    status: 'plan', rem: [...i.rem].sort((a, b) => b - a), insist: i.insist, seriesId, updatedAt: Date.now(),
  };
}

export function addTask(i: TaskInput) {
  const put: Task[] = [];
  if (i.days.some(Boolean)) {
    const s: Series = {
      id: uid(), title: i.title.trim() || 'Без названия', cat: i.cat, start: i.start, dur: i.dur, days: i.days,
      rem: i.rem, insist: i.insist, fromDate: i.date, genUntil: addDaysKey(i.date, -1),
    };
    DB.upsertSeries(s);
    set({ series: [...state.series, s] });
    if (!i.days[dowKey(i.date)]) put.push(makeTask(i));
    put.push(...generateSeries(s));
  } else {
    put.push(makeTask(i));
  }
  commit(put, [], put.length > 1 ? 'Добавлено задач: ' + put.length : 'Задача добавлена');
}

export function updateTask(id: string, i: Omit<TaskInput, 'days'>) {
  const t = findTask(id);
  if (!t) return;
  const changedTime = t.date !== i.date || t.start !== i.start;
  const nt: Task = {
    ...t, title: i.title.trim() || 'Без названия', cat: i.cat, date: i.date, start: i.start, dur: i.dur,
    rem: [...i.rem].sort((a, b) => b - a), insist: i.insist, updatedAt: Date.now(),
    status: changedTime && t.status === 'missed' ? 'plan' : t.status,
  };
  commit([nt], [], 'Изменения сохранены');
}

export function deleteTask(id: string, withSeries = false) {
  const t = findTask(id);
  if (!t) return;
  const del = [id];
  if (withSeries && t.seriesId) {
    state.tasks.forEach((x) => {
      if (x.seriesId === t.seriesId && x.status === 'plan' && x.id !== id) del.push(x.id);
    });
    DB.deleteSeries(t.seriesId);
    set({ series: state.series.filter((s) => s.id !== t.seriesId) });
  }
  commit([], del, del.length > 1 ? 'Удалено с повторами' : 'Задача удалена');
}

const STATUS_TEXT: Record<Status, string> = {
  done: 'Отмечено: выполнено вовремя',
  late: 'Отмечено: выполнено позже',
  missed: 'Задача пропущена',
  plan: 'Возвращено в план',
};

export function setStatus(id: string, status: Status, silent = false) {
  const t = findTask(id);
  if (!t) return;
  // «Вернуть в план» для уже прошедшей задачи не имеет смысла — она снова станет пропущенной.
  if (status === 'plan' && ts(t.date, t.start + t.dur) < Date.now()) status = 'missed';
  commit([{ ...t, status, updatedAt: Date.now() }], [], silent ? undefined : STATUS_TEXT[status]);
}

export function moveTask(id: string, date: string, start: number, text?: string) {
  const t = findTask(id);
  if (!t) return;
  const s = Math.max(0, Math.min(24 * 60 - t.dur, start));
  commit([{ ...t, date, start: s, status: 'plan', updatedAt: Date.now() }], [], text);
}

/** Сдвигает задачу и все следующие за ней в этот день. */
export function shiftAfter(id: string, minutes: number) {
  const t = findTask(id);
  if (!t) return;
  const put = state.tasks
    .filter((x) => x.date === t.date && x.status === 'plan' && x.start >= t.start)
    .map((x) => ({ ...x, start: Math.min(24 * 60 - x.dur, x.start + minutes), updatedAt: Date.now() }));
  commit(put, [], 'Сдвинуто задач: ' + put.length + ' · +' + minutes + ' мин');
}

export function applyTemplate(date: string, kind: 'work' | 'free') {
  const T = (start: number, dur: number, cat: CatKey, title: string, insist = false) =>
    makeTask({ title, cat, date, start, dur, rem: state.settings.rem, insist });
  const put =
    kind === 'work'
      ? [
          T(7 * 60 + 30, 30, 'sport', 'Зарядка'),
          T(9 * 60, 180, 'work', 'Фокус-блок', true),
          T(13 * 60, 60, 'rest', 'Обед и прогулка'),
          T(14 * 60, 120, 'work', 'Встречи и задачи'),
          T(18 * 60, 90, 'sport', 'Тренировка', true),
          T(20 * 60, 60, 'hobby', 'Хобби'),
          T(22 * 60, 30, 'rest', 'Чтение без экрана'),
        ]
      : [
          T(9 * 60 + 30, 60, 'sport', 'Прогулка или бег'),
          T(11 * 60, 120, 'hobby', 'Хобби / свой проект'),
          T(14 * 60, 60, 'study', 'Учёба'),
          T(16 * 60, 180, 'rest', 'Отдых, друзья'),
        ];
  commit(put, [], 'Шаблон добавлен — меняй под себя');
}

// ---------- повторяющиеся задачи и автопропуск ----------

function generateSeries(s: Series): Task[] {
  const win = windowKeys();
  const end = win[13];
  const out: Task[] = [];
  let d = addDaysKey(s.genUntil, 1);
  if (d < s.fromDate) d = s.fromDate;
  while (d <= end) {
    if (s.days[dowKey(d)]) out.push(makeTask({ title: s.title, cat: s.cat, date: d, start: s.start, dur: s.dur, rem: s.rem, insist: s.insist }, s.id));
    d = addDaysKey(d, 1);
  }
  const ns = { ...s, genUntil: end };
  DB.upsertSeries(ns);
  state = { ...state, series: state.series.map((x) => (x.id === s.id ? ns : x)) };
  return out;
}

export function ensureSeries() {
  const put: Task[] = [];
  state.series.forEach((s) => put.push(...generateSeries(s)));
  if (put.length) apply(put, []);
}

/** Задача, которую так и не отметили после окончания, считается пропущенной. */
export function sweepMissed() {
  const now = Date.now();
  const put = state.tasks
    .filter((t) => t.status === 'plan' && ts(t.date, t.start + t.dur) < now)
    .map((t) => ({ ...t, status: 'missed' as Status, updatedAt: now }));
  if (put.length) apply(put, []);
}

export function tick() {
  const today = todayKey();
  const patch: Partial<State> = { clock: Date.now() };
  // Если наступил новый день, а пользователь смотрел «сегодня» — переключаемся.
  if (state.day < today && state.tab === 'today' && !state.editor && !state.sheetTask) patch.day = today;
  set(patch);
  sweepMissed();
  ensureSeries();
}

export function refreshSign() {
  set({ sign: readSignInfo() });
}

// ---------- настройки и навигация ----------

export function updateSettings(p: Partial<Settings>) {
  const settings = { ...state.settings, ...p };
  DB.set('settings', settings);
  set({ settings });
}

/** Когда истекает подпись: из профиля, иначе — по отметке «я переподписал». */
export function signExpiry(s: State = state): number | null {
  if (s.sign.expiresAt) return s.sign.expiresAt;
  if (s.settings.manualSignedAt) return s.settings.manualSignedAt + 7 * 24 * 3600000;
  return null;
}

export const nav = {
  tab: (tab: Tab) => set({ tab }),
  day: (day: string) => set({ day }),
  openDay: (day: string) => set({ day, tab: 'today' }),
  editor: (editor: EditorState | null) => set({ editor, sheetTask: null }),
  sheet: (sheetTask: string | null) => set({ sheetTask }),
  settings: (settingsOpen: boolean) => set({ settingsOpen }),
  hideToast: () => set({ toast: null }),
};

export function findTaskById(id: string | null) {
  return id ? findTask(id) : null;
}

// Первичная подготовка при запуске.
sweepMissed();
ensureSeries();
