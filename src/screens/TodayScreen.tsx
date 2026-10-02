// Экран «Сегодня»: шапка с прогрессом, полоса недели, карточка «Сейчас» и таймлайн дня.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { applyTemplate, getState, moveTask, nav, setStatus, signExpiry, useApp } from '../lib/store';
import type { Task } from '../lib/db';
import { addDaysKey, dayTitle, DFULL, dowKey, durTxt, fmt, fromKey, nowMin, rangeLabel, relLabel, todayKey, ts, windowKeys, DN } from '../lib/date';
import { dayProgress } from '../lib/stats';
import { C, CATS, ICONS, SPRING, TL } from '../theme';
import { BlockLayout, TaskBlock } from '../components/TaskBlock';
import { haptic, Icon, Press, PulseDot, Ring, Segmented, Txt } from '../components/ui';
import { leftTxt } from '../lib/signing';

// ---------- раскладка пересекающихся задач по колонкам ----------

function layoutDay(list: Task[], width: number): Map<string, BlockLayout> {
  const res = new Map<string, BlockLayout>();
  const sorted = [...list].sort((a, b) => a.start - b.start || b.dur - a.dur);
  let group: { t: Task; col: number }[] = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    const cw = width / cols;
    group.forEach((g) =>
      res.set(g.t.id, { top: (g.t.start - TL.start) * TL.px + 2, height: Math.max(26, g.t.dur * TL.px - 4), left: g.col * cw + (g.col ? 3 : 0), width: cw - (cols > 1 ? 3 : 0) }),
    );
    group = [];
  };
  for (const t of sorted) {
    if (t.start >= groupEnd && group.length) flush();
    const colEnds: number[] = [];
    group.forEach((g) => (colEnds[g.col] = Math.max(colEnds[g.col] ?? 0, g.t.start + g.t.dur)));
    let col = 0;
    while (colEnds[col] !== undefined && colEnds[col] > t.start) col++;
    group.push({ t, col });
    groupEnd = Math.max(groupEnd, t.start + t.dur);
  }
  if (group.length) flush();
  return res;
}

// ---------- шапка ----------

function Burst({ trigger }: { trigger: number }) {
  // Маленький «салют», когда все задачи дня выполнены.
  const v = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    v.value = 0;
    v.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [trigger]);
  const colors = Object.values(CATS).map((c) => c.c);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 10 }).map((_, i) => (
        <Spark key={i} v={v} angle={(i / 10) * Math.PI * 2} color={colors[i % colors.length]} />
      ))}
    </View>
  );
}

function Spark({ v, angle, color }: { v: { value: number }; angle: number; color: string }) {
  const st = useAnimatedStyle(() => ({
    opacity: v.value > 0 && v.value < 1 ? 1 - v.value : 0,
    transform: [{ translateX: Math.cos(angle) * 38 * v.value }, { translateY: Math.sin(angle) * 38 * v.value }, { scale: 1 - v.value * 0.5 }],
  }));
  return <Animated.View style={[styles.spark, { backgroundColor: color }, st]} />;
}

function Header({ day, tasks }: { day: string; tasks: Task[] }) {
  const p = dayProgress(tasks, day);
  const rel = relLabel(day);
  const [burst, setBurst] = useState(0);
  const prev = useRef(p.pct);
  useEffect(() => {
    if (p.pct === 100 && prev.current < 100 && p.total > 0) {
      setBurst((b) => b + 1);
      haptic('success');
    }
    prev.current = p.pct;
  }, [p.pct]);
  return (
    <View style={styles.header}>
      <Animated.View key={day} entering={FadeInUp.springify().damping(18)} style={{ flex: 1, minWidth: 0 }}>
        <Txt w="m" size={13} color={C.mute2}>{DFULL[dowKey(day)] + (rel ? ' · ' + rel : '')}</Txt>
        <Txt w="b" size={30} style={{ letterSpacing: -0.6, lineHeight: 34 }}>{dayTitle(day)}</Txt>
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt size={12} color={C.mute2}>выполнено</Txt>
          <Txt w="s" size={13}>{p.done + ' из ' + p.total}</Txt>
        </View>
        <View>
          <Ring size={46} stroke={5} pct={p.pct} color={p.pct === 100 ? C.ok : C.ink}>
            <Txt w="b" size={11.5}>{p.pct + '%'}</Txt>
          </Ring>
          <Burst trigger={burst} />
        </View>
        <Press haptic="light" onPress={() => nav.settings(true)} style={styles.gear} accessibilityLabel="Настройки">
          <Icon d={ICONS.gear} size={19} color={C.mute} />
        </Press>
      </View>
    </View>
  );
}

