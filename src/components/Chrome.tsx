// «Стеклянная» панель вкладок (Liquid Glass на iOS 26, размытие на старых) и всплывающее сообщение.
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, ICONS, SPRING } from '../theme';
import { haptic, Icon, Press, Txt } from './ui';
import { nav, Tab, useApp } from '../lib/store';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'today', label: 'Сегодня', icon: ICONS.today },
  { key: 'weeks', label: '2 недели', icon: ICONS.weeks },
  { key: 'stats', label: 'Итоги', icon: ICONS.stats },
];

const glass = Platform.OS === 'ios' && isLiquidGlassAvailable();

function Surface({ children, style }: { children: React.ReactNode; style: any }) {
  if (glass) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[style, { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)' }]}>
      <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.55)' }]} />
      {children}
    </View>
  );
}

export function TabBar() {
  const { tab } = useApp();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const idx = TABS.findIndex((t) => t.key === tab);
  const cell = w ? w / TABS.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(idx * cell, SPRING.soft);
  }, [idx, cell]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.bar, { bottom: Math.max(14, insets.bottom - 6) }]} pointerEvents="box-none">
      <Surface style={styles.tabs}>
        <View style={{ flex: 1, flexDirection: 'row' }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
          {cell > 0 && <Animated.View style={[styles.pill, { width: cell }, pill]} />}
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Pressable
                key={t.key}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  if (!on) haptic('select');
                  nav.tab(t.key);
                }}
              >
                <Icon d={t.icon} size={21} color={on ? C.ink : '#6B6E75'} />
                <Txt w="s" size={10.5} color={on ? C.ink : '#6B6E75'}>{t.label}</Txt>
              </Pressable>
            );
          })}
        </View>
      </Surface>
      <Press haptic="medium" scaleTo={0.88} onPress={() => nav.editor({ mode: 'new' })} style={styles.fab} accessibilityLabel="Новая задача">
        <Icon d={ICONS.plus} size={26} color="#fff" stroke={2.2} />
      </Press>
    </View>
  );
}

export function ToastView() {
  const { toast } = useApp();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.springify().damping(14).stiffness(180)}
      exiting={FadeOutDown.duration(200)}
      style={[styles.toast, { bottom: Math.max(14, insets.bottom - 6) + 76 }]}
    >
      <Icon d={ICONS.check} size={18} color="#7FD1AE" stroke={2.4} />
      <Txt size={14} color="#fff" style={{ flex: 1 }}>{toast.text}</Txt>
      {toast.undo && (
        <Press haptic="light" onPress={toast.undo} style={styles.undo}>
          <Txt w="s" size={14} color="#9FC3FF">Отменить</Txt>
        </Press>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 10, alignItems: 'center' },
  tabs: { flex: 1, height: 62, borderRadius: 31, padding: 5, flexDirection: 'row' },
  pill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 26, backgroundColor: 'rgba(26,27,30,0.07)' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  fab: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#14141E', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  toast: {
    position: 'absolute', left: 16, right: 16, backgroundColor: C.ink, borderRadius: 18, paddingVertical: 10, paddingLeft: 16, paddingRight: 8,
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10,
  },
  undo: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
});
