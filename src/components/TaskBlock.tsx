// Блок задачи на таймлайне. Тап — открыть, долгое нажатие и перетаскивание — перенести
// (прилипает к сетке 30 минут, на каждом шаге лёгкий отклик), кружок справа — отметить.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Path } from 'react-native-svg';
import type { Task } from '../lib/db';
import { durTxt, fmt } from '../lib/date';
import { C, CATS, SPRING, TL } from '../theme';
import { CatPattern } from './Pattern';
import { DrawCheck, haptic, Press, Txt } from './ui';

export interface BlockLayout {
  top: number;
  height: number;
  left: number;
  width: number;
}

export function TaskBlock({
  t,
  lay,
  index,
  isNow,
  progress,
  enter,
  onOpen,
  onMoveBy,
  onToggle,
}: {
  t: Task;
  lay: BlockLayout;
  index: number;
  isNow: boolean;
  progress: number;
  enter: 'down' | 'left' | 'right';
  onOpen: () => void;
  onMoveBy: (minutes: number) => void;
  onToggle: () => void;
}) {
  const cat = CATS[t.cat];
  const missed = t.status === 'missed';
  const done = t.status === 'done' || t.status === 'late';
  const compact = lay.height < 44;

  const topSV = useSharedValue(lay.top);
  const ty = useSharedValue(0);
  const lift = useSharedValue(0);
  const lastStep = useSharedValue(0);
  const dropped = useRef(false);
  const fade = useSharedValue(done ? 1 : 0);
  const fill = useSharedValue(0);

  useEffect(() => {
    if (dropped.current) {
      dropped.current = false;
      topSV.value = lay.top;
      ty.value = 0;
    } else {
      topSV.value = withSpring(lay.top, SPRING.soft);
    }
  }, [lay.top]);

  useEffect(() => {
    fade.value = withTiming(done ? 1 : 0, { duration: 420 });
  }, [done]);

  useEffect(() => {
    fill.value = withTiming(isNow ? progress : 0, { duration: 900 });
  }, [isNow, progress]);

  const step = 30 * TL.px;
  const commit = (min: number) => {
    dropped.current = true;
    onMoveBy(min);
  };

  const pan = Gesture.Pan()
    .activateAfterLongPress(320)
    .onStart(() => {
      lift.value = withSpring(1, SPRING.bouncy);
      lastStep.value = 0;
      scheduleOnRN(haptic, 'medium');
    })
    .onUpdate((e) => {
      ty.value = e.translationY;
      const s = Math.round(e.translationY / step);
      if (s !== lastStep.value) {
        lastStep.value = s;
        scheduleOnRN(haptic, 'select');
      }
    })
    .onEnd(() => {
      const s = Math.round(ty.value / step);
      lift.value = withSpring(0, SPRING.soft);
      if (s !== 0) {
        ty.value = withSpring(s * step, SPRING.press);
        scheduleOnRN(commit, s * 30);
      } else {
        ty.value = withSpring(0, SPRING.soft);
      }
    });
  const tap = Gesture.Tap()
    .maxDuration(280)
    .onEnd(() => {
      scheduleOnRN(onOpen);
    });
  const gesture = Gesture.Exclusive(pan, tap);

  const pos = useAnimatedStyle(() => ({
    transform: [{ translateY: topSV.value + ty.value }, { scale: 1 + lift.value * 0.03 }],
    zIndex: lift.value > 0.01 ? 50 : 1,
    shadowOpacity: lift.value * 0.22,
  }));
  const body = useAnimatedStyle(() => ({ opacity: 1 - fade.value * 0.4 }));
  const nowFill = useAnimatedStyle(() => ({ height: `${fill.value}%` }));
  const chkBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fade.value, [0, 1], ['rgba(255,255,255,0.6)', cat.c]),
  }));

  const accent = missed ? C.missedFg : cat.c;
  const entering =
    enter === 'left'
      ? FadeInLeft.delay(index * 30).springify().damping(18)
      : enter === 'right'
        ? FadeInRight.delay(index * 30).springify().damping(18)
        : FadeInDown.delay(index * 40).springify().damping(16);

  return (
    <Animated.View entering={entering} pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: lay.left, width: lay.width }}>
      <Animated.View style={[styles.wrap, { height: lay.height }, pos]}>
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[
              styles.blk,
              { backgroundColor: missed ? C.missedBg : cat.bg },
              isNow && { borderWidth: 2, borderColor: cat.c },
              compact && styles.compact,
              body,
            ]}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t.title + ', ' + fmt(t.start)}
          >
            <CatPattern kind={missed ? 'hatch' : cat.pattern} color={accent} opacity={missed ? 0.3 : 0.17} fade={!missed} />
            {isNow && <Animated.View style={[styles.nowFill, { backgroundColor: cat.c }, nowFill]} />}
            <View style={[styles.ico, compact && styles.icoSm, { backgroundColor: missed ? '#B5B7BB' : cat.c }]}>
              <Svg width={compact ? 13 : 15} height={compact ? 13 : 15} viewBox="0 0 24 24" fill="none">
                <Path d={cat.icon} stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={[styles.txt, compact && { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <Txt
                w="s"
                size={14}
                numberOfLines={1}
                color={missed ? C.mute2 : C.ink}
                style={[{ flexShrink: 1 }, done && { textDecorationLine: 'line-through', textDecorationColor: 'rgba(26,27,30,0.35)' }]}
              >
                {t.title}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt size={12} color={C.mute}>{compact ? fmt(t.start) : fmt(t.start) + '–' + fmt(t.start + t.dur) + ' · ' + durTxt(t.dur)}</Txt>
                {(isNow || missed || t.status === 'late') && (
                  <View style={styles.badge}>
                    <Txt w="s" size={10.5} color={isNow ? C.now : C.mute}>{isNow ? 'сейчас' : missed ? 'пропущено' : 'позже'}</Txt>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
        <Press
          haptic="none"
          scaleTo={0.8}
          onPress={() => {
            haptic(done ? 'light' : 'success');
            onToggle();
          }}
          hitSlop={8}
          accessibilityLabel={done ? 'Снять отметку' : 'Отметить выполненной'}
          style={[styles.chk, compact ? { top: (lay.height - 26) / 2 } : { top: 9 }, { borderColor: missed ? '#B5B7BB' : accent }, missed ? { backgroundColor: '#B5B7BB' } : chkBg]}
        >
          {done && <DrawCheck key={t.status} size={14} />}
          {missed && !done && (
            <Svg width={12} height={12} viewBox="0 0 24 24">
              <Path d="M6 12h12" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
            </Svg>
          )}
        </Press>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, shadowColor: '#14141E', shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
  blk: { flex: 1, borderRadius: 14, overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 44 },
  compact: { alignItems: 'center', paddingTop: 0, paddingBottom: 0 },
  nowFill: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0.12 },
  ico: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  icoSm: { width: 22, height: 22, borderRadius: 7 },
  txt: { flex: 1, gap: 2, minWidth: 0 },
  badge: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.78)' },
  chk: { position: 'absolute', right: 9, width: 26, height: 26, borderRadius: 13, borderWidth: 1.7, alignItems: 'center', justifyContent: 'center' },
});
