import { useMemo } from 'react';
import { useLibrary } from '../../../../core/library/store';
import { useSettings } from '../../../../core/settings/store';
import type { Contact } from '../../../../core/types';
import { GAMES } from '../../../shared/games/registry';
import { useOS, type ScreenSpec } from '../core';
import { TextScreen } from '../common';
import { ListView, type Row } from '../ListView';
import { AlarmsScreen, ClocksScreen, StopwatchScreen } from './Clock';
import { CalendarsMenu, MonthView } from './Calendar';
import { ScreenLockMenu } from './ScreenLock';
import { VoiceMemosScreen } from './VoiceMemos';

export const EX = {
  alarms: (): ScreenSpec => ({ title: 'Alarms', el: <AlarmsScreen /> }),
  calendars: (): ScreenSpec => ({ title: 'Calendars', el: <CalendarsMenu /> }),
  calendar: (): ScreenSpec => ({ title: 'Calendar', el: <MonthView /> }),
  clocks: (): ScreenSpec => ({ title: 'Clocks', el: <ClocksScreen /> }),
  contacts: (): ScreenSpec => ({ title: 'Contacts', el: <ContactsScreen /> }),
  games: (): ScreenSpec => ({ title: 'Games', el: <GamesScreen /> }),
  notes: (): ScreenSpec => ({ title: 'Notes', el: <NotesScreen /> }),
  screenLock: (): ScreenSpec => ({ title: 'Screen Lock', el: <ScreenLockMenu /> }),
  stopwatch: (): ScreenSpec => ({ title: 'Stopwatch', el: <StopwatchScreen /> }),
  voiceMemos: (): ScreenSpec => ({ title: 'Voice Memos', el: <VoiceMemosScreen /> }),
};

export function ExtrasMenu() {
  const os = useOS();
  const rows = useMemo<Row[]>(() => {
    const items: [string, () => ScreenSpec, boolean?][] = [
      ['Alarms', EX.alarms],
      ['Calendars', EX.calendars],
      ['Clocks', EX.clocks],
      ['Contacts', EX.contacts],
      ['Games', EX.games, os.caps.games],
      ['Notes', EX.notes],
      ['Screen Lock', EX.screenLock, os.caps.screenLock],
      ['Stopwatch', EX.stopwatch, os.caps.stopwatch],
      ['Voice Memos', EX.voiceMemos, os.caps.voiceMemos],
    ];
    return items.filter(([, , cap]) => cap !== false).map(([label, spec]) => ({ key: label, label, chevron: true, onSelect: () => os.nav.push(spec()) }));
  }, [os]);
  return <ListView rows={rows} />;
}

function GamesScreen() {
  const os = useOS();
  // the games this iPod came with, under the names it used
  const rows = useMemo<Row[]>(
    () => os.caps.gameList.filter((g) => GAMES.some((x) => x.id === g.id)).map((g) => ({ key: g.id, label: g.name, onSelect: () => os.runGame(g.id) })),
    [os],
  );
  return <ListView rows={rows} empty="No Games" />;
}

function NotesScreen() {
  const os = useOS();
  const notes = useLibrary((s) => s.notes);
  const rows = useMemo<Row[]>(
    () =>
      [...notes]
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((n) => ({ key: n.id, label: n.title || 'Untitled', chevron: true, onSelect: () => os.nav.push({ title: n.title || 'Note', el: <NoteView id={n.id} /> }) })),
    [notes, os],
  );
  return <ListView rows={rows} empty="No Notes" />;
}

function NoteView({ id }: { id: string }) {
  const note = useLibrary((s) => s.notes.find((n) => n.id === id));
  return <TextScreen text={note?.body ?? ''} />;
}

function contactName(c: Contact, by: 'first' | 'last'): string {
  const n = by === 'first' ? `${c.firstName} ${c.lastName}` : `${c.lastName}${c.lastName && c.firstName ? ', ' : ''}${c.firstName}`;
  return n.trim() || c.company || 'No Name';
}

function ContactsScreen() {
  const os = useOS();
  const contacts = useLibrary((s) => s.contacts);
  const by = useSettings((s) => s.contactsSortBy);
  const rows = useMemo<Row[]>(() => {
    const key = (c: Contact) => (by === 'first' ? c.firstName || c.lastName : c.lastName || c.firstName) || c.company || '';
    return [...contacts]
      .sort((a, b) => key(a).localeCompare(key(b)))
      .map((c) => ({
        key: c.id,
        label: `${c.firstName} ${c.lastName}`.trim() || c.company || 'No Name',
        sort: key(c),
        chevron: true,
        onSelect: () => os.nav.push({ title: contactName(c, 'first'), el: <ContactView id={c.id} /> }),
      }));
  }, [contacts, by, os]);
  return <ListView rows={rows} indexed empty="No Contacts" />;
}

function ContactView({ id }: { id: string }) {
  const c = useLibrary((s) => s.contacts.find((x) => x.id === id));
  const rows = useMemo<Row[]>(() => {
    if (!c) return [];
    const out: Row[] = [];
    const add = (label: string, value?: string) => value && out.push({ key: `${out.length}`, label: value, detail: label });
    add('', `${c.firstName} ${c.lastName}`.trim());
    add('company', c.company);
    c.phones.forEach((p) => add(p.label || 'phone', p.value));
    c.emails.forEach((e) => add(e.label || 'email', e.value));
    add('address', c.address);
    add('birthday', c.birthday);
    if (c.notes) add('notes', c.notes);
    return out;
  }, [c]);
  return <ListView rows={rows} />;
}
