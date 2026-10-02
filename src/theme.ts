// Визуальный язык приложения: цвета, категории, шрифты и параметры анимаций.

export const C = {
  bg: '#F4F4F1',
  card: '#FFFFFF',
  ink: '#1A1B1E',
  ink2: '#3A3C41',
  mute: '#5E6168',
  mute2: '#7A7D83',
  faint: '#A0A2A7',
  line: '#E4E4E0',
  line2: '#ECECE8',
  chip: '#F1F1EE',
  chip2: '#E9E9E5',
  now: '#E0564A',
  late: '#C9973F',
  ok: '#2A7D64',
  danger: '#B23A2B',
  missedBg: '#ECECE9',
  missedFg: '#9A9CA1',
  warnBg: '#FBF1E0',
  warnFg: '#8A5A12',
};

export type CatKey = 'work' | 'study' | 'hobby' | 'sport' | 'rest';
export type PatternKind = 'lines' | 'dots' | 'grid' | 'diagonal' | 'waves';

export const CATS: Record<CatKey, { name: string; c: string; bg: string; icon: string; pattern: PatternKind }> = {
  work: { name: 'Работа', c: '#4A6AA5', bg: '#E6EBF4', pattern: 'lines', icon: 'M4 8h16v11H4z M9 8V5h6v3 M4 13h16' },
  study: { name: 'Учёба', c: '#7459AE', bg: '#ECE7F6', pattern: 'dots', icon: 'M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z' },
  hobby: { name: 'Хобби', c: '#A06D22', bg: '#F4ECDD', pattern: 'grid', icon: 'M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0z M20 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0z' },
  sport: { name: 'Спорт', c: '#2A7D64', bg: '#DFEFE8', pattern: 'diagonal', icon: 'M6 6v12 M18 6v12 M3 9v6 M21 9v6 M6 12h12' },
  rest: { name: 'Отдых', c: '#A9566A', bg: '#F5E6EA', pattern: 'waves', icon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
};

export const CAT_ORDER: CatKey[] = ['work', 'study', 'hobby', 'sport', 'rest'];

export const F = {
  r: 'Onest_400Regular',
  m: 'Onest_500Medium',
  s: 'Onest_600SemiBold',
  b: 'Onest_700Bold',
} as const;
export type Weight = keyof typeof F;

// Пружины: быстрая для нажатий, «упругая» для появления, мягкая для шторок.
export const SPRING = {
  press: { damping: 20, stiffness: 420, mass: 0.6 },
  bouncy: { damping: 12, stiffness: 260, mass: 0.7 },
  soft: { damping: 22, stiffness: 200, mass: 1 },
  sheet: { damping: 26, stiffness: 260, mass: 0.9 },
};

// Таймлайн: с 6:00 до 24:00, 1.2 px на минуту (час = 72 px).
export const TL = { start: 6 * 60, end: 24 * 60, px: 1.2 };

export const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  repeat: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  today: 'M4 9h16 M9 3v4 M15 3v4 M8 5h8a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z',
  weeks: 'M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z M4 12h16 M9.3 4v16 M14.7 4v16',
  stats: 'M6 20V11M12 20V5M18 20v-6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z',
  key: 'M15 7a4 4 0 1 1-3.5 6H9v2H7v2H4v-3l6.5-6.5A4 4 0 0 1 15 7z',
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
};
