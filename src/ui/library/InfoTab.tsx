/** Info tab — what iTunes synced besides media: notes, contacts, calendars, alarms & clocks. */
import { IconAlarm, IconCalendar, IconContact, IconNote } from './icons';
import { useSticky } from './state';
import { Segmented } from './ui';
import { Notes } from './info/Notes';
import { Contacts } from './info/Contacts';
import { Calendar } from './info/Calendar';
import { Alarms } from './info/Alarms';

type Sub = 'notes' | 'contacts' | 'calendar' | 'alarms';

export function InfoTab() {
  const [sub, setSub] = useSticky<Sub>('info.sub', 'notes', true);
  return (
    <>
      <Segmented
        value={sub}
        onChange={setSub}
        options={[
          { value: 'notes', label: <><IconNote /> Notes</> },
          { value: 'contacts', label: <><IconContact /> Contacts</> },
          { value: 'calendar', label: <><IconCalendar /> Calendar</> },
          { value: 'alarms', label: <><IconAlarm /> Clock</> },
        ]}
      />
      <div style={{ marginTop: 12 }}>
        {sub === 'notes' && <Notes />}
        {sub === 'contacts' && <Contacts />}
        {sub === 'calendar' && <Calendar />}
        {sub === 'alarms' && <Alarms />}
      </div>
    </>
  );
}
