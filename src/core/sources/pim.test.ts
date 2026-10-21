import { describe, expect, it } from 'vitest';
import { contactKey, parseVCards } from './vcard';
import { eventKey, parseDuration, parseIcs, zonedTime } from './ics';

const VCF = `BEGIN:VCARD
VERSION:3.0
N:Appleseed;John;Q;;
FN:John Q Appleseed
ORG:Apple Inc.;Music
item1.TEL;type=CELL;type=pref:+66 81 234 5678
TEL;TYPE=WORK,VOICE:02-123-4567
EMAIL;type=INTERNET;type=HOME:john@example.com
ADR;TYPE=HOME:;;1 Infinite Loop;Cupertino;CA;95014;USA
BDAY:1990-01-31
NOTE:Line one\\nLine two\\, with comma
END:VCARD
BEGIN:VCARD
VERSION:2.1
N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=E0=B8=AA=E0=B8=A1=E0=B8=8A=E0=B8=B2=E0=B8=A2;=E0=B8=AA=E0=B8=A1=
=E0=B8=AB=E0=B8=8D=E0=B8=B4=E0=B8=87;;;
TEL;HOME:081-000-0000
END:VCARD
BEGIN:VCARD
VERSION:4.0
FN:Only Fullname
EMAIL:only@example.com
BDAY:--0412
END:VCARD
BEGIN:VCARD
VERSION:3.0
END:VCARD`;

describe('vCard', () => {
  it('parses contacts', () => {
    const cs = parseVCards(VCF);
    expect(cs).toHaveLength(3);
    expect(cs[0]).toEqual({
      firstName: 'John Q',
      lastName: 'Appleseed',
      company: 'Apple Inc., Music',
      phones: [
        { label: 'mobile', value: '+66 81 234 5678' },
        { label: 'work', value: '02-123-4567' },
      ],
      emails: [{ label: 'home', value: 'john@example.com' }],
      address: '1 Infinite Loop\nCupertino CA 95014\nUSA',
      birthday: '1990-01-31',
      notes: 'Line one\nLine two, with comma',
    });
    expect(cs[1]).toMatchObject({ lastName: 'สมชาย', firstName: 'สมหญิง', phones: [{ label: 'home', value: '081-000-0000' }] });
    expect(cs[2]).toMatchObject({ firstName: 'Only', lastName: 'Fullname', birthday: '--04-12' });
  });
});

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
SUMMARY:Lunch\\, with Team
DTSTART:20250310T050000Z
DTEND:20250310T060000Z
LOCATION:Siam
DESCRIPTION:Bring\\nlaptop
BEGIN:VALARM
TRIGGER:-PT15M
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
BEGIN:VEVENT
SUMMARY:Songkran
DTSTART;VALUE=DATE:20250413
DTEND;VALUE=DATE:20250416
END:VEVENT
BEGIN:VEVENT
SUMMARY:Bangkok meeting
DTSTART;TZID=Asia/Bangkok:20250310T090000
DURATION:PT1H30M
END:VEVENT
BEGIN:VEVENT
SUMMARY:Weekly class
DTSTART:20250303T110000Z
DTEND:20250303T120000Z
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4
EXDATE:20250305T110000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Cancelled
STATUS:CANCELLED
DTSTART:20250301T000000Z
END:VEVENT
END:VCALENDAR`;

describe('iCalendar', () => {
  const window = { from: Date.UTC(2025, 0, 1), to: Date.UTC(2025, 11, 31) };
  it('parses events', () => {
    const evs = parseIcs(ICS, window);
    const lunch = evs.find((e) => e.title === 'Lunch, with Team')!;
    expect(lunch).toMatchObject({ start: Date.UTC(2025, 2, 10, 5), end: Date.UTC(2025, 2, 10, 6), location: 'Siam', notes: 'Bring\nlaptop' });
    const songkran = evs.find((e) => e.title === 'Songkran')!;
    expect(songkran.allDay).toBe(true);
    expect(songkran.end - songkran.start).toBeGreaterThanOrEqual(3 * 86400_000 - 3600_000);
    const bkk = evs.find((e) => e.title === 'Bangkok meeting')!;
    expect(bkk.start).toBe(Date.UTC(2025, 2, 10, 2)); // 09:00 +07:00
    expect(bkk.end - bkk.start).toBe(90 * 60_000);
    expect(evs.some((e) => e.title === 'Cancelled')).toBe(false);
  });

  it('expands simple recurrence', () => {
    const classes = parseIcs(ICS, window).filter((e) => e.title === 'Weekly class');
    // Mon 3, Wed 5 (excluded), Mon 10, Wed 12 → COUNT=4 includes the excluded one
    expect(classes.map((e) => new Date(e.start).toISOString().slice(0, 10))).toEqual(['2025-03-03', '2025-03-10', '2025-03-12']);
  });

  it('helpers', () => {
    expect(parseDuration('P1DT2H30M')).toBe((26 * 60 + 30) * 60_000);
    expect(parseDuration('PT15M')).toBe(15 * 60_000);
    expect(zonedTime(2025, 0, 1, 0, 0, 0, 'America/New_York')).toBe(Date.UTC(2025, 0, 1, 5));
  });
});

describe('re-import keys', () => {
  it('match the same person regardless of phone formatting / case', () => {
    const [a] = parseVCards(VCF);
    const again = { ...a, firstName: a.firstName.toUpperCase(), phones: [{ label: 'mobile', value: '+66812345678' }] };
    expect(contactKey(again)).toBe(contactKey(a));
    expect(contactKey({ ...a, lastName: 'Seed' })).not.toBe(contactKey(a));
    const company = { firstName: '', lastName: '', company: 'Apple', phones: [], emails: [{ label: 'work', value: 'Hi@Apple.com' }] };
    expect(contactKey(company)).toBe('apple|hi@apple.com');
  });
  it('match the same event occurrence', () => {
    const evs = parseIcs(ICS, { from: Date.UTC(2025, 0, 1), to: Date.UTC(2025, 11, 31) });
    const keys = evs.map(eventKey);
    expect(new Set(keys).size).toBe(keys.length); // recurring occurrences stay distinct
    expect(parseIcs(ICS, { from: Date.UTC(2025, 0, 1), to: Date.UTC(2025, 11, 31) }).map(eventKey)).toEqual(keys);
  });
});
