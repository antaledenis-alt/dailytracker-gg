// Подсчёт итогов: процент выполнения и продуктивность.
// Вовремя = 1 балл, позже = 0,5, пропуск = 0. Учитываются только завершённые задачи.
import type { Task } from './db';
import { addDaysKey, dkey, DN, fromKey, startOfWeek, todayKey } from './date';
import { CAT_ORDER, CatKey } from '../theme';

export type Period = 'week' | 'days14';

export interface DayBar {
  key: string;
  label: string;
  on: number;
  late: number;
  miss: number;
}

export interface Stats {
  on: number;
  late: number;
  miss: number;
  total: number;
  completion: number; // %
  score: number; // 0..100
  days: DayBar[];
  cats: { cat: CatKey; pct: number; minutes: number; total: number }[];
  insight: string | null;
  delta: number | null; // изменение продуктивности к прошлому такому же периоду
  from: string;
  to: string;
}

function rangeFor(period: Period, shift = 0): string[] {
  const today = todayKey();
  if (period === 'week') {
    const mon = dkey(startOfWeek(fromKey(today)));
    const from = addDaysKey(mon, -7 * shift);
    const len = Math.round((fromKey(today).getTime() - fromKey(mon).getTime()) / 86400000) + 1;
    return Array.from({ length: len }, (_, i) => addDaysKey(from, i));
  }
  const from = addDaysKey(today, -13 - 14 * shift);
  return Array.from({ length: 14 }, (_, i) => addDaysKey(from, i));
}

function score(list: Task[]) {
  const on = list.filter((t) => t.status === 'done').length;
  const late = list.filter((t) => t.status === 'late').length;
  const miss = list.filter((t) => t.status === 'missed').length;
  const total = on + late + miss;
  return { on, late, miss, total, score: total ? Math.round(((on + late * 0.5) / total) * 100) : 0 };
}

export function computeStats(tasks: Task[], period: Period): Stats {
  const keys = rangeFor(period);
  const set = new Set(keys);
  const fin = tasks.filter((t) => set.has(t.date) && t.status !== 'plan');
  const s = score(fin);

  const days: DayBar[] = keys.map((k) => {
    const l = fin.filter((t) => t.date === k);
    const d = fromKey(k);
    return {
      key: k,
      label: period === 'week' ? DN[(d.getDay() + 6) % 7] : String(d.getDate()),
      on: l.filter((t) => t.status === 'done').length,
      late: l.filter((t) => t.status === 'late').length,
      miss: l.filter((t) => t.status === 'missed').length,
    };
  });

  const cats = CAT_ORDER.map((cat) => {
    const l = fin.filter((t) => t.cat === cat);
    const ok = l.filter((t) => t.status !== 'missed');
    return { cat, total: l.length, pct: l.length ? Math.round((ok.length / l.length) * 100) : 0, minutes: ok.reduce((a, t) => a + t.dur, 0) };
  }).filter((c) => c.total > 0);

  // Подсказка: что пропускается чаще всего.
  const byTitle = new Map<string, { miss: number; all: number }>();
  fin.forEach((t) => {
    const v = byTitle.get(t.title) ?? { miss: 0, all: 0 };
    v.all++;
    if (t.status === 'missed') v.miss++;
    byTitle.set(t.title, v);
  });
  let insight: string | null = null;
  let worst = 0;
  byTitle.forEach((v, title) => {
    if (v.miss >= 2 && v.miss / v.all >= 0.5 && v.miss > worst) {
      worst = v.miss;
      insight = '«' + title + '» пропущено ' + v.miss + ' из ' + v.all + ' раз. Возможно, стоит перенести на другое время или сделать короче.';
    }
  });

  const prevKeys = new Set(rangeFor(period, 1));
  const prev = score(tasks.filter((t) => prevKeys.has(t.date) && t.status !== 'plan'));
  const delta = prev.total && s.total ? s.score - prev.score : null;

  return {
    ...s,
    completion: s.total ? Math.round(((s.on + s.late) / s.total) * 100) : 0,
    days, cats, insight, delta, from: keys[0], to: keys[keys.length - 1],
  };
}

export function dayProgress(tasks: Task[], day: string) {
  const l = tasks.filter((t) => t.date === day);
  const done = l.filter((t) => t.status === 'done' || t.status === 'late').length;
  return { done, total: l.length, pct: l.length ? Math.round((done / l.length) * 100) : 0 };
}
