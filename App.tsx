// Корень приложения: шрифты, жесты, экраны, шторки, уведомления и фоновые проверки.
import React, { useEffect, useRef } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';
import { Onest_700Bold } from '@expo-google-fonts/onest/700Bold';

import { C } from './src/theme';
import { DB } from './src/lib/db';
import { addDaysKey, todayKey } from './src/lib/date';
import { findTaskById, getState, moveTask, nav, refreshSign, setStatus, signExpiry, subscribe, tick, useApp } from './src/lib/store';
import { setupNotifications, snooze, syncNotifications } from './src/lib/notifications';
import { TodayScreen } from './src/screens/TodayScreen';
import { WeeksScreen } from './src/screens/WeeksScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { TaskSheet } from './src/screens/TaskSheet';
import { EditorSheet } from './src/screens/EditorSheet';
import { SettingsSheet } from './src/screens/SettingsSheet';
import { TabBar, ToastView } from './src/components/Chrome';

// ---------- реакция на кнопки в уведомлениях ----------

async function dismissFor(taskId: string) {
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown.filter((n) => (n.request.content.data as Record<string, unknown>)?.taskId === taskId).map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {}
}

function handleResponse(r: Notifications.NotificationResponse | null) {
  if (!r) return;
  const key = r.notification.request.identifier + '|' + r.actionIdentifier + '|' + r.notification.date;
  if (DB.get<string>('lastResponse', '') === key) return;
  DB.set('lastResponse', key);

  const data = (r.notification.request.content.data ?? {}) as Record<string, string>;
  if (data.kind === 'sign') {
    nav.settings(true);
    return;
  }
  const t = findTaskById(data.taskId ?? null);
  if (!t) return;
  switch (r.actionIdentifier) {
    case 'done':
      setStatus(t.id, 'done', true);
      dismissFor(t.id);
      break;
    case 'late':
      setStatus(t.id, 'late', true);
      dismissFor(t.id);
      break;
    case 'snooze':
      snooze(t, 10);
      break;
    case 'tomorrow':
      moveTask(t.id, addDaysKey(t.date < todayKey() ? todayKey() : t.date, 1), t.start);
      dismissFor(t.id);
      break;
    default:
      nav.openDay(t.date);
      nav.sheet(t.id);
  }
}

// Подписка на изменения: пересобираем очередь уведомлений не чаще, чем раз в 0,6 с.
function useNotificationSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = { tasks: getState().tasks, settings: getState().settings, sign: getState().sign };
    const run = () => {
      const s = getState();
      syncNotifications(s.tasks, s.settings, signExpiry(s));
    };
    run();
    return subscribe(() => {
      const s = getState();
      if (s.tasks === last.tasks && s.settings === last.settings && s.sign === last.sign) return;
      last = { tasks: s.tasks, settings: s.settings, sign: s.sign };
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 600);
    });
  }, []);
}

function Screens() {
  const { tab } = useApp();
  return (
    <Animated.View key={tab} entering={FadeIn.duration(260)} exiting={FadeOut.duration(140)} style={{ flex: 1 }}>
      {tab === 'today' ? <TodayScreen /> : tab === 'weeks' ? <WeeksScreen /> : <StatsScreen />}
    </Animated.View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold });
  const ready = useRef(false);

  useEffect(() => {
    setupNotifications().then(() => {
      handleResponse(Notifications.getLastNotificationResponse());
      ready.current = true;
    });
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    const clock = setInterval(tick, 30000);
    // Android: кнопка «Назад» сначала закрывает открытые шторки.
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      const s = getState();
      if (s.editor) nav.editor(null);
      else if (s.sheetTask) nav.sheet(null);
      else if (s.settingsOpen) nav.settings(false);
      else if (s.tab !== 'today') nav.tab('today');
      else return false;
      return true;
    });
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        refreshSign();
        tick();
      }
    });
    return () => {
      sub.remove();
      clearInterval(clock);
      back.remove();
      app.remove();
    };
  }, []);

  useNotificationSync();

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <StatusBar style="dark" />
          <Screens />
          <TabBar />
          <ToastView />
          <TaskSheet />
          <EditorSheet />
          <SettingsSheet />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
});
