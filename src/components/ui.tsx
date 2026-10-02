// Базовые элементы интерфейса: текст, «пружинящая» кнопка, иконки, чипы, переключатели, кольцо прогресса.
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, PressableProps, StyleProp, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { C, F, SPRING, Weight } from '../theme';

// ---------- текст ----------

export function Txt({ w = 'r', size = 15, color = C.ink, style, ...p }: TextProps & { w?: Weight; size?: number; color?: string }) {
  return (
    <Text
      maxFontSizeMultiplier={1.2}
      style={[{ fontFamily: F[w], fontSize: size, color, fontVariant: ['tabular-nums'] }, style]}
      {...p}
    />
  );
}

// ---------- кнопка с пружиной и вибро ----------

const AP = Animated.createAnimatedComponent(Pressable);

type PressProps = Omit<PressableProps, 'style'> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any; // обычный или анимированный стиль
  scaleTo?: number;
  haptic?: 'light' | 'select' | 'medium' | 'none';
  children?: React.ReactNode;
};

export function haptic(kind: 'light' | 'select' | 'medium' | 'success' | 'warn' = 'light') {
  if (kind === 'select') Haptics.selectionAsync();
  else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

export function Press({ style, scaleTo = 0.95, haptic: h = 'light', onPress, onPressIn, onPressOut, children, ...rest }: PressProps) {
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AP
      {...rest}
      onPressIn={(e) => {
        s.value = withSpring(scaleTo, SPRING.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, SPRING.bouncy);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (h !== 'none') haptic(h);
        onPress?.(e);
      }}
      style={[style, st]}
    >
      {children}
    </AP>
  );
}

// ---------- иконка ----------

export function Icon({ d, size = 20, color = C.ink, stroke = 1.9 }: { d: string; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ---------- галочка, которая «рисуется» ----------

const APath = Animated.createAnimatedComponent(Path);

export function DrawCheck({ size = 14, color = '#fff', stroke = 3, delay = 0 }: { size?: number; color?: string; stroke?: number; delay?: number }) {
  const p = useSharedValue(22);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(0, { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, []);
  const ap = useAnimatedProps(() => ({ strokeDashoffset: p.value }));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <APath d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={22} animatedProps={ap} />
    </Svg>
  );
}

// ---------- чип ----------

export function Chip({ label, on, onPress, style, left }: { label: string; on?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>; left?: React.ReactNode }) {
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.value = withTiming(on ? 1 : 0, { duration: 260 });
  }, [on]);
  const st = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(v.value, [0, 1], [C.chip, C.ink]) }));
  return (
    <Press haptic="select" onPress={onPress} scaleTo={0.93} style={[styles.chip, st, style]}>
      {left}
      <Txt w="m" size={14} color={on ? '#fff' : C.ink}>{label}</Txt>
    </Press>
  );
}

// ---------- сегменты со скользящей подложкой ----------

export function Segmented({ items, value, onChange }: { items: string[]; value: number; onChange: (i: number) => void }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const cell = w ? (w - 6) / items.length : 0;
  useEffect(() => {
    x.value = withSpring(value * cell, SPRING.soft);
  }, [value, cell]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.seg} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {cell > 0 && <Animated.View style={[styles.segPill, { width: cell }, st]} />}
      {items.map((l, i) => (
        <Pressable
          key={l}
          onPress={() => {
            if (i !== value) haptic('select');
            onChange(i);
          }}
          style={styles.segItem}
        >
          <Txt w="s" size={13} color={i === value ? C.ink : C.mute2}>{l}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

// ---------- переключатель ----------

export function Switch({ on, onChange, color = C.ok }: { on: boolean; onChange: (v: boolean) => void; color?: string }) {
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.value = withSpring(on ? 1 : 0, SPRING.bouncy);
  }, [on]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(v.value, [0, 1], ['#E2E2DE', color]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: v.value * 20 }, { scale: 1 + Math.sin(v.value * Math.PI) * 0.08 }] }));
  return (
    <Pressable
      onPress={() => {
        haptic('select');
        onChange(!on);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
    >
      <Animated.View style={[styles.sw, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

// ---------- кольцо прогресса ----------

const ACircle = Animated.createAnimatedComponent(Circle);

export function Ring({ size, stroke, pct, color = C.ink, track = '#E4E4E0', children }: { size: number; stroke: number; pct: number; color?: string; track?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(100, pct)) / 100, { duration: 900, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
  }, [pct]);
  const ap = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <ACircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={len} animatedProps={ap} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

// ---------- пульсирующая точка ----------

export function PulseDot({ size = 8, color = C.now }: { size?: number; color?: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false);
  }, []);
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - v.value), transform: [{ scale: 1 + v.value * 2.2 }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, halo]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// ---------- счётчик, который «добегает» до значения ----------

export function useCountUp(target: number, duration = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const from = v;
    const t0 = Date.now();
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (target - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

// ---------- лёгкое «покачивание» для привлечения внимания ----------

export function useWiggle(trigger: unknown) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    r.value = withSequence(withTiming(-4, { duration: 60 }), withTiming(4, { duration: 90 }), withTiming(-2, { duration: 80 }), withSpring(0, SPRING.bouncy));
  }, [trigger]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: r.value + 'deg' }] }));
}

const styles = StyleSheet.create({
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  seg: { flexDirection: 'row', backgroundColor: C.chip2, borderRadius: 12, padding: 3, height: 36 },
  segPill: { position: 'absolute', left: 3, top: 3, bottom: 3, borderRadius: 9, backgroundColor: '#fff', shadowColor: '#14141E', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  sw: { width: 52, height: 32, borderRadius: 16, padding: 3 },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
});
