// Создание и редактирование задачи: название, категория, день, время, длительность, повтор, напоминания.
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring, ZoomIn } from 'react-native-reanimated';
import { Sheet } from '../components/Sheet';
import { CatPattern } from '../components/Pattern';
import { Chip, haptic, Icon, Press, Switch, Txt, useWiggle } from '../components/ui';
import { addTask, deleteTask, findTaskById, getState, nav, updateTask, useApp } from '../lib/store';
import { DN, dowKey, durTxt, fmt, fromKey, nowMin, shortDate, todayKey, windowKeys } from '../lib/date';
import { C, CAT_ORDER, CatKey, CATS, ICONS, SPRING } from '../theme';

interface Form {
  title: string;
  cat: CatKey;
  date: string;
  start: number;
  dur: number;
  rem: number[];
  insist: boolean;
  days: boolean[];
}

const DURS = [30, 60, 90, 120, 180];
const REMS = [30, 15, 5, 0];

function initial(): Form {
  const s = getState();
  const ed = s.editor;
  const today = todayKey();
  if (ed?.mode === 'edit' && ed.taskId) {
    const t = findTaskById(ed.taskId);
    if (t) return { title: t.title, cat: t.cat, date: t.date, start: t.start, dur: t.dur, rem: t.rem, insist: t.insist, days: [false, false, false, false, false, false, false] };
  }
  const date = ed?.date && ed.date >= today ? ed.date : s.day >= today ? s.day : today;
  const start = ed?.start ?? (date === today ? Math.min(23 * 60, Math.ceil((nowMin() + 5) / 30) * 30) : 9 * 60);
  return { title: '', cat: 'work', date, start, dur: 60, rem: s.settings.rem, insist: false, days: [false, false, false, false, false, false, false] };
}

function Preview({ f }: { f: Form }) {
  const cat = CATS[f.cat];
  const h = useSharedValue(Math.max(54, f.dur * 0.55 + 16));
  useEffect(() => {
    h.value = withSpring(Math.max(54, f.dur * 0.55 + 16), SPRING.bouncy);
  }, [f.dur]);
  const st = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View style={[styles.preview, { backgroundColor: cat.bg }, st]}>
      <Animated.View key={f.cat} entering={FadeIn.duration(300)} style={StyleSheet.absoluteFill}>
        <CatPattern kind={cat.pattern} color={cat.c} />
      </Animated.View>
      <Animated.View key={'i' + f.cat} entering={ZoomIn.springify().damping(12)} style={[styles.pIco, { backgroundColor: cat.c }]}>
        <Icon d={cat.icon} size={16} color="#fff" stroke={2} />
      </Animated.View>
      <View style={{ gap: 2, flex: 1 }}>
        <Txt w="s" size={14.5} numberOfLines={1}>{f.title.trim() || 'Без названия'}</Txt>
        <Txt size={12} color={C.mute}>{dateLabel(f.date) + ' · ' + fmt(f.start) + '–' + fmt(f.start + f.dur) + ' · ' + durTxt(f.dur)}</Txt>
      </View>
    </Animated.View>
  );
}

function dateLabel(k: string) {
  const t = todayKey();
  if (k === t) return 'Сегодня';
  const d = fromKey(k);
  const diff = Math.round((d.getTime() - fromKey(t).getTime()) / 86400000);
  if (diff === 1) return 'Завтра';
  return DN[dowKey(k)] + ', ' + shortDate(k);
}

