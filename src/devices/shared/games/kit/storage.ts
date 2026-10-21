/** Tiny localStorage wrapper for game scores and settings (`iport-games-<key>`). */
const PREFIX = 'iport-games-';

export function loadData<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return { ...fallback };
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...fallback, ...(v as Partial<T>) };
  } catch {
    /* private mode / corrupt value */
  }
  return { ...fallback };
}

export function saveData(key: string, value: object): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}
