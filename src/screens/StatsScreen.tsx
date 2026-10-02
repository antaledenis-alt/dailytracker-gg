// Итоги: продуктивность, вовремя / позже / пропущено, по дням, по категориям и подсказка.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../lib/store';
import { computeStats, Period } from '../lib/stats';
import { hoursTxt, rangeLabel } from '../lib/date';
import { C, CATS, ICONS } from '../theme';
import { CatPattern } from '../components/Pattern';
import { Icon, Ring, Segmented, Txt, useCountUp } from '../components/ui';

function Grow({ h, delay, children }: { h: number; delay: number; children: React.ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.bezier(0.2, 0.9, 0.25, 1) }));
  }, [h]);
  const st = useAnimatedStyle(() => ({ height: h * v.value }));
  return <Animated.View style={[styles.stack, st]}>{children}</Animated.View>;
}

function Bar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(pct, { duration: 900, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [pct]);
  const st = useAnimatedStyle(() => ({ width: `${v.value}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, st]} />
    </View>
  );
}

function Tile({ label, value, dot }: { label: string; value: number; dot: React.ReactNode }) {
  const v = useCountUp(value);
  return (
    <View style={[styles.card, { flex: 1, paddingVertical: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {dot}
        <Txt w="m" size={12} color={C.mute}>{label}</Txt>
      </View>
      <Txt w="b" size={24} style={{ marginTop: 4 }}>{String(v)}</Txt>
    </View>
  );
}

export function StatsScreen() {
  const s = useApp();
  const insets = useSafeAreaInsets();
  const [p, setP] = useState(0);
  const period: Period = p === 0 ? 'week' : 'days14';
  const st = useMemo(() => computeStats(s.tasks, period), [s.tasks, period]);
  const score = useCountUp(st.score, 900);
  const max = Math.max(1, ...st.days.map((d) => d.on + d.late + d.miss));
  const empty = st.total === 0;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 130, gap: 12 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Animated.View entering={FadeInUp.springify().damping(18)}>
          <Txt w="m" size={13} color={C.mute2}>{rangeLabel(st.from, st.to)}</Txt>
          <Txt w="b" size={30} style={{ letterSpacing: -0.6 }}>Итоги</Txt>
        </Animated.View>
        <View style={{ width: 180 }}>
          <Segmented items={['Неделя', '14 дней']} value={p} onChange={setP} />
        </View>
      </View>

      <Animated.View entering={FadeInUp.delay(60).springify().damping(18)} style={[styles.card, { flexDirection: 'row', gap: 16, alignItems: 'center' }]}>
        <Ring size={112} stroke={10} pct={st.score} track="#EDEDEA">
          <Txt w="b" size={34} style={{ letterSpacing: -1, lineHeight: 38 }}>{String(score)}</Txt>
          <Txt w="s" size={11} color={C.mute2}>из 100</Txt>
        </Ring>
        <View style={{ flex: 1, gap: 6 }}>
          <Txt w="b" size={17}>Продуктивность</Txt>
          <Txt size={13} color={C.mute} style={{ lineHeight: 18 }}>
            {empty ? 'Пока нечего считать — отмечай задачи, и здесь появятся итоги.' : 'Выполнено ' + st.completion + '% задач. Вовремя — 1 балл, позже — 0,5, пропуск — 0.'}
          </Txt>
          {st.delta !== null && (
            <Txt w="s" size={12.5} color={st.delta >= 0 ? C.ok : C.danger}>{(st.delta >= 0 ? '+' : '') + st.delta + (period === 'week' ? ' к прошлой неделе' : ' к прошлым 14 дням')}</Txt>
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(120).springify().damping(18)} style={{ flexDirection: 'row', gap: 8 }}>
        <Tile label="Вовремя" value={st.on} dot={<View style={[styles.dot, { backgroundColor: C.ink }]} />} />
        <Tile label="Позже" value={st.late} dot={<View style={[styles.dot, { backgroundColor: C.late }]} />} />
        <Tile
          label="Пропущено"
          value={st.miss}
          dot={
            <View style={[styles.dot, { backgroundColor: '#ECECE9', overflow: 'hidden' }]}>
              <CatPattern kind="hatch" color="#9A9CA1" opacity={1} fade={false} />
            </View>
          }
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(180).springify().damping(18)} style={styles.card}>
        <Txt w="s" size={15}>По дням</Txt>
        <View style={{ flexDirection: 'row', gap: period === 'week' ? 10 : 4, alignItems: 'flex-end', height: 140, marginTop: 14 }}>
          {st.days.map((d, i) => {
            const n = d.on + d.late + d.miss;
            const h = n ? (n / max) * 110 : 4;
            return (
              <View key={d.key + p} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Grow h={h} delay={i * 40}>
                  {n ? (
                    <>
                      <View style={{ flex: d.on, backgroundColor: C.ink }} />
                      <View style={{ flex: d.late, backgroundColor: C.late }} />
                      <View style={{ flex: d.miss, backgroundColor: '#ECECE9', overflow: 'hidden' }}>
                        <CatPattern kind="hatch" color="#9A9CA1" opacity={1} fade={false} />
                      </View>
                    </>
                  ) : (
                    <View style={{ flex: 1, backgroundColor: '#EFEFEC' }} />
                  )}
                </Grow>
                <Txt w="s" size={10.5} color="#8A8D93">{d.label}</Txt>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {st.cats.length > 0 && (
        <Animated.View entering={FadeInUp.delay(240).springify().damping(18)} style={styles.card}>
          <Txt w="s" size={15} style={{ marginBottom: 12 }}>По категориям</Txt>
          <View style={{ gap: 12 }}>
            {st.cats.map((c, i) => (
              <View key={c.cat + p} style={{ gap: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt w="s" size={13.5}>{CATS[c.cat].name}</Txt>
                  <Txt size={13.5} color={C.mute}>{c.pct + '% · ' + hoursTxt(c.minutes)}</Txt>
                </View>
                <Bar pct={c.pct} color={CATS[c.cat].c} delay={i * 60} />
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {st.insight && (
        <Animated.View entering={FadeInUp.delay(300).springify().damping(18)} style={[styles.card, { flexDirection: 'row', gap: 10 }]}>
          <View style={styles.bulb}>
            <Icon d={ICONS.bulb} size={17} color="#A06D22" stroke={2} />
          </View>
          <Txt size={14} color={C.ink2} style={{ flex: 1, lineHeight: 20 }}>{st.insight}</Txt>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stack: { width: '100%', borderRadius: 6, overflow: 'hidden', flexDirection: 'column-reverse' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#EFEFEC', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  bulb: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FBF1E0', alignItems: 'center', justifyContent: 'center' },
});
