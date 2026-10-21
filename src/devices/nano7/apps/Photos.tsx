/**
 * Photos: albums ▸ thumbnail grid ▸ full-screen viewer (swipe between
 * photos, tap for controls) ▸ slideshow using Settings ▸ Photos (time per
 * slide, transition, repeat, shuffle).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useArtworkUrls } from '../../../core/library/artwork';
import { useLibrary } from '../../../core/library/store';
import { useNano, useNanoData } from '../state';
import { Glyph } from '../os/icons';
import { Chevron, NavStack, useNav, usePage, type PageSpec } from '../os/Nav';
import { Pager } from '../os/Pager';
import { Page, Row } from '../os/ui';
import { t } from '../os/i18n';
import { useAppNav } from './registry';
import { samplePhotos } from './samplePhotos';

const TINT = '#007aff';

interface Pic {
  id: string;
  name: string;
  url: string | null;
  width: number;
  height: number;
  album?: string;
  favorite?: boolean;
  sample?: boolean;
}

function usePics(): { pics: Pic[]; samples: boolean } {
  const photos = useLibrary((s) => s.photos);
  const urls = useArtworkUrls(photos.map((p) => `idb:${p.blobKey}`));
  return useMemo(() => {
    if (photos.length) return { pics: photos.map((p, i) => ({ ...p, url: urls[i] ?? null })), samples: false };
    return { pics: samplePhotos().map((p) => ({ ...p, sample: true })), samples: true };
  }, [photos, urls]);
}

export function PhotosApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('photos');
  return <NavStack root={{ title: 'Photos', node: <Albums /> }} tint={TINT} active={active} apiRef={apiRef} />;
}

const gridSpec = (title: string, ids: string[]): PageSpec => ({ title, node: <Grid ids={ids} />, backLabel: title.length > 10 ? 'Back' : title });

function Albums() {
  const nav = useNav();
  const { pics, samples } = usePics();
  const albums = useMemo(() => {
    const m = new Map<string, Pic[]>();
    for (const p of pics) if (p.album) m.set(p.album, [...(m.get(p.album) ?? []), p]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pics]);
  const favs = pics.filter((p) => p.favorite);
  const row = (title: string, list: Pic[]) => (
    <Row
      key={title}
      art={list[0]?.url ?? undefined}
      artSize={52}
      tall
      title={title}
      subtitle={`${list.length} photo${list.length === 1 ? '' : 's'}`}
      chevron
      onClick={() => nav.push(gridSpec(title, list.map((p) => p.id)))}
      className="n7-photoalbum"
    />
  );
  return (
    <Page>
      {row(samples ? 'Sample Photos' : t('All Photos'), pics)}
      {favs.length > 0 && row(t('Favorites'), favs)}
      {albums.map(([name, list]) => row(name, list))}
      {samples && <div className="n7-photo-note">Add your own photos in the Library panel — they replace these samples.</div>}
    </Page>
  );
}

function Grid({ ids }: { ids: string[] }) {
  const nav = useNav();
  const { pics } = usePics();
  const list = ids.map((id) => pics.find((p) => p.id === id)).filter(Boolean) as Pic[];
  return (
    <Page>
      <div className="n7-photogrid">
        {list.map((p, i) => (
          <div
            key={p.id}
            className="n7-photothumb"
            onClick={() => nav.push({ title: p.name, node: <Viewer ids={ids} start={i} />, bar: false, hideStatus: true, theme: 'light', bg: '#000', kind: 'photo' })}
          >
            {p.url && <img src={p.url} alt="" draggable={false} />}
          </div>
        ))}
      </div>
      <div className="n7-photo-count">
        {list.length} Photo{list.length === 1 ? '' : 's'}
      </div>
    </Page>
  );
}

function Viewer({ ids, start }: { ids: string[]; start: number }) {
  const nav = useNav();
  const { top, active } = usePage();
  const { pics } = usePics();
  const list = ids.map((id) => pics.find((p) => p.id === id)).filter(Boolean) as Pic[];
  const [i, setI] = useState(Math.min(start, Math.max(0, list.length - 1)));
  const [chrome, setChrome] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (top && active) useNano.setState({ statusHidden: !chrome || show, statusTheme: 'light' });
  }, [chrome, show, top, active]);

  const p = list[i];
  if (!p) return null;
  return (
    <div className="n7-viewer">
      <Pager
        index={i}
        count={list.length}
        onChange={setI}
        gap={14}
        onTap={() => setChrome((c) => !c)}
        render={(k) => (
          <div className="n7-viewer-img">
            {list[k].url && <img src={list[k].url!} alt="" draggable={false} />}
          </div>
        )}
      />
      <div className={`n7-viewer-top ${chrome ? 'on' : ''}`}>
        <button className="n7-back" onClick={() => nav.pop()} style={{ ['--tint' as string]: '#fff' }}>
          <Chevron size={15} />
          <span>{t('Back')}</span>
        </button>
        <div className="n7-viewer-title">
          {i + 1} of {list.length}
        </div>
      </div>
      <div className={`n7-viewer-bottom ${chrome ? 'on' : ''}`}>
        <button onClick={() => setShow(true)} aria-label="Slideshow">
          <Glyph.play size={20} color="#fff" />
        </button>
        {!p.sample && (
          <button onClick={() => useLibrary.getState().togglePhotoFavorite(p.id)} aria-label="Favorite">
            <Heart filled={!!p.favorite} />
          </button>
        )}
      </div>
      {show && (
        <Slideshow
          list={list}
          start={i}
          onStop={(k) => {
            setI(k);
            setShow(false);
            setChrome(false);
          }}
        />
      )}
    </div>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.5 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill={filled ? '#ff2d55' : 'none'} stroke={filled ? '#ff2d55' : '#fff'} strokeWidth="1.6" />
    </svg>
  );
}

const TRANSITIONS = ['dissolve', 'push', 'zoom'] as const;

function Slideshow({ list, start, onStop }: { list: Pic[]; start: number; onStop: (i: number) => void }) {
  const d = useNanoData();
  const order = useMemo(() => {
    const idx = list.map((_, k) => k);
    if (!d.slideShuffle) return [...idx.slice(start), ...idx.slice(0, start)];
    for (let k = idx.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [idx[k], idx[j]] = [idx[j], idx[k]];
    }
    return idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pos, setPos] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [fx, setFx] = useState<(typeof TRANSITIONS)[number]>('dissolve');
  const posRef = useRef(0);
  useEffect(() => {
    const iv = window.setInterval(() => {
      const cur = posRef.current;
      let nx = cur + 1;
      if (nx >= order.length) {
        if (!d.slideRepeat) {
          onStop(order[cur]);
          return;
        }
        nx = 0;
      }
      posRef.current = nx;
      setPrev(cur);
      setPos(nx);
      setFx(d.slideTransition === 'random' ? TRANSITIONS[Math.floor(Math.random() * 3)] : d.slideTransition);
    }, Math.max(1, d.slideTime) * 1000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.slideTime, d.slideRepeat, d.slideTransition, order]);
  const cur = list[order[pos]];
  const old = prev != null ? list[order[prev]] : null;
  return (
    <div className="n7-slideshow" onClick={() => onStop(order[posRef.current])} data-noswipe>
      {old && old.url && <img key={`o${prev}-${pos}`} className={`n7-slide n7-slide-out-${fx}`} src={old.url} alt="" />}
      {cur?.url && <img key={`c${pos}`} className={`n7-slide ${prev != null ? `n7-slide-in-${fx}` : ''}`} src={cur.url} alt="" />}
    </div>
  );
}

