/**
 * Small helpers shared by the iPod touch apps.
 */
import { useEffect, useRef, useState } from 'react';
import { blobUrl } from '../../../core/db';
import { useApp } from '../os/ui';
import { useOS } from '../os/store';

/** Object URL for an IndexedDB blob key (null while loading / missing). */
export function useBlobUrl(key: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!key) return;
    blobUrl(key).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [key]);
  return url;
}

/** Open the browser's file picker. */
export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    input.onchange = () => {
      resolve(Array.from(input.files ?? []));
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

const remoteCache = new Map<string, unknown>();

/** Fetch once per key (cached for the session); `retry` refetches. */
export function useRemote<T>(key: string | null, fn: () => Promise<T>): { data: T | null; error: string | null; loading: boolean; retry: () => void } {
  const [n, setN] = useState(0);
  const [st, setSt] = useState<{ data: T | null; error: string | null; loading: boolean }>(() => {
    const c = key ? (remoteCache.get(key) as T | undefined) : undefined;
    return { data: c ?? null, error: null, loading: !!key && !c };
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!key) {
      setSt({ data: null, error: null, loading: false });
      return;
    }
    const c = remoteCache.get(key) as T | undefined;
    if (c && n === 0) {
      setSt({ data: c, error: null, loading: false });
      return;
    }
    let alive = true;
    setSt((s) => ({ data: s.data, error: null, loading: true }));
    fnRef
      .current()
      .then((d) => {
        remoteCache.set(key, d);
        if (alive) setSt({ data: d, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (alive) setSt({ data: null, error: e instanceof Error ? e.message : String(e), loading: false });
      });
    return () => {
      alive = false;
    };
  }, [key, n]);
  return { ...st, retry: () => setN((x) => x + 1) };
}

/** Deep-link payload for this app (from Control Center / quick actions). Consumed once. */
export function useIntent(onIntent: (data: string) => void) {
  const app = useApp();
  const intent = useOS((s) => s.intent);
  const cb = useRef(onIntent);
  cb.current = onIntent;
  useEffect(() => {
    if (!intent || intent.app !== app.id) return;
    useOS.setState({ intent: null });
    // let the app mount its views first
    window.setTimeout(() => cb.current(intent.data), 30);
  }, [intent, app.id]);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today", "Yesterday", weekday within a week, else a short date — like iOS lists. */
export function listDate(t: number, withTime = false): string {
  const d = new Date(t);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, now)) return withTime ? time : 'Today';
  if (sameDay(d, y)) return 'Yesterday';
  if (now.getTime() - t < 6 * 86400_000) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

/** Grey offline / error line used by apps that talk to the internet. */
export function Offline({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="t7a-offline">
      <span>{text}</span>
      {onRetry && (
        <button className="t7-tbtn" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

export function Spinner({ light }: { light?: boolean }) {
  return <div className={`t7-spinner ${light ? 'light' : ''}`} />;
}
