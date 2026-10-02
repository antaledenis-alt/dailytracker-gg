// Локальные уведомления: напоминания о задачах, настойчивые повторы, вопрос «как прошло?»
// и напоминание о переподписи. Всё планируется на самом телефоне — сервер не нужен.
// iOS хранит не больше 64 запланированных уведомлений, поэтому держим «окно» ближайших 60
// и пересобираем его при каждом изменении и при открытии приложения.
import * as Notifications from 'expo-notifications';
import type { Task } from './db';
import { dateTimeTxt, fmt, ts } from './date';
import { CATS } from '../theme';
import type { Settings } from './store';

export const CAT_TASK = 'task';
export const CAT_END = 'task_end';
const LIMIT = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  let granted = cur.granted;
  if (!granted && cur.canAskAgain) {
    const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    granted = r.granted;
  }
  await Notifications.setNotificationCategoryAsync(CAT_TASK, [
    { identifier: 'done', buttonTitle: 'Готово', options: { opensAppToForeground: false } },
    { identifier: 'snooze', buttonTitle: '+10 минут', options: { opensAppToForeground: false } },
    { identifier: 'open', buttonTitle: 'Перенести…', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync(CAT_END, [
    { identifier: 'done', buttonTitle: 'Сделано вовремя', options: { opensAppToForeground: false } },
    { identifier: 'late', buttonTitle: 'Сделал позже', options: { opensAppToForeground: false } },
    { identifier: 'tomorrow', buttonTitle: 'Перенести на завтра', options: { opensAppToForeground: false } },
  ]);
  return granted;
}

interface Item {
  at: number;
  title: string;
  body: string;
  category?: string;
  data: Record<string, string>;
}

function taskItems(t: Task, s: Settings, now: number): Item[] {
  const out: Item[] = [];
  const start = ts(t.date, t.start);
  const end = ts(t.date, t.start + t.dur);
  const body = fmt(t.start) + '–' + fmt(t.start + t.dur) + ' · ' + CATS[t.cat].name;
  const data = { taskId: t.id };
  t.rem.forEach((off) => {
    out.push({
      at: start - off * 60000,
      title: off === 0 ? 'Начинается: ' + t.title : 'Через ' + off + ' мин: ' + t.title,
      body, category: CAT_TASK, data: { ...data, kind: 'rem' },
    });
  });
  if (t.insist) {
    for (let i = 1; i <= s.insistCount; i++) {
      const at = start + i * s.insistEvery * 60000;
      if (at >= end) break;
      out.push({
        at,
        title: 'Повтор ' + i + ' из ' + s.insistCount + ' · ' + t.title,
        body: 'Началось ' + i * s.insistEvery + ' мин назад. Отметь выполнение или перенеси',
        category: CAT_TASK, data: { ...data, kind: 'insist' },
      });
    }
  }
  if (s.endCheck) {
    out.push({ at: end, title: '«' + t.title + '» закончилось', body: 'Как прошло? Отметь результат — это влияет на итоги', category: CAT_END, data: { ...data, kind: 'end' } });
  }
  return out.filter((x) => x.at > now + 1500);
}

function signItems(expiry: number | null, now: number): Item[] {
  if (!expiry) return [];
  const when = dateTimeTxt(expiry);
  const steps = [
    { before: 24 * 3600000, title: 'Завтра нужно переподписать приложение' },
    { before: 3 * 3600000, title: 'Через 3 часа истекает подпись приложения' },
    { before: 30 * 60000, title: 'Подпись истекает через 30 минут' },
  ];
  return steps
    .map((st) => ({
      at: expiry - st.before,
      title: st.title,
      body: 'Срок: ' + when + '. Открой SideStore → My Apps → Refresh All, затем открой Планер.',
      data: { kind: 'sign' },
    }))
    .filter((x) => x.at > now + 1500);
}

let running: Promise<void> | null = null;
let pending: [Task[], Settings, number | null] | null = null;

/** Пересобирает очередь уведомлений. Вызовы во время работы склеиваются в один. */
export async function syncNotifications(tasks: Task[], s: Settings, signExpiry: number | null): Promise<void> {
  if (running) {
    pending = [tasks, s, signExpiry];
    return running;
  }
  running = (async () => {
    try {
      const now = Date.now();
      const horizon = now + 15 * 24 * 3600000;
      const sign = signItems(signExpiry, now);
      const items = tasks
        .filter((t) => t.status === 'plan' && ts(t.date, t.start) < horizon && ts(t.date, t.start + t.dur) > now - 60000)
        .flatMap((t) => taskItems(t, s, now))
        .sort((a, b) => a.at - b.at)
        .slice(0, LIMIT - sign.length);
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const it of [...sign, ...items]) {
        await Notifications.scheduleNotificationAsync({
          content: { title: it.title, body: it.body, data: it.data, categoryIdentifier: it.category, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(it.at) },
        });
      }
    } catch (e) {
      console.warn('notifications sync failed', e);
    }
  })();
  await running;
  running = null;
  if (pending) {
    const p = pending;
    pending = null;
    await syncNotifications(p[0], p[1], p[2]);
  }
}

export async function snooze(t: Task, minutes = 10) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Напоминаю: ' + t.title,
      body: 'Отложено на ' + minutes + ' мин · ' + fmt(t.start) + '–' + fmt(t.start + t.dur),
      data: { taskId: t.id, kind: 'snooze' },
      categoryIdentifier: CAT_TASK,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 },
  });
}

export async function testNotification() {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Проверка уведомлений', body: 'Всё работает. Так будут выглядеть напоминания о задачах.', categoryIdentifier: CAT_TASK, data: { kind: 'test' }, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
}
