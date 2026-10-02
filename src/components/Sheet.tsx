// Нижняя шторка: выезжает на пружине, затемняет фон, закрывается свайпом вниз или тапом по фону.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPRING } from '../theme';

export function Sheet({
  open,
  onClose,
  children,
  full = false,
  dragWholeSheet = true,
  style,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  full?: boolean;
  dragWholeSheet?: boolean;
  style?: ViewStyle;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const y = useSharedValue(height);
  const scrim = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
    } else if (mounted) {
      y.value = withTiming(height, { duration: 240, easing: Easing.in(Easing.cubic) }, (fin) => {
        if (fin) scheduleOnRN(setMounted, false);
      });
      scrim.value = withTiming(0, { duration: 240 });
    }
  }, [open]);

  useEffect(() => {
    if (mounted && open) {
      y.value = height;
      y.value = withSpring(0, SPRING.sheet);
      scrim.value = withTiming(1, { duration: 300 });
    }
  }, [mounted, open]);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      y.value = e.translationY > 0 ? e.translationY : e.translationY * 0.12;
      scrim.value = Math.max(0, 1 - e.translationY / 600);
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) {
        scheduleOnRN(onClose);
      } else {
        y.value = withSpring(0, SPRING.sheet);
        scrim.value = withTiming(1);
      }
    });

  const sheetSt = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrimSt = useAnimatedStyle(() => ({ opacity: scrim.value }));

  if (!mounted) return null;

  const body = (
    <Animated.View
      style={[
        styles.sheet,
        full ? { top: insets.top + 10, bottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, left: 0, right: 0 } : { bottom: Math.max(8, insets.bottom - 18) },
        sheetSt,
        style,
      ]}
    >
      {!dragWholeSheet ? (
        <GestureDetector gesture={pan}>
          <View style={styles.grabZone}>
            <View style={styles.grabber} />
          </View>
        </GestureDetector>
      ) : (
        <View style={styles.grabZone}>
          <View style={styles.grabber} />
        </View>
      )}
      {children}
    </Animated.View>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimSt]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть" />
      </Animated.View>
      {dragWholeSheet ? <GestureDetector gesture={pan}>{body}</GestureDetector> : body}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(18,19,22,0.32)' },
  sheet: {
    position: 'absolute',
    left: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 34,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  grabZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
  grabber: { width: 38, height: 5, borderRadius: 3, backgroundColor: '#DCDCD8' },
});
