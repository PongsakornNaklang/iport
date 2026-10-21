/**
 * Contacts (iOS 15): searchable, letter-indexed list, My Card, contact card,
 * add / edit sheet.
 */
import { useMemo, useRef, useState } from 'react';
import { useCustomize } from '../../../core/customize/store';
import { useLibrary } from '../../../core/library/store';
import { useSettings } from '../../../core/settings/store';
import type { Contact } from '../../../core/types';
import { Glyph } from '../os/glyphs';
import { os, usePrefs } from '../os/store';
import { Scroller } from '../os/Scroller';
import { Cell, Empty, NavStack, Page, SearchField, Section, Sheet, SheetHeader, TextButton, TextInput, useNav } from '../os/ui';

export const fullName = (c: Pick<Contact, 'firstName' | 'lastName' | 'company'>) => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || 'No Name';
const initials = (c: Pick<Contact, 'firstName' | 'lastName' | 'company'>) =>
  ((c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '')).toUpperCase() || (c.company?.[0] ?? '').toUpperCase();

export function Avatar({ c, size }: { c: Pick<Contact, 'firstName' | 'lastName' | 'company'>; size: number }) {
  const i = initials(c);
  return (
    <span className="t7a-circle t7p-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {i || <Glyph name="person.fill" size={size * 0.62} />}
    </span>
  );
}

export default function Contacts() {
  return (
    <div className="t7p-root">
      <NavStack root={<ContactList />} rootTitle="Contacts" />
    </div>
  );
}