export function EditorSheet() {
  const s = useApp();
  const open = !!s.editor;
  const [f, setF] = useState<Form>(initial);
  const [shake, setShake] = useState(0);
  const wiggle = useWiggle(shake);
  const editing = s.editor?.mode === 'edit' ? findTaskById(s.editor.taskId ?? null) : null;

  useEffect(() => {
    if (open) setF(initial());
  }, [open, s.editor?.taskId, s.editor?.date, s.editor?.start]);

  const up = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const close = () => nav.editor(null);

  const today = todayKey();
  const dates = windowKeys().filter((k) => k >= today);
  if (!dates.includes(f.date)) dates.unshift(f.date);
  const nDays = f.days.filter(Boolean).length;
  const repTxt = nDays === 0 ? 'не повторять' : nDays === 7 ? 'каждый день' : nDays === 5 && f.days.slice(0, 5).every(Boolean) ? 'по будням' : DN.filter((_, i) => f.days[i]).join(', ');
  const remTimes = REMS.filter((r) => f.rem.includes(r)).map((r) => fmt(f.start - r));

  const save = () => {
    if (!f.title.trim()) {
      haptic('warn');
      setShake((x) => x + 1);
      return;
    }
    haptic('success');
    if (editing) updateTask(editing.id, f);
    else addTask(f);
    close();
  };

  return (
    <Sheet open={open} onClose={close} full dragWholeSheet={false} style={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <View style={styles.top}>
        <Press haptic="light" onPress={close} style={{ paddingVertical: 6 }}>
          <Txt w="m" size={15} color={C.mute2}>Отмена</Txt>
        </Press>
        <Txt w="s" size={15}>{editing ? 'Изменить задачу' : 'Новая задача'}</Txt>
        <Press haptic="none" onPress={save} style={{ paddingVertical: 6 }}>
          <Txt w="s" size={15} color={C.ok}>Готово</Txt>
        </Press>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View style={wiggle}>
          <TextInput
            value={f.title}
            onChangeText={(title) => up({ title })}
            placeholder="Что запланируем?"
            placeholderTextColor="#B5B7BB"
            autoFocus={!editing}
            returnKeyType="done"
            style={styles.title}
            accessibilityLabel="Название задачи"
          />
        </Animated.View>
        <Preview f={f} />

        <Txt w="s" size={12.5} color="#8A8D93" style={styles.lbl}>КАТЕГОРИЯ</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {CAT_ORDER.map((k) => {
            const c = CATS[k];
            const on = f.cat === k;
            return (
              <Press key={k} haptic="select" scaleTo={0.92} onPress={() => up({ cat: k })} style={[styles.cat, { backgroundColor: on ? c.bg : '#F6F6F3', borderColor: on ? c.c : 'transparent' }]}>
                <View style={[styles.catIco, { backgroundColor: c.c }]}>
                  <Icon d={c.icon} size={16} color="#fff" stroke={2} />
                </View>
                <Txt w="s" size={12} color={C.ink2}>{c.name}</Txt>
              </Press>
            );
          })}
        </View>

        <Txt w="s" size={12.5} color="#8A8D93" style={styles.lbl}>КОГДА</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
          {dates.map((k) => (
            <Chip key={k} label={dateLabel(k)} on={f.date === k} onPress={() => up({ date: k })} />
          ))}
        </ScrollView>

        <View style={styles.timeBox}>
          <View>
            <Txt w="m" size={12} color="#8A8D93">Начало</Txt>
            <Animated.View key={f.start} entering={ZoomIn.springify().damping(14).stiffness(260)}>
              <Txt w="b" size={28} style={{ letterSpacing: -0.4 }}>{fmt(f.start)}</Txt>
            </Animated.View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Press haptic="select" scaleTo={0.85} onPress={() => up({ start: Math.max(0, f.start - 30) })} style={styles.step} accessibilityLabel="Раньше на 30 минут">
              <Icon d={ICONS.minus} size={18} stroke={2.2} />
            </Press>
            <Press haptic="select" scaleTo={0.85} onPress={() => up({ start: Math.min(23 * 60 + 30, f.start + 30) })} style={styles.step} accessibilityLabel="Позже на 30 минут">
              <Icon d={ICONS.plus} size={18} stroke={2.2} />
            </Press>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          {DURS.map((d) => (
            <Chip key={d} label={d < 60 ? d + ' мин' : String(d / 60).replace('.', ',') + ' ч'} on={f.dur === d} onPress={() => up({ dur: d })} style={{ flex: 1, paddingHorizontal: 4 }} />
          ))}
        </View>

        {!editing && (
          <>
            <Txt w="s" size={12.5} color="#8A8D93" style={styles.lbl}>{'ПОВТОР · ' + repTxt.toUpperCase()}</Txt>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {DN.map((l, i) => (
                <Chip
                  key={l}
                  label={l}
                  on={f.days[i]}
                  onPress={() => up({ days: f.days.map((v, j) => (j === i ? !v : v)) })}
                  style={{ width: 42, height: 42, borderRadius: 21, paddingHorizontal: 0 }}
                />
              ))}
            </View>
          </>
        )}

        <Txt w="s" size={12.5} color="#8A8D93" style={styles.lbl}>НАПОМИНАНИЯ</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {REMS.map((r) => {
            const on = f.rem.includes(r);
            return (
              <Chip
                key={r}
                label={r === 0 ? 'В момент начала' : 'За ' + r + ' мин'}
                on={on}
                onPress={() => up({ rem: on ? f.rem.filter((x) => x !== r) : [...f.rem, r] })}
                left={on ? <Icon d={ICONS.check} size={14} color="#fff" stroke={2.6} /> : undefined}
              />
            );
          })}
        </View>
        <View style={styles.insist}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt w="s" size={15}>Настойчивое напоминание</Txt>
            <Txt size={12.5} color={C.mute2}>{'Повторять каждые ' + getState().settings.insistEvery + ' мин, пока не отмечу — до ' + getState().settings.insistCount + ' раз'}</Txt>
          </View>
          <Switch on={f.insist} onChange={(insist) => up({ insist })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <Icon d={ICONS.bell} size={16} color={C.mute} />
          <Txt size={13} color={C.mute} style={{ flex: 1 }}>
            {remTimes.length ? 'Напомню в ' + remTimes.join(', ') + (f.insist ? ', затем повторю' : '') : 'Без напоминаний'}
          </Txt>
        </View>

        {editing && (
          <View style={{ gap: 8, marginTop: 26 }}>
            <Press
              haptic="medium"
              onPress={() => {
                deleteTask(editing.id);
                close();
              }}
              style={styles.del}
            >
              <Icon d={ICONS.trash} size={18} color={C.danger} />
              <Txt w="s" size={15} color={C.danger}>Удалить задачу</Txt>
            </Press>
            {editing.seriesId && (
              <Press
                haptic="light"
                onPress={() => {
                  deleteTask(editing.id, true);
                  close();
                }}
                style={styles.del}
              >
                <Txt w="s" size={15} color={C.danger}>Удалить вместе с будущими повторами</Txt>
              </Press>
            )}
          </View>
        )}
      </ScrollView>
      <View style={styles.bottom}>
        <Press haptic="none" onPress={save} style={styles.cta} scaleTo={0.96}>
          <Txt w="s" size={16} color="#fff">{editing ? 'Сохранить' : 'Добавить в план'}</Txt>
        </Press>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 40 },
  title: { fontFamily: 'Onest_700Bold', fontSize: 26, color: C.ink, height: 48, letterSpacing: -0.4 },
  preview: { marginTop: 12, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10 },
  pIco: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  lbl: { marginTop: 22, marginBottom: 10, letterSpacing: 0.5 },
  cat: { flex: 1, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2 },
  catIco: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  timeBox: { marginTop: 12, backgroundColor: '#F6F6F3', borderRadius: 18, paddingVertical: 10, paddingLeft: 14, paddingRight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.chip2, alignItems: 'center', justifyContent: 'center' },
  insist: { marginTop: 12, backgroundColor: '#F6F6F3', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  del: { height: 50, borderRadius: 16, backgroundColor: '#FBEDEA', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, backgroundColor: 'rgba(255,255,255,0.96)' },
  cta: { height: 56, borderRadius: 19, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
});