// ---------- полоса недели ----------

function WeekStrip({ day, tasks }: { day: string; tasks: Task[] }) {
  const win = windowKeys();
  const today = todayKey();
  const idx = win.indexOf(day);
  const week = idx >= 7 ? 1 : 0;
  const keys = win.slice(week * 7, week * 7 + 7);
  const sel = keys.indexOf(day);
  const [w, setW] = useState(0);
  const cell = w ? (w - 6 * 4) / 7 : 0;
  const x = useSharedValue(0);
  const op = useSharedValue(sel >= 0 ? 1 : 0);
  useEffect(() => {
    if (sel >= 0) x.value = withSpring(sel * (cell + 4), SPRING.soft);
    op.value = withTiming(sel >= 0 ? 1 : 0, { duration: 200 });
  }, [sel, cell]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: op.value }));

  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 210 }}>
          <Segmented
            items={['Эта неделя', 'Следующая']}
            value={week}
            onChange={(i) => {
              if (i === week) return;
              nav.day(i === 0 ? (win.includes(today) ? today : win[0]) : win[7]);
            }}
          />
        </View>
        <Txt w="m" size={13} color={C.mute2}>{rangeLabel(keys[0], keys[6])}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        {cell > 0 && <Animated.View style={[styles.dayPill, { width: cell }, pill]} />}
        {keys.map((k, i) => {
          const on = k === day;
          const isToday = k === today;
          const cats: string[] = [];
          tasks.forEach((t) => {
            if (t.date === k && !cats.includes(CATS[t.cat].c) && cats.length < 4) cats.push(CATS[t.cat].c);
          });
          return (
            <Press
              key={k}
              haptic="select"
              scaleTo={0.9}
              onPress={() => nav.day(k)}
              style={styles.dayCell}
              accessibilityLabel={DFULL[i] + ', ' + fromKey(k).getDate()}
            >
              <Txt w="s" size={11} color={on ? 'rgba(255,255,255,0.6)' : '#8A8D93'}>{DN[i]}</Txt>
              <Txt w="b" size={17} color={on ? '#fff' : isToday ? C.now : C.ink}>{String(fromKey(k).getDate())}</Txt>
              <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                {cats.map((c) => (
                  <View key={c} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />
                ))}
              </View>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

// ---------- карточка «Сейчас» ----------

function NowCard({ cur, next, now }: { cur: Task; next: Task | null; now: number }) {
  const cat = CATS[cur.cat];
  const pct = Math.min(100, ((now - cur.start) / cur.dur) * 100);
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(pct, { duration: 900, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
  }, [pct]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <Animated.View entering={FadeInUp.springify().damping(16)} exiting={FadeOut.duration(200)} style={styles.card}>
      <Pressable onPress={() => nav.sheet(cur.id)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
        <View style={[styles.bigIco, { backgroundColor: cat.c }]}>
          <Icon d={cat.icon} size={22} color="#fff" stroke={1.8} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PulseDot size={7} />
            <Txt w="s" size={11.5} color={C.now} style={{ letterSpacing: 0.5 }}>{'СЕЙЧАС · ОСТАЛОСЬ ' + durTxt(Math.max(1, Math.round(cur.start + cur.dur - now))).toUpperCase()}</Txt>
          </View>
          <Txt w="s" size={15.5} numberOfLines={1}>{cur.title}</Txt>
          <View style={styles.track}>
            <Animated.View style={[styles.trackFill, { backgroundColor: cat.c }, bar]} />
          </View>
          <Txt size={12} color={C.mute2} numberOfLines={1}>{next ? 'Далее ' + fmt(next.start) + ' · ' + next.title : 'Дальше — свободное время'}</Txt>
        </View>
      </Pressable>
      <Press haptic="none" onPress={() => { haptic('success'); setStatus(cur.id, 'done'); }} style={styles.doneBtn} accessibilityLabel="Готово">
        <Icon d={ICONS.check} size={18} color="#fff" stroke={2.6} />
      </Press>
    </Animated.View>
  );
}

function SummaryCard({ day, tasks }: { day: string; tasks: Task[] }) {
  const today = todayKey();
  const p = dayProgress(tasks, day);
  const list = tasks.filter((t) => t.date === day);
  const total = list.reduce((a, t) => a + t.dur, 0);
  const by: Record<string, number> = {};
  list.forEach((t) => (by[t.cat] = (by[t.cat] ?? 0) + t.dur));
  const label = day < today ? 'Итог дня' : day === today ? 'Остаток дня' : 'План на день';
  const text = day < today ? 'Выполнено ' + p.done + ' из ' + p.total + ' · ' + p.pct + '%' : list.length + ' ' + plural(list.length) + ' · ' + durTxt(total);
  return (
    <Animated.View key={day} entering={FadeInUp.springify().damping(16)} style={[styles.card, { justifyContent: 'space-between' }]}>
      <View style={{ gap: 3, flex: 1 }}>
        <Txt w="s" size={11.5} color={C.mute2} style={{ letterSpacing: 0.5 }}>{label.toUpperCase()}</Txt>
        <Txt w="s" size={15.5}>{text}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Object.keys(by)
          .slice(0, 3)
          .map((k) => (
            <View key={k} style={[styles.catPill, { backgroundColor: CATS[k as keyof typeof CATS].bg }]}>
              <Txt w="s" size={11.5} color={CATS[k as keyof typeof CATS].c}>{String(Math.round(by[k] / 30) / 2).replace('.', ',') + ' ч'}</Txt>
            </View>
          ))}
      </View>
    </Animated.View>
  );
}

function plural(n: number) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return 'задача';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'задачи';
  return 'задач';
}

function SignBanner() {
  const s = useApp();
  const exp = signExpiry(s);
  if (!exp || Platform.OS !== 'ios') return null;
  const left = exp - s.clock;
  if (left > 2 * 24 * 3600000) return null;
  return (
    <Animated.View entering={FadeInUp.springify()} style={[styles.card, { backgroundColor: C.warnBg }]}>
      <Pressable onPress={() => nav.settings(true)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
        <Icon d={ICONS.key} size={20} color={C.warnFg} />
        <View style={{ flex: 1 }}>
          <Txt w="s" size={14} color={C.warnFg}>{left > 0 ? 'Подпись истекает через ' + leftTxt(left) : 'Подпись истекла'}</Txt>
          <Txt size={12.5} color={C.warnFg}>SideStore → My Apps → Refresh All</Txt>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ---------- таймлайн ----------

function Timeline({ day, list, dir }: { day: string; list: Task[]; dir: 'down' | 'left' | 'right' }) {
  const s = useApp();
  const scroll = useRef<ScrollView>(null);
  const [w, setW] = useState(0);
  const today = todayKey();
  const isToday = day === today;
  const now = nowMin();
  const H = (TL.end - TL.start) * TL.px;
  const lay = useMemo(() => layoutDay(list, Math.max(0, w - 58 - 14)), [list, w]);

  useEffect(() => {
    const target = isToday ? (now - TL.start) * TL.px - 160 : list.length ? (list[0].start - TL.start) * TL.px - 40 : (8 * 60 - TL.start) * TL.px;
    const id = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, target), animated: true }), 80);
    return () => clearTimeout(id);
  }, [day]);

  const gaps: { top: number; h: number; start: number; dur: number }[] = [];
  if (day >= today) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i].start + sorted[i].dur;
      const b = sorted[i + 1].start;
      if (b - a >= 60 && (!isToday || b > now + 30)) gaps.push({ top: (a - TL.start) * TL.px + 4, h: (b - a) * TL.px - 8, start: a, dur: b - a });
    }
  }

  const hours = [];
  for (let h = TL.start / 60; h < TL.end / 60; h++) hours.push(h);

  const tapEmpty = (y: number) => {
    const m = Math.floor((TL.start + y / TL.px) / 30) * 30;
    nav.editor({ mode: 'new', date: day, start: Math.min(23 * 60, Math.max(0, m)) });
  };

  const empty = list.length === 0;

  return (
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ height: H + 150 }} showsVerticalScrollIndicator={false} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Pressable style={StyleSheet.absoluteFill} onPress={(e) => tapEmpty(e.nativeEvent.locationY)} />
      {hours.map((h) => {
        const top = (h * 60 - TL.start) * TL.px;
        return (
          <View key={h} pointerEvents="none">
            <View style={[styles.hourLine, { top }]} />
            <View style={[styles.halfLine, { top: top + 30 * TL.px }]} />
            <Txt w="m" size={11} color={C.faint} style={[styles.hourLbl, { top: top - 7 }]}>{h + ':00'}</Txt>
          </View>
        );
      })}

      {gaps.map((g) => (
        <Press key={day + g.start} haptic="light" scaleTo={0.97} onPress={() => nav.editor({ mode: 'new', date: day, start: g.start })} style={[styles.gap, { top: g.top, height: g.h }]}>
          <Icon d={ICONS.plus} size={14} color="#8A8D93" stroke={2} />
          <Txt size={12.5} color="#8A8D93">{'Свободно · ' + durTxt(g.dur)}</Txt>
        </Press>
      ))}

      <View style={{ position: 'absolute', left: 58, right: 14, top: 0, bottom: 0 }} pointerEvents="box-none">
        {list.map((t, i) => {
          const l = lay.get(t.id);
          if (!l) return null;
          const isNow = isToday && t.status === 'plan' && t.start <= now && now < t.start + t.dur;
          return (
            <TaskBlock
              key={day + t.id}
              t={t}
              lay={l}
              index={i}
              isNow={isNow}
              progress={isNow ? ((now - t.start) / t.dur) * 100 : 0}
              enter={dir}
              onOpen={() => nav.sheet(t.id)}
              onToggle={() => {
                const st = getState().tasks.find((x) => x.id === t.id)?.status;
                if (st === 'plan') setStatus(t.id, 'done');
                else if (st === 'missed') setStatus(t.id, 'late');
                else setStatus(t.id, 'plan');
              }}
              onMoveBy={(m) => moveTask(t.id, t.date, t.start + m, 'Перенесено на ' + fmt(Math.max(0, t.start + m)) + ' · напоминания обновлены')}
            />
          );
        })}
      </View>

      {isToday && now >= TL.start && (
        <View pointerEvents="none" style={[styles.nowWrap, { top: (now - TL.start) * TL.px }]}>
          <Txt w="b" size={11} color={C.now} style={styles.nowLbl}>{fmt(now)}</Txt>
          <View style={styles.nowLine} />
          <View style={{ position: 'absolute', left: 46, top: -4 }}>
            <PulseDot size={9} />
          </View>
        </View>
      )}

      {empty && (
        <Animated.View entering={FadeIn.delay(150)} style={[styles.empty, { top: (9 * 60 - TL.start) * TL.px }]} pointerEvents="box-none">
          <Txt w="s" size={16}>День пока пустой</Txt>
          <Txt size={13.5} color={C.mute} style={{ textAlign: 'center' }}>Нажми на любое время, чтобы добавить задачу, или начни с шаблона</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Press haptic="medium" onPress={() => applyTemplate(day, 'work')} style={styles.tplBtn}>
              <Txt w="s" size={13.5}>Рабочий день</Txt>
            </Press>
            <Press haptic="medium" onPress={() => applyTemplate(day, 'free')} style={styles.tplBtn}>
              <Txt w="s" size={13.5}>Выходной</Txt>
            </Press>
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

// ---------- экран ----------

export function TodayScreen() {
  const s = useApp();
  const insets = useSafeAreaInsets();
  const day = s.day;
  const [dir, setDir] = useState<'down' | 'left' | 'right'>('down');
  const prevDay = useRef(day);
  useEffect(() => {
    if (prevDay.current !== day) setDir(day > prevDay.current ? 'right' : 'left');
    prevDay.current = day;
  }, [day]);

  const list = useMemo(() => s.tasks.filter((t) => t.date === day).sort((a, b) => a.start - b.start), [s.tasks, day]);
  const now = nowMin();
  const isToday = day === todayKey();
  const cur = isToday ? list.find((t) => t.status === 'plan' && t.start <= now && now < t.start + t.dur) ?? null : null;
  const next = isToday ? list.find((t) => t.status === 'plan' && t.start > now) ?? null : null;

  const goDay = (delta: number) => {
    haptic('select');
    nav.day(addDaysKey(getState().day, delta));
  };
  const swipe = Gesture.Pan()
    .activeOffsetX([-28, 28])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      if (e.translationX < -70 || e.velocityX < -700) scheduleOnRN(goDay, 1);
      else if (e.translationX > 70 || e.velocityX > 700) scheduleOnRN(goDay, -1);
    });

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <Header day={day} tasks={s.tasks} />
      <WeekStrip day={day} tasks={s.tasks} />
      <View style={{ paddingHorizontal: 16, gap: 8, marginTop: 12 }}>
        <SignBanner />
        {cur ? <NowCard key={cur.id} cur={cur} next={next} now={now} /> : <SummaryCard day={day} tasks={s.tasks} />}
      </View>
      <GestureDetector gesture={swipe}>
        <View style={{ flex: 1, marginTop: 10 }}>
          <Timeline key={day} day={day} list={list} dir={dir} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  gear: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', left: 20, top: 20, width: 6, height: 6, borderRadius: 3 },
  dayPill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 16, backgroundColor: C.ink },
  dayCell: { flex: 1, height: 66, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigIco: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#EDEDEA', overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2 },
  doneBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  catPill: { height: 26, paddingHorizontal: 8, borderRadius: 8, justifyContent: 'center' },
  hourLine: { position: 'absolute', left: 52, right: 0, height: 1, backgroundColor: C.line },
  halfLine: { position: 'absolute', left: 52, right: 0, height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.line2 },
  hourLbl: { position: 'absolute', left: 0, width: 44, textAlign: 'right' },
  gap: { position: 'absolute', left: 58, right: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#DADAD5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  nowWrap: { position: 'absolute', left: 0, right: 6, height: 0, zIndex: 60 },
  nowLbl: { position: 'absolute', left: 0, width: 44, textAlign: 'right', top: -8 },
  nowLine: { position: 'absolute', left: 50, right: 0, top: -1, height: 2, borderRadius: 1, backgroundColor: C.now },
  empty: { position: 'absolute', left: 70, right: 26, alignItems: 'center', gap: 4, backgroundColor: 'rgba(244,244,241,0.92)', paddingVertical: 16, borderRadius: 20 },
  tplBtn: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#fff', justifyContent: 'center' },
});