function ContactList() {
  const nav = useNav()!;
  const contacts = useLibrary((s) => s.contacts);
  const sortBy = useSettings((s) => s.contactsSortBy);
  const owner = useCustomize((s) => s.appearances[s.modelId]?.engraving?.[0]);
  const device = usePrefs((s) => s.deviceName);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => {
    const key = (c: Contact) => (sortBy === 'first' ? c.firstName || c.lastName : c.lastName || c.firstName) || c.company || '#';
    const list = contacts
      .filter((c) => !q.trim() || `${fullName(c)} ${c.company ?? ''} ${c.phones.map((p) => p.value).join(' ')} ${c.emails.map((e) => e.value).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => key(a).localeCompare(key(b)));
    const m = new Map<string, Contact[]>();
    for (const c of list) {
      const l = key(c)[0]?.toUpperCase() ?? '#';
      const L = /[A-Z]/.test(l) ? l : '#';
      if (!m.has(L)) m.set(L, []);
      m.get(L)!.push(c);
    }
    return [...m.entries()];
  }, [contacts, q, sortBy]);
  const me = owner?.trim() || `${device} Owner`;
  const jump = (l: string) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-letter="${l}"]`);
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - 64;
  };
  return (
    <div className="t7p-wrap">
      <Page
        title="Contacts"
        left={<TextButton onPress={() => os.toast('Lists · All iPod', 'person.2')}>Lists</TextButton>}
        right={
          <button className="t7-gbtn" aria-label="Add Contact" onClick={() => setAdding(true)}>
            <Glyph name="plus" size={22} />
          </button>
        }
        search={<SearchField value={q} onChange={setQ} />}
      >
        <div
          ref={(n) => {
            scroller.current = (n?.closest('.t7-scroll') as HTMLDivElement | null) ?? null;
          }}
        />
        {!q && (
          <div className="t7p-me">
            <Avatar c={{ firstName: me.split(' ')[0], lastName: me.split(' ').slice(1).join(' ') }} size={56} />
            <div>
              <div className="t7p-me-n">{me}</div>
              <div className="t7p-me-s">My Card</div>
            </div>
          </div>
        )}
        {groups.map(([l, list]) => (
          <div key={l} data-letter={l}>
            <div className="t7p-letter">{l}</div>
            {list.map((c) => (
              <div key={c.id} className="t7p-row" onClick={() => nav.push(<ContactCard id={c.id} />, fullName(c))}>
                {sortBy === 'first' ? (
                  <>
                    <b>{c.firstName}</b> {c.lastName}
                  </>
                ) : c.lastName ? (
                  <>
                    {c.firstName} <b>{c.lastName}</b>
                  </>
                ) : (
                  <b>{fullName(c)}</b>
                )}
              </div>
            ))}
          </div>
        ))}
        {!groups.length && <Empty glyph="person.crop.circle" title={q ? 'No Results' : 'No Contacts'} text={q ? undefined : 'Tap + to add someone, or import a vCard from the Library panel.'} />}
        {contacts.length > 0 && !q && <div className="t7p-count">{contacts.length} Contact{contacts.length === 1 ? '' : 's'}</div>}
      </Page>
      {groups.length > 6 && (
        <div className="t7p-index">
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map((l) => (
            <span key={l} onClick={() => jump(l)}>
              {l}
            </span>
          ))}
        </div>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)}>
        {adding && (
          <ContactEditor
            onDone={(id) => {
              setAdding(false);
              if (id) window.setTimeout(() => nav.push(<ContactCard id={id} />, ''), 350);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function ContactCard({ id }: { id: string }) {
  const c = useLibrary((s) => s.contacts.find((x) => x.id === id));
  const [edit, setEdit] = useState(false);
  if (!c) return <Page title="" large={false} />;
  const phone = c.phones[0]?.value;
  const mail = c.emails[0]?.value;
  const actions: { g: string; l: string; on?: () => void }[] = [
    { g: 'message.fill', l: 'message', on: phone || mail ? () => os.toast('iMessage needs Wi-Fi', 'message.fill') : undefined },
    { g: 'phone.fill', l: 'call', on: phone ? () => os.toast('FaceTime Audio', 'phone.fill') : undefined },
    { g: 'video.fill', l: 'video', on: phone || mail ? () => os.toast('FaceTime', 'video.fill') : undefined },
    { g: 'envelope.fill', l: 'mail', on: mail ? () => window.open(`mailto:${mail}`) : undefined },
  ];
  return (
    <Page title="" large={false} bg="grouped" right={<TextButton onPress={() => setEdit(true)}>Edit</TextButton>}>
      <div className="t7p-card-head">
        <Avatar c={c} size={84} />
        <div className="t7p-card-name">{fullName(c)}</div>
        {c.company && (c.firstName || c.lastName) && <div className="t7p-card-co">{c.company}</div>}
        <div className="t7p-actions">
          {actions.map((a) => (
            <button key={a.l} className={a.on ? '' : 'off'} onClick={a.on}>
              <Glyph name={a.g} size={20} />
              <span>{a.l}</span>
            </button>
          ))}
        </div>
      </div>
      {c.phones.length > 0 && (
        <Section>
          {c.phones.map((p, i) => (
            <Cell key={i} title={<span className="t7p-val">{p.value}</span>} subtitle={undefined} detail={undefined} className="t7p-field" icon={<span className="t7p-lbl">{p.label || 'phone'}</span>} />
          ))}
        </Section>
      )}
      {c.emails.length > 0 && (
        <Section>
          {c.emails.map((p, i) => (
            <Cell key={i} title={<span className="t7p-val">{p.value}</span>} className="t7p-field" icon={<span className="t7p-lbl">{p.label || 'email'}</span>} onPress={() => window.open(`mailto:${p.value}`)} />
          ))}
        </Section>
      )}
      {(c.address || c.birthday) && (
        <Section>
          {c.address && <Cell title={<span className="t7p-val wrap">{c.address}</span>} className="t7p-field" icon={<span className="t7p-lbl">address</span>} />}
          {c.birthday && <Cell title={<span className="t7p-val">{c.birthday}</span>} className="t7p-field" icon={<span className="t7p-lbl">birthday</span>} />}
        </Section>
      )}
      <Section>
        <div className="t7p-notes">
          <span className="t7p-lbl">Notes</span>
          <div>{c.notes}</div>
        </div>
      </Section>
      <Section>
        <Cell title="Send Message" tint onPress={actions[0].on} />
        <Cell title="Share Contact" tint onPress={() => void navigator.clipboard?.writeText(`${fullName(c)}\n${[...c.phones, ...c.emails].map((x) => x.value).join('\n')}`).then(() => os.toast('Copied'), () => {})} />
        <Cell title="Add to Favorites" tint onPress={() => os.toast('Added to Favorites', 'star.fill')} />
      </Section>
      <Sheet open={edit} onClose={() => setEdit(false)}>
        {edit && <ContactEditor contact={c} onDone={() => setEdit(false)} />}
      </Sheet>
    </Page>
  );
}

function ContactEditor({ contact, onDone }: { contact?: Contact; onDone: (id?: string) => void }) {
  const nav = useNav();
  const [first, setFirst] = useState(contact?.firstName ?? '');
  const [last, setLast] = useState(contact?.lastName ?? '');
  const [company, setCompany] = useState(contact?.company ?? '');
  const [phone, setPhone] = useState(contact?.phones[0]?.value ?? '');
  const [email, setEmail] = useState(contact?.emails[0]?.value ?? '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const empty = !first.trim() && !last.trim() && !company.trim();
  const save = () => {
    if (empty) return;
    const id = useLibrary.getState().upsertContact({
      id: contact?.id,
      firstName: first.trim(),
      lastName: last.trim(),
      company: company.trim() || undefined,
      phones: phone.trim() ? [{ label: contact?.phones[0]?.label || 'mobile', value: phone.trim() }, ...(contact?.phones.slice(1) ?? [])] : contact?.phones.slice(1) ?? [],
      emails: email.trim() ? [{ label: contact?.emails[0]?.label || 'home', value: email.trim() }, ...(contact?.emails.slice(1) ?? [])] : contact?.emails.slice(1) ?? [],
      notes: notes.trim() || undefined,
    });
    onDone(contact ? undefined : id);
  };
  return (
    <div className="t7c-editor">
      <SheetHeader
        left={<TextButton onPress={() => onDone()}>Cancel</TextButton>}
        title={contact ? '' : 'New Contact'}
        right={
          <TextButton bold disabled={empty} onPress={save}>
            Done
          </TextButton>
        }
      />
      <Scroller className="t7c-editor-scroll">
        <div className="t7p-edit-head">
          <Avatar c={{ firstName: first, lastName: last, company }} size={84} />
          <button className="t7-tbtn" onClick={() => os.toast('Add Photo', 'camera.fill')}>
            Add Photo
          </button>
        </div>
        <Section>
          <div className="t7cal-in">
            <TextInput value={first} onChange={setFirst} placeholder="First name" autoFocus={!contact} />
          </div>
          <div className="t7cal-in">
            <TextInput value={last} onChange={setLast} placeholder="Last name" />
          </div>
          <div className="t7cal-in">
            <TextInput value={company} onChange={setCompany} placeholder="Company" />
          </div>
        </Section>
        <Section>
          <div className="t7cal-in t7p-in">
            <span className="t7p-plus">
              <Glyph name="plus.circle.fill" size={20} />
            </span>
            <TextInput value={phone} onChange={setPhone} placeholder="add phone" type="tel" />
          </div>
        </Section>
        <Section>
          <div className="t7cal-in t7p-in">
            <span className="t7p-plus">
              <Glyph name="plus.circle.fill" size={20} />
            </span>
            <TextInput value={email} onChange={setEmail} placeholder="add email" type="email" />
          </div>
        </Section>
        <Section>
          <div className="t7cal-in tall">
            <TextInput value={notes} onChange={setNotes} placeholder="Notes" multiline />
          </div>
        </Section>
        {contact && (
          <Section>
            <Cell
              title="Delete Contact"
              destructive
              center
              onPress={() =>
                os.alert({
                  sheet: true,
                  actions: [
                    {
                      label: 'Delete Contact',
                      style: 'destructive',
                      onPress: () => {
                        onDone();
                        nav?.pop();
                        window.setTimeout(() => useLibrary.getState().removeContact(contact.id), 450);
                      },
                    },
                    { label: 'Cancel', style: 'cancel' },
                  ],
                })
              }
            />
          </Section>
        )}
      </Scroller>
    </div>
  );
}
