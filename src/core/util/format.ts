/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatTime(sec: number | undefined): string {
  if (sec == null || !isFinite(sec) || sec < 0) return '--:--';
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const ss = s.toString().padStart(2, '0');
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** Sort key the way iPod/iTunes sorts: ignores a leading "The ", "A ", "An ". */
export function sortKey(s: string | undefined): string {
  const t = (s ?? '').trim().toLowerCase();
  return t.replace(/^(the|a|an)\s+/, '');
}

export function compareTitles(a: string | undefined, b: string | undefined): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  // Names starting with a letter come before digits/symbols, like the iPod.
  const la = /^[a-z]/.test(ka);
  const lb = /^[a-z]/.test(kb);
  if (la !== lb) return la ? -1 : 1;
  return ka.localeCompare(kb, undefined, { numeric: true, sensitivity: 'base' });
}

/** The index letter used by the iPod quick-scroll overlay / touch index bar. */
export function indexLetter(s: string | undefined): string {
  const k = sortKey(s);
  const c = k.charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

export function formatClock(d: Date, use24h: boolean): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  if (use24h) return `${h.toString().padStart(2, '0')}:${m}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
}
