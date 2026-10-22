import { useMemo, useState } from 'react';
import { searchLibrary, useTracks } from '../../../../core/library/selectors';
import { usePlayer } from '../../../../core/player/player';
import { useInput, useOS, useTitle } from '../core';
import { ListView, type Row } from '../ListView';
import { playList, songMenu } from './Music';
import { t as tx } from '../i18n';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('');
const SHOWN = 11;

/**
 * The classic letter-wheel search: turn the wheel to pick a letter, press
 * center to type it, ⏮ deletes, Menu moves to the results.
 */
export function SearchScreen() {
  const os = useOS();
  const tracks = useTracks();
  const current = usePlayer((s) => s.currentId);
  const [q, setQ] = useState('');
  const [ci, setCi] = useState(0);
  const [browse, setBrowse] = useState(false);
  const results = useMemo(() => searchLibrary(tracks, q, 300), [tracks, q]);
  useTitle(tx(browse ? 'Search Results' : 'Search'));

  const rows = useMemo<Row[]>(() => {
    const ids = results.map((t) => t.id);
    return results.map((t, i) => ({
      key: t.id,
      label: t.title,
      sub: [t.artist, t.album].filter(Boolean).join(' – '),
      art: t.artwork,
      speaker: t.id === current,
      onSelect: () => playList(os, ids, i),
      onHold: () => songMenu(os, t.id),
    }));
  }, [results, current, os]);

  useInput((e) => {
    if (browse) {
      if (e.type === 'click' && e.button === 'menu') {
        setBrowse(false);
        return true;
      }
      return false;
    }
    if (e.type === 'scroll') {
      setCi((c) => (((c + e.steps) % CHARS.length) + CHARS.length) % CHARS.length);
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      setQ((s) => (s + CHARS[ci]).replace(/^ +/, '').slice(0, 40));
      return true;
    }
    if ((e.type === 'click' || e.type === 'repeat') && e.button === 'prev') {
      setQ((s) => s.slice(0, -1));
      return true;
    }
    if (e.type === 'click' && e.button === 'next') {
      setQ((s) => (s && !s.endsWith(' ') ? `${s} ` : s));
      return true;
    }
    if (e.type === 'click' && e.button === 'menu') {
      if (q && results.length) {
        setBrowse(true);
        return true;
      }
      return false; // back
    }
    if (e.type === 'hold' && e.button === 'prev') return true;
    return false;
  });

  if (browse) return <ListView rows={rows} variant="art" />;

  const strip = [];
  for (let k = -Math.floor(SHOWN / 2); k <= Math.floor(SHOWN / 2); k++) {
    const idx = (((ci + k) % CHARS.length) + CHARS.length) % CHARS.length;
    const ch = CHARS[idx];
    strip.push(
      <span key={k} className={`cl-search-ch ${k === 0 ? 'on' : ''}`} style={{ opacity: 1 - Math.abs(k) * 0.07 }}>
        {ch === ' ' ? '␣' : ch}
      </span>,
    );
  }
  return (
    <div className="cl-search">
      <div className="cl-search-field">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <circle cx="5" cy="5" r="3.6" fill="none" stroke="#666" strokeWidth="1.5" />
          <path d="M7.6 7.6L11 11" stroke="#666" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="cl-search-q">
          {q}
          <span className="cl-caret" />
        </span>
        {q && <span className="cl-search-count">{results.length}</span>}
      </div>
      <div className="cl-search-results">
        {q ? (
          results.slice(0, 5).map((t) => (
            <div key={t.id} className="cl-search-res">
              <b>{t.title}</b>
              <span>{t.artist}</span>
            </div>
          ))
        ) : (
          <div className="cl-search-hint">{tx('Turn the wheel to choose letters, press the center button to enter.')}</div>
        )}
        {q && !results.length && <div className="cl-search-hint">{tx('No results')}</div>}
      </div>
      <div className="cl-search-strip">{strip}</div>
    </div>
  );
}
