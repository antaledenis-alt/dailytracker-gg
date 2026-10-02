// Настройки: подпись приложения (сколько осталось до переподписи), уведомления по умолчанию.
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sheet } from '../components/Sheet';
import { Chip, Icon, Press, Ring, Switch, Txt } from '../components/ui';
import { nav, refreshSign, showToast, signExpiry, updateSettings, useApp } from '../lib/store';
import { leftTxt } from '../lib/signing';
import { dateTimeTxt } from '../lib/date';
import { testNotification } from '../lib/notifications';
import { C, ICONS } from '../theme';

const WEEK = 7 * 24 * 3600000;

export function SettingsSheet() {
  const s = useApp();
  const exp = signExpiry(s);
  const left = exp ? exp - s.clock : 0;
  const pct = exp ? Math.max(0, Math.min(100, (left / WEEK) * 100)) : 0;
  const tone = !exp ? C.mute2 : left < 24 * 3600000 ? C.danger : left < 2 * 24 * 3600000 ? '#A06D22' : C.ok;
  const st = s.settings;

  return (
    <Sheet open={s.settingsOpen} onClose={() => nav.settings(false)} full dragWholeSheet={false} style={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Txt w="b" size={26} style={{ letterSpacing: -0.4 }}>Настройки</Txt>

        <Txt w="s" size={12.5} color="#8A8D93" style={styles.lbl}>ПОДПИСЬ ПРИЛОЖЕНИЯ</Txt>
        <Animated.View entering={FadeInDown.springify()} style={styles.card}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Ring size={64} stroke={7} pct={pct} color={tone}>
              <Icon d={ICONS.key} size={20} color={tone} />
            </Ring>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt w="s" size={16}>{exp ? (left > 0 ? 'Осталось ' + leftTxt(left) : 'Подпись истекла') : 'Срок не определён'}</Txt>
              <Txt size={13} color={C.mute}>
                {exp ? 'Действует до ' + dateTimeTxt(exp) + (s.sign.source === 'profile' ? '' : ' (по твоей отметке)') : 'Не удалось прочитать срок из приложения. Отметь вручную после переподписи.'}
              </Txt>
            </View>
          </View>
          <Txt size={13} color={C.mute} style={{ marginTop: 12, lineHeight: 19 }}>
            Бесплатная подпись живёт 7 дней. Я напомню за сутки, за 3 часа и за 30 минут. Чтобы продлить: SideStore → My Apps → Refresh All, затем открой Планер — срок обновится сам.
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Press
              haptic="light"
              onPress={() => {
                refreshSign();
                showToast('Срок подписи проверен', undefined, 'info');
              }}
              style={styles.btn}
            >
              <Txt w="s" size={13.5}>Проверить срок</Txt>
            </Press>
            {s.sign.source !== 'profile' && (
              <Press
                haptic="medium"
                onPress={() => {
                  updateSettings({ manualSignedAt: Date.now() });
                  showToast('Отмечено: переподписано сегодня');
                }}
                style={[styles.btn, { backgroundColor: C.ink }]}
              >
                <Txt w="s" size={13.5} color="#fff">Я переподписал сегодня</Txt>
              </Press>
            )}
          </View>
        </Animated.View>

        <Txt w="s" size={12.5} color="#8A8D93" style={styles.lbl}>НАПОМИНАНИЯ ДЛЯ НОВЫХ ЗАДАЧ</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[30, 15, 5, 0].map((r) => {
            const on = st.rem.includes(r);
            return (
              <Chip
                key={r}
                label={r === 0 ? 'В момент начала' : 'За ' + r + ' мин'}
                on={on}
                onPress={() => updateSettings({ rem: on ? st.rem.filter((x) => x !== r) : [...st.rem, r] })}
              />
            );
          })}
        </View>

        <Txt w="s" size={12.5} color="#8A8D93" style={styles.lbl}>НАСТОЙЧИВЫЕ ПОВТОРЫ</Txt>
        <Txt size={13} color={C.mute} style={{ marginBottom: 8 }}>Интервал</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[3, 5, 10, 15].map((m) => (
            <Chip key={m} label={m + ' мин'} on={st.insistEvery === m} onPress={() => updateSettings({ insistEvery: m })} style={{ flex: 1 }} />
          ))}
        </View>
        <Txt size={13} color={C.mute} style={{ marginVertical: 8 }}>Сколько раз</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[2, 3, 5].map((n) => (
            <Chip key={n} label={n + (n === 5 ? ' раз' : ' раза')} on={st.insistCount === n} onPress={() => updateSettings({ insistCount: n })} style={{ flex: 1 }} />
          ))}
        </View>

        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt w="s" size={15}>Спрашивать «как прошло?»</Txt>
            <Txt size={12.5} color={C.mute2}>Уведомление в конце задачи с кнопками «Сделано», «Позже», «На завтра»</Txt>
          </View>
          <Switch on={st.endCheck} onChange={(endCheck) => updateSettings({ endCheck })} />
        </View>

        <Press
          haptic="medium"
          onPress={async () => {
            await testNotification();
            showToast('Через 5 секунд придёт тестовое уведомление', undefined, 'info');
          }}
          style={[styles.btn, { marginTop: 16, height: 50, backgroundColor: C.ink }]}
        >
          <Icon d={ICONS.bell} size={18} color="#fff" />
          <Txt w="s" size={15} color="#fff">Проверить уведомление</Txt>
        </Press>
        <Txt size={12} color={C.faint} style={{ marginTop: 18, textAlign: 'center' }}>Планер · версия 0.1 · данные хранятся только на этом телефоне</Txt>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lbl: { marginTop: 22, marginBottom: 10, letterSpacing: 0.5 },
  card: { backgroundColor: '#F6F6F3', borderRadius: 20, padding: 16 },
  btn: { height: 42, paddingHorizontal: 14, borderRadius: 13, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
});
