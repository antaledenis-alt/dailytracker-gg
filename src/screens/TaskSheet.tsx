// Шторка задачи: статус, напоминания и действия — выполнено, перенести, пропустить, изменить.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Sheet } from '../components/Sheet';
import { Icon, Press, Txt } from '../components/ui';
import { findTaskById, moveTask, nav, setStatus, shiftAfter, useApp } from '../lib/store';
import { addDaysKey, dayTitle, DFULL, DN, dowKey, fmt, nowMin, todayKey } from '../lib/date';
import type { Task } from '../lib/db';
import { C, CATS, ICONS } from '../theme';

function remText(rem: number[]) {
  if (!rem.length) return 'Без напоминаний';
  const s = rem.map((m) => (m === 0 ? 'в момент' : 'за ' + m + ' мин')).join(' · ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function TaskSheet() {
  const s = useApp();
  const [last, setLast] = useState<Task | null>(null);
  const t = findTaskById(s.sheetTask);
  useEffect(() => {
    if (t) setLast(t);
  }, [t]);
  const [rs, setRs] = useState(false);
  useEffect(() => {
    if (!s.sheetTask) setRs(false);
  }, [s.sheetTask]);

  const show = t ?? last;
  const close = () => nav.sheet(null);

  let body: React.ReactNode = null;
  if (show) {
    const cat = CATS[show.cat];
    const isToday = show.date === todayKey();
    const now = nowMin();
    const isNow = isToday && show.status === 'plan' && show.start <= now && now < show.start + show.dur;
    const st: Record<string, [string, string]> = {
      plan: [isNow ? 'Идёт сейчас' : 'Запланировано', isNow ? C.now : C.mute2],
      done: ['Выполнено вовремя', C.ok],
      late: ['Выполнено позже', '#A06D22'],
      missed: ['Пропущено', C.danger],
    };
    const act = (label: string, kind: 'pri' | 'sec' | 'ghost', fn: () => void, icon?: string) => ({ label, kind, fn, icon });
    const doSet = (x: Task['status']) => () => {
      setStatus(show.id, x);
      close();
    };
    const toggleRs = () => setRs((v) => !v);
    let actions;
    if (show.status === 'plan')
      actions = [act('Выполнено', 'pri', doSet('done'), ICONS.check), act(rs ? 'Скрыть варианты' : 'Перенести', 'sec', toggleRs), act('Пропустить', 'ghost', doSet('missed'))];
    else if (show.status === 'missed')
      actions = [act('Сделал вовремя', 'pri', doSet('done'), ICONS.check), act('Сделал позже', 'sec', doSet('late')), act(rs ? 'Скрыть варианты' : 'Перенести', 'sec', toggleRs)];
    else if (show.status === 'done') actions = [act('Выполнено позже', 'sec', doSet('late')), act('Вернуть в план', 'sec', doSet('plan'))];
    else actions = [act('Сделано вовремя', 'sec', doSet('done')), act('Вернуть в план', 'sec', doSet('plan'))];

    const tomorrow = addDaysKey(show.date < todayKey() ? todayKey() : show.date, 1);
    const base = show.date < todayKey() ? todayKey() : show.date;
    const later = base === todayKey() ? Math.max(show.start, Math.ceil(now / 30) * 30) : show.start;
    const opts = [
      { l: '+30 минут', sub: fmt(later + 30), fn: () => moveTask(show.id, base, later + 30, 'Перенесено на ' + fmt(later + 30) + ' · напоминания обновлены') },
      { l: '+1 час', sub: fmt(later + 60), fn: () => moveTask(show.id, base, later + 60, 'Перенесено на ' + fmt(later + 60) + ' · напоминания обновлены') },
      { l: 'Вечером', sub: '19:00', fn: () => moveTask(show.id, base, 19 * 60, 'Перенесено на вечер, 19:00') },
      { l: 'Завтра', sub: DN[dowKey(tomorrow)] + ', ' + fmt(show.start), fn: () => moveTask(show.id, tomorrow, show.start, 'Перенесено на завтра, ' + fmt(show.start)) },
    ];

    body = (
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={[styles.catTag, { backgroundColor: cat.bg }]}>
            <Icon d={cat.icon} size={16} color={cat.c} stroke={2} />
            <Txt w="s" size={13} color={cat.c}>{cat.name}</Txt>
          </View>
          <Txt w="s" size={12.5} color={st[show.status][1]}>{st[show.status][0]}</Txt>
        </View>
        <Txt w="b" size={24} style={{ marginTop: 12, letterSpacing: -0.4 }}>{show.title}</Txt>
        <Txt size={15} color={C.mute} style={{ marginTop: 4 }}>{DFULL[dowKey(show.date)] + ', ' + dayTitle(show.date) + ' · ' + fmt(show.start) + '–' + fmt(show.start + show.dur)}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          <View style={styles.tag}>
            <Icon d={ICONS.bell} size={15} color={C.mute} />
            <Txt size={13} color={C.mute}>{remText(show.rem)}</Txt>
          </View>
          {show.insist && (
            <View style={[styles.tag, { backgroundColor: '#FBEDEA' }]}>
              <Icon d={ICONS.repeat} size={15} color={C.danger} />
              <Txt w="m" size={13} color={C.danger}>Настойчиво</Txt>
            </View>
          )}
          {show.seriesId && (
            <View style={styles.tag}>
              <Icon d={ICONS.repeat} size={15} color={C.mute} />
              <Txt size={13} color={C.mute}>Повторяется</Txt>
            </View>
          )}
        </View>

        {rs && (
          <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOut.duration(150)} style={{ marginTop: 18 }}>
            <Txt w="s" size={13} color={C.mute2} style={{ marginBottom: 8 }}>Перенести на</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {opts.map((o) => (
                <Press
                  key={o.l}
                  haptic="select"
                  scaleTo={0.94}
                  onPress={() => {
                    o.fn();
                    close();
                  }}
                  style={styles.opt}
                >
                  <Txt w="s" size={14}>{o.l}</Txt>
                  <Txt size={11.5} color={C.mute2}>{o.sub}</Txt>
                </Press>
              ))}
            </View>
            {show.status === 'plan' && isToday && (
              <Press
                haptic="medium"
                onPress={() => {
                  shiftAfter(show.id, 30);
                  close();
                }}
                style={[styles.opt, { width: '100%', marginTop: 8, flexDirection: 'row', gap: 8 }]}
              >
                <Txt w="s" size={14}>Сдвинуть остаток дня на +30 мин</Txt>
              </Press>
            )}
          </Animated.View>
        )}

        <Animated.View layout={LinearTransition.springify().damping(18)} style={{ gap: 8, marginTop: 18 }}>
          {actions.map((a) => (
            <Press
              key={a.label}
              haptic={a.kind === 'pri' ? 'medium' : 'light'}
              scaleTo={0.96}
              onPress={a.fn}
              style={[styles.act, a.kind === 'pri' && { backgroundColor: C.ink }, a.kind === 'sec' && { backgroundColor: C.chip }]}
            >
              {a.icon && <Icon d={a.icon} size={18} color="#fff" stroke={2.4} />}
              <Txt w="s" size={15} color={a.kind === 'pri' ? '#fff' : a.kind === 'ghost' ? C.danger : C.ink}>{a.label}</Txt>
            </Press>
          ))}
          <Press haptic="light" onPress={() => nav.editor({ mode: 'edit', taskId: show.id })} style={[styles.act, { height: 44 }]}>
            <Txt w="m" size={14} color={C.mute}>Изменить задачу</Txt>
          </Press>
        </Animated.View>
      </View>
    );
  }

  return (
    <Sheet open={!!t} onClose={close}>
      {body}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  catTag: { height: 28, paddingLeft: 6, paddingRight: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { height: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F4F4F1', flexDirection: 'row', alignItems: 'center', gap: 6 },
  opt: { width: '48.6%', height: 50, borderRadius: 15, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  act: { height: 52, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
