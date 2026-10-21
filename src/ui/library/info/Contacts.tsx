import { useMemo, useRef, useState } from 'react';
import { useLibrary } from '@/core/library/store';
import { parseVCards } from '@/core/sources/vcard';
import type { Contact } from '@/core/types';
import { compareTitles } from '@/core/util/format';
import { IconClose, IconPlus, IconTrash, IconUpload } from '../../icons';
import { toast } from '../../toast';
import { IconContact } from '../icons';
import { Confirm, Empty, SearchField, Sheet } from '../ui';

export function fullName(c: Contact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || c.emails[0]?.value || c.phones[0]?.value || 'No Name';
}

function initials(c: Contact): string {
  const s = (c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '');
  return (s || fullName(c)[0] || '?').toUpperCase();
}

export function Contacts() {
  const contacts = useLibrary((s) => s.contacts);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return contacts
      .filter((c) => !w || `${fullName(c)} ${c.company ?? ''} ${c.phones.map((p) => p.value).join(' ')} ${c.emails.map((e) => e.value).join(' ')}`.toLowerCase().includes(w))
      .sort((a, b) => compareTitles(a.lastName || a.firstName || fullName(a), b.lastName || b.firstName || fullName(b)) || compareTitles(a.firstName, b.firstName));
  }, [contacts, q]);

  const importVcf = async (files: FileList | null) => {
    let n = 0;
    for (const f of Array.from(files ?? [])) {
      try {
        for (const c of parseVCards(await f.text())) {
          useLibrary.getState().upsertContact(c);
          n++;
        }
      } catch {
        /* skip bad file */
      }
    }
    toast(n ? `Imported ${n} contact${n === 1 ? '' : 's'}` : 'No contacts found in that file');
  };

  return (
    <>
      <div className="lib-row-flex">
        <div className="grow">
          <SearchField value={q} onChange={setQ} placeholder="Search contacts" live />
        </div>
        <button className="btn" onClick={() => fileRef.current?.click()} title="Import a .vcf file (vCard) exported from Contacts, Google or your phone">
          <IconUpload /> .vcf
        </button>
        <button className="btn primary" onClick={() => setEditing('new')} aria-label="New contact">
          <IconPlus />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".vcf,.vcard,text/vcard,text/x-vcard"
        multiple
        hidden
        onChange={(e) => {
          void importVcf(e.target.files);
          e.target.value = '';
        }}
      />
      {contacts.length === 0 ? (
        <Empty icon={<IconContact />} title="No contacts">
          Import a vCard (.vcf) exported from your phone, iCloud or Google Contacts, or add people by hand.
        </Empty>
      ) : (
        <div className="list" style={{ marginTop: 10 }}>
          {list.map((c) => (
            <div key={c.id} className="list-item lib-row clickable" onClick={() => setEditing(c)}>
              <div className="lib-avatar">{initials(c)}</div>
              <div className="li-text">
                <div className="li-title">{fullName(c)}</div>
                <div className="li-sub">{[c.company, c.phones[0]?.value, c.emails[0]?.value].filter(Boolean).join(' · ')}</div>
              </div>
              <span className="lib-chev">›</span>
            </div>
          ))}
        </div>
      )}
      {editing && <ContactEditor contact={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

type Multi = { label: string; value: string }[];

function MultiField({ label, items, onChange, labels, type }: { label: string; items: Multi; onChange: (m: Multi) => void; labels: string[]; type: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {items.map((it, i) => (
        <div className="lib-multi" key={i}>
          <select className="select" value={it.label} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}>
            {[...new Set([...labels, it.label])].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <input className="input" type={type} value={it.value} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <button className="lib-rbtn" type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <IconClose width={12} height={12} />
          </button>
        </div>
      ))}
      <button className="btn small ghost" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...items, { label: labels[0], value: '' }])}>
        <IconPlus /> Add {label.toLowerCase().replace(/s$/, '')}
      </button>
    </div>
  );
}

function ContactEditor({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const [c, setC] = useState<Omit<Contact, 'id'>>(() => contact ?? { firstName: '', lastName: '', phones: [{ label: 'mobile', value: '' }], emails: [] });
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof Omit<Contact, 'id'>>(k: K, v: Contact[K]) => setC((x) => ({ ...x, [k]: v }));
  const save = () => {
    const clean = {
      ...c,
      firstName: c.firstName.trim(),
      lastName: c.lastName.trim(),
      company: c.company?.trim() || undefined,
      phones: c.phones.filter((p) => p.value.trim()),
      emails: c.emails.filter((p) => p.value.trim()),
      address: c.address?.trim() || undefined,
      notes: c.notes?.trim() || undefined,
      birthday: c.birthday || undefined,
    };
    if (!clean.firstName && !clean.lastName && !clean.company && !clean.phones.length && !clean.emails.length) return onClose();
    useLibrary.getState().upsertContact({ ...clean, id: contact?.id });
    onClose();
  };
  return (
    <Sheet
      title={contact ? 'Edit Contact' : 'New Contact'}
      onClose={onClose}
      actions={
        <button className="btn small primary" onClick={save}>
          Save
        </button>
      }
    >
      <div className="lib-grid2">
        <div className="field">
          <label>First name</label>
          <input className="input" value={c.firstName} autoFocus={!contact} onChange={(e) => set('firstName', e.target.value)} />
        </div>
        <div className="field">
          <label>Last name</label>
          <input className="input" value={c.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Company</label>
        <input className="input" value={c.company ?? ''} onChange={(e) => set('company', e.target.value)} />
      </div>
      <MultiField label="Phones" type="tel" items={c.phones} labels={['mobile', 'iPhone', 'home', 'work', 'main', 'fax', 'other']} onChange={(m) => set('phones', m)} />
      <MultiField label="Emails" type="email" items={c.emails} labels={['home', 'work', 'other']} onChange={(m) => set('emails', m)} />
      <div className="field">
        <label>Address</label>
        <textarea className="input" rows={3} style={{ minHeight: 0 }} value={c.address ?? ''} onChange={(e) => set('address', e.target.value)} />
      </div>
      <div className="field">
        <label>Birthday</label>
        <input className="input" type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(c.birthday ?? '') ? c.birthday : ''} onChange={(e) => set('birthday', e.target.value)} />
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea className="input" rows={3} value={c.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </div>
      {contact && (
        <button className="btn danger" onClick={() => setConfirm(true)}>
          <IconTrash /> Delete Contact
        </button>
      )}
      {confirm && contact && (
        <Confirm
          title={`Delete ${fullName(contact)}?`}
          message="The contact is removed from every iPod."
          confirm="Delete"
          danger
          onConfirm={() => {
            useLibrary.getState().removeContact(contact.id);
            onClose();
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </Sheet>
  );
}
