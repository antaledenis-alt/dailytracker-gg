// Обзор двух недель: мини-таймлайн на каждый день, нагрузка и процент выполнения.
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nav, useApp } from '../lib/store';
import type { Task } from '../lib/db';
import { DN, fromKey, hoursTxt, nowMin, rangeLabel, todayKey, windowKeys } from '../lib/date';
import { dayProgress } from '../lib/stats';
import { C, CAT_ORDER, CATS, TL } from '../theme';
import { CatPattern } from '../components/Pattern';
import { Press, Txt } from '../components/ui';

const H = 200;
const SPAN = TL.end - TL.start;

function Column({ k, list, index }: { k: string; list: Task[]; index: number }) {
  const today = todayKey();
  const isToday = k === today;
  const past = k < today;
  const p = dayProgress(list, k);
  const mins = list.reduce((a, t) => a + t.dur, 0);
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(index * 45, withTiming(1, { duration: 650, easing: Easing.bezier(0.2, 0.9, 0.25, 1) }));
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }], opacity: 0.3 + grow.value * 0.7 }));
  const d = fromKey(k);
  return (
    <Press haptic="select" scaleTo={0.94} onPress={() => nav.openDay(k)} style={[styles.col, isToday && styles.colToday]} accessibilityLabel={DN[index % 7] + ' ' + d.getDate()}>
      <Txt w="s" size={11} color="#8A8D93">{DN[index % 7]}</Txt>
      <Txt w="b" size={16} color={isToday ? C.now : C.ink}>{String(d.getDate())}</Txt>
      <View style={styles.mini}>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: 'top' }, st]}>
          {list.map((t) => {
            const missed = t.status === 'missed';
            const done = t.status === 'done' || t.status === 'late';
            return (
              <View
                key={t.id}
                style={[
                  styles.bar,
                  { top: ((t.start - TL.start) / SPAN) * H + 1, height: Math.max(4, (t.dur / SPAN) * H - 2), backgroundColor: missed ? '#E6E6E3' : CATS[t.cat].c, opacity: done ? 0.45 : 1 },
                ]}
              >
                {missed && <CatPattern kind="hatch" color="#B9BABD" opacity={1} fade={false} />}
              </View>
            );
          })}
        </Animated.View>
        {isToday && <View style={[styles.now, { top: ((nowMin() - TL.start) / SPAN) * H }]} />}
      </View>
      <Txt w="s" size={11} color={past ? (p.pct >= 80 ? C.ok : '#A06D22') : '#8A8D93'}>{past || isToday ? p.pct + '%' : list.length ? hoursTxt(mins) : '—'}</Txt>
    </Press>
  );
}

export function WeeksScreen() {
  const s = useApp();
  const insets = useSafeAreaInsets();
  const win = windowKeys();
  const today = todayKey();
  const weeks = [win.slice(0, 7), win.slice(7)];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInUp.springify().damping(18)} style={{ paddingHorizontal: 8 }}>
        <Txt w="m" size={13} color={C.mute2}>{rangeLabel(win[0], win[13])}</Txt>
        <Txt w="b" size={30} style={{ letterSpacing: -0.6 }}>Две недели</Txt>
      </Animated.View>
      {weeks.map((keys, wi) => {
        const lists = keys.map((k) => s.tasks.filter((t) => t.date === k));
        const all = lists.flat();
        const fin = all.filter((t) => t.date <= today && t.status !== 'plan');
        const ok = fin.filter((t) => t.status !== 'missed').length;
        const summary = all.length + ' задач' + (fin.length ? ' · выполнено ' + Math.round((ok / fin.length) * 100) + '%' : ' · ' + hoursTxt(all.reduce((a, t) => a + t.dur, 0)));
        return (
          <View key={wi} style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 8, paddingBottom: 8 }}>
              <Txt w="s" size={16}>
                {wi === 0 ? 'Эта неделя ' : 'Следующая '}
                <Txt w="m" size={13} color="#8A8D93">{rangeLabel(keys[0], keys[6])}</Txt>
              </Txt>
              <Txt w="m" size={13} color={C.mute}>{summary}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {keys.map((k, i) => (
                <Column key={k} k={k} list={lists[i]} index={i + wi * 7} />
              ))}
            </View>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18, paddingHorizontal: 8 }}>
        {CAT_ORDER.map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: CATS[k].c }} />
            <Txt size={12} color={C.mute}>{CATS[k].name}</Txt>
          </View>
        ))}
      </View>
      <Txt size={12.5} color={C.faint} style={{ marginTop: 14, paddingHorizontal: 8 }}>Нажми на день, чтобы открыть его расписание</Txt>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, borderRadius: 14, paddingTop: 6, paddingBottom: 8, paddingHorizontal: 3, alignItems: 'center', gap: 6 },
  colToday: { backgroundColor: '#fff' },
  mini: { width: '100%', height: H, borderRadius: 8, backgroundColor: 'rgba(26,27,30,0.03)', overflow: 'hidden' },
  bar: { position: 'absolute', left: 3, right: 3, borderRadius: 4, overflow: 'hidden' },
  now: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: C.now, borderRadius: 1 },
});
