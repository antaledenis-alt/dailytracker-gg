// Работа с датами без внешних библиотек. Ключ дня — строка YYYY-MM-DD в местном времени.

export const DN = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const DFULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const pad = (n: number) => (n < 10 ? '0' : '') + n;

export function dkey(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
export function fromKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return r;
}
export function addDaysKey(k: string, n: number): string {
  return dkey(addDays(fromKey(k), n));
}
/** Индекс дня недели, понедельник = 0. */
export function dow(d: Date): number {
  return (d.getDay() + 6) % 7;
}
export function dowKey(k: string): number {
  return dow(fromKey(k));
}
export function startOfWeek(d: Date): Date {
  return addDays(d, -dow(d));
}
export function todayKey(): string {
  return dkey(new Date());
}
/** 14 дней: эта неделя (с понедельника) и следующая. */
export function windowKeys(base = new Date()): string[] {
  const mon = startOfWeek(base);
  return Array.from({ length: 14 }, (_, i) => dkey(addDays(mon, i)));
}
export function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}
/** Время начала задачи в мс. */
export function ts(dateKey: string, min: number): number {
  const d = fromKey(dateKey);
  return d.getTime() + min * 60000;
}
export function fmt(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return h + ':' + pad(mm);
}
export function durTxt(d: number): string {
  const h = Math.floor(d / 60);
  const m = d % 60;
  return (h ? h + ' ч' : '') + (h && m ? ' ' : '') + (m ? m + ' мин' : '') || '0 мин';
}
export function hoursTxt(min: number): string {
  const v = Math.round(min / 30) / 2;
  return String(v).replace('.', ',') + ' ч';
}
export function dayTitle(k: string): string {
  const d = fromKey(k);
  return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()];
}
export function shortDate(k: string): string {
  const d = fromKey(k);
  return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
}
export function relLabel(k: string): string {
  const t = todayKey();
  if (k === t) return 'сегодня';
  if (k === addDaysKey(t, 1)) return 'завтра';
  if (k === addDaysKey(t, -1)) return 'вчера';
  return '';
}
export function rangeLabel(a: string, b: string): string {
  const da = fromKey(a);
  const db = fromKey(b);
  if (da.getMonth() === db.getMonth()) return da.getDate() + ' – ' + db.getDate() + ' ' + MONTHS_SHORT[db.getMonth()];
  return shortDate(a) + ' – ' + shortDate(b);
}
export function dateTimeTxt(t: number): string {
  const d = new Date(t);
  return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ', ' + d.getHours() + ':' + pad(d.getMinutes());
}
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
