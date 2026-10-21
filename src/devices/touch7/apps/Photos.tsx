/**
 * Photos (iOS 15): Library grid (Years / Months / Days / All Photos),
 * For You, Albums, Search, and a full-screen viewer with swipe, double-tap
 * zoom, favorite, share and delete. Pictures live in IndexedDB.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { importFiles } from '../../../core/library/importLocal';
import { useLibrary } from '../../../core/library/store';
import { useTracks } from '../../../core/library/selectors';
import type { Photo } from '../../../core/types';
import { claim, localPoint, suppressNextClick, unitScale } from '../os/gesture';
import { Glyph } from '../os/glyphs';
import { os, useStatusBar } from '../os/store';
import { Empty, NavStack, Page, SearchField, Segmented, Tabs, TextButton, useApp, useNav } from '../os/ui';
import { openVideo } from './VideoPlayer';
import { pickFiles, useBlobUrl, useIntent } from './shared';

// ------------------------------------------------------------------ helpers

function Thumb({ p, size, onPress, radius = 0 }: { p: Photo; size: number | string; onPress?: () => void; radius?: number }) {
  const url = useBlobUrl(p.blobKey);
  return (
    <div className="t7ph-thumb" style={{ width: size, height: size, borderRadius: radius }} onClick={onPress}>
      {url && <img src={url} alt="" draggable={false} loading="lazy" />}
      {p.favorite && <Glyph name="heart.fill" size={11} className="t7ph-fav" />}
    </div>
  );
}

const byDate = (a: Photo, b: Photo) => a.addedAt - b.addedAt;

async function importPhotos() {
  const files = await pickFiles('image/*', true);
  if (!files.length) return;
  const r = await importFiles(files);
  if (r.photos.length) os.toast(`${r.photos.length} Item${r.photos.length === 1 ? '' : 's'} Imported`, 'photo.on.rectangle');
}

interface ViewerState {
  list: Photo[];
  index: number;
}
let openViewer: (v: ViewerState) => void = () => {};

// ------------------------------------------------------------------ app

export default function Photos() {
  const [tab, setTab] = useState('library');
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  openViewer = setViewer;
  useIntent((d) => {
    if (d === 'latest') {
      setTab('library');
      const ps = [...useLibrary.getState().photos].sort(byDate);
      if (ps.length) setViewer({ list: ps, index: ps.length - 1 });
    }
  });
  return (
    <div className="t7ph-root">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'library', label: 'Library', glyph: 'photo.on.rectangle', render: () => <LibraryTab /> },
          { id: 'foryou', label: 'For You', glyph: 'heart.text.square', render: (r) => <NavStack root={<ForYou />} rootTitle="For You" resetSerial={r} /> },
          { id: 'albums', label: 'Albums', glyph: 'rectangle.stack.fill', render: (r) => <NavStack root={<Albums />} rootTitle="Albums" resetSerial={r} /> },
          { id: 'search', label: 'Search', glyph: 'magnifyingglass', render: (r) => <NavStack root={<SearchTab />} rootTitle="Search" resetSerial={r} /> },
        ]}
      />
      {viewer && <Viewer state={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ Library

type Zoom = 'years' | 'months' | 'days' | 'all';

function LibraryTab() {
  const photos = useLibrary((s) => s.photos);
  const [zoom, setZoom] = useState<Zoom>('all');
  const list = useMemo(() => [...photos].sort(byDate), [photos]);
  const groups = useMemo(() => {
    if (zoom === 'all') return [];
    const fmt: Intl.DateTimeFormatOptions = zoom === 'years' ? { year: 'numeric' } : zoom === 'months' ? { month: 'long', year: 'numeric' } : { weekday: 'long', month: 'short', day: 'numeric' };
    const m = new Map<string, Photo[]>();
    for (const p of [...list].reverse()) {
      const k = new Date(p.addedAt).toLocaleDateString('en-US', fmt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return [...m.entries()];
  }, [list, zoom]);
  const range = list.length ? new Date(list[list.length - 1].addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return (
    <div className="t7ph-lib">
      <Page
        title={zoom === 'all' ? range || 'Library' : zoom === 'days' ? 'Days' : zoom === 'months' ? 'Months' : 'Years'}
        large={false}
        barAlways
        right={
          <>
            <button className="t7-gbtn" aria-label="Import" onClick={() => void importPhotos()}>
              <Glyph name="plus" size={20} />
            </button>
            <TextButton onPress={() => os.toast('Select Items', 'checkmark.circle.fill')}>Select</TextButton>
          </>
        }
      >
        {!list.length && (
          <Empty glyph="photo.on.rectangle" title="No Photos or Videos" text="Take photos with Camera, or import pictures from your computer.">
            <button className="t7-pill" onClick={() => void importPhotos()}>
              Import Photos
            </button>
          </Empty>
        )}
        {zoom === 'all' && list.length > 0 && (
          <>
            <div className="t7ph-grid">
              {list.map((p, i) => (
                <Thumb key={p.id} p={p} size="100%" onPress={() => openViewer({ list, index: i })} />
              ))}
            </div>
            <div className="t7ph-count">
              {list.length} Photo{list.length === 1 ? '' : 's'}
            </div>
          </>
        )}
        {zoom !== 'all' &&
          groups.map(([k, ps]) => (
            <div key={k} className={`t7ph-group ${zoom}`}>
              <div className="t7ph-group-h">{k}</div>
              <div className={`t7ph-group-grid n${Math.min(ps.length, 3)}`}>
                {ps.slice(0, zoom === 'days' ? 6 : 3).map((p) => (
                  <Thumb key={p.id} p={p} size="100%" radius={zoom === 'days' ? 0 : 0} onPress={() => openViewer({ list, index: list.indexOf(p) })} />
                ))}
              </div>
            </div>
          ))}
        <div style={{ height: 50 }} />
      </Page>
      {list.length > 0 && (
        <div className="t7ph-zoom">
          <Segmented
            items={[
              { id: 'years', label: 'Years' },
              { id: 'months', label: 'Months' },
              { id: 'days', label: 'Days' },
              { id: 'all', label: 'All Photos' },
            ]}
            value={zoom}
            onChange={(v) => setZoom(v as Zoom)}
          />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ For You

function ForYou() {
  const photos = useLibrary((s) => s.photos);
  const list = useMemo(() => [...photos].sort(byDate), [photos]);
  const featured = list.filter((p) => p.favorite).concat(list).slice(0, 6);
  const cover = list[list.length - 1];
  return (
    <Page title="For You">
      <div className="t7a-h2">Memories</div>
      {cover ? (
        <div className="t7ph-memory" onClick={() => openViewer({ list, index: list.length - 1 })}>
          <Thumb p={cover} size="100%" radius={12} />
          <div className="t7ph-memory-cap">
            <b>{new Date(cover.addedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
            <span>{list.length} Photos</span>
          </div>
        </div>
      ) : (
        <div className="t7a-hint">Memories appear when you have photos in your library.</div>
      )}
      <div className="t7a-h2">Sharing Suggestions</div>
      <div className="t7a-hint">Photos you take with others will appear here to share.</div>
      {featured.length > 0 && (
        <>
          <div className="t7a-h2">Featured Photos</div>
          <div className="t7ph-featured">
            {featured.map((p, i) => (
              <Thumb key={`${p.id}${i}`} p={p} size="100%" radius={8} onPress={() => openViewer({ list, index: list.indexOf(p) })} />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

// ------------------------------------------------------------------ Albums

function Albums() {
  const nav = useNav()!;
  const photos = useLibrary((s) => s.photos);
  const tracks = useTracks();
  const list = useMemo(() => [...photos].sort(byDate), [photos]);
  const albums = useMemo(() => {
    const m = new Map<string, Photo[]>();
    for (const p of list) if (p.album) (m.get(p.album) ?? m.set(p.album, []).get(p.album)!).push(p);
    return [...m.entries()];
  }, [list]);
  const favs = list.filter((p) => p.favorite);
  const videos = Object.values(tracks).filter((t) => t.album === 'Camera' && t.mediaType === 'movie');
  const open = (title: string, ps: Photo[]) => nav.push(<AlbumGrid title={title} photos={ps} />, title);
  const Tile = ({ title, ps }: { title: string; ps: Photo[] }) => (
    <div className="t7ph-album" onClick={() => open(title, ps)}>
      <div className="t7ph-album-art">{ps[ps.length - 1] ? <Thumb p={ps[ps.length - 1]} size="100%" radius={6} /> : <Glyph name="photo" size={40} />}</div>
      <div className="t">{title}</div>
      <div className="s">{ps.length}</div>
    </div>
  );
  return (
    <Page
      title="Albums"
      left={
        <button className="t7-gbtn" aria-label="New Album" onClick={() => void importPhotos()}>
          <Glyph name="plus" size={22} />
        </button>
      }
    >
      <div className="t7a-h2">My Albums</div>
      <div className="t7ph-albums">
        <Tile title="Recents" ps={list} />
        <Tile title="Favorites" ps={favs} />
        {albums.map(([name, ps]) => (
          <Tile key={name} title={name} ps={ps} />
        ))}
      </div>
      <div className="t7a-h2">Media Types</div>
      <div className="t7ph-types">
        <div
          className="t7a-row"
          onClick={() =>
            videos.length
              ? openVideo(
                  videos.map((v) => v.id),
                  0,
                )
              : os.toast('No Videos', 'video')
          }
        >
          <Glyph name="video" size={20} />
          <div className="t7a-row-main">Videos</div>
          <span className="n">{videos.length}</span>
          <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
        </div>
        <div className="t7a-row" onClick={() => open('Selfies', list.filter((p) => p.name.startsWith('IMG_F')))}>
          <Glyph name="person.crop.square" size={20} />
          <div className="t7a-row-main">Selfies</div>
          <span className="n">{list.filter((p) => p.name.startsWith('IMG_F')).length}</span>
          <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
        </div>
      </div>
      <div className="t7a-h2">Utilities</div>
      <div className="t7ph-types">
        <div className="t7a-row" onClick={() => open('Imports', list.filter((p) => !p.album))}>
          <Glyph name="square.and.arrow.down" size={20} />
          <div className="t7a-row-main">Imports</div>
          <span className="n">{list.filter((p) => !p.album).length}</span>
          <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
        </div>
        <div className="t7a-row" onClick={() => os.toast('Hidden album is locked', 'lock.fill')}>
          <Glyph name="eye" size={20} />
          <div className="t7a-row-main">Hidden</div>
          <Glyph name="lock.fill" size={13} className="t7-cell-chev" />
        </div>
        <div className="t7a-row" onClick={() => os.toast('Recently Deleted is empty', 'trash')}>
          <Glyph name="trash" size={20} />
          <div className="t7a-row-main">Recently Deleted</div>
          <Glyph name="lock.fill" size={13} className="t7-cell-chev" />
        </div>
      </div>
    </Page>
  );
}

function AlbumGrid({ title, photos }: { title: string; photos: Photo[] }) {
  const live = useLibrary((s) => s.photos);
  const ids = new Set(live.map((p) => p.id));
  const list = photos.filter((p) => ids.has(p.id)).map((p) => live.find((x) => x.id === p.id)!);
  return (
    <Page title={title} large={false}>
      {list.length ? (
        <div className="t7ph-grid">
          {list.map((p, i) => (
            <Thumb key={p.id} p={p} size="100%" onPress={() => openViewer({ list, index: i })} />
          ))}
        </div>
      ) : (
        <Empty glyph="photo" title="No Photos" />
      )}
    </Page>
  );
}

// ------------------------------------------------------------------ Search

function SearchTab() {
  const photos = useLibrary((s) => s.photos);
  const [q, setQ] = useState('');
  const list = useMemo(() => [...photos].sort(byDate), [photos]);
  const hits = q.trim()
    ? list.filter((p) => `${p.name} ${p.album ?? ''} ${new Date(p.addedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric', weekday: 'long' })}`.toLowerCase().includes(q.trim().toLowerCase()))
    : [];
  return (
    <Page title="Search" search={<SearchField value={q} onChange={setQ} placeholder="Photos, People, Places…" />}>
      {!q.trim() && (
        <>
          <div className="t7a-h2">Moments</div>
          <div className="t7ph-featured">
            {list.slice(-6).reverse().map((p) => (
              <Thumb key={p.id} p={p} size="100%" radius={8} onPress={() => openViewer({ list, index: list.indexOf(p) })} />
            ))}
          </div>
          {!list.length && <div className="t7a-hint">Search for photos by month, weekday, album or file name.</div>}
        </>
      )}
      {q.trim() && (
        <>
          <div className="t7a-hint" style={{ paddingTop: 6 }}>
            {hits.length} Result{hits.length === 1 ? '' : 's'}
          </div>
          <div className="t7ph-grid">
            {hits.map((p, i) => (
              <Thumb key={p.id} p={p} size="100%" onPress={() => openViewer({ list: hits, index: i })} />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

// ------------------------------------------------------------------ viewer

function Viewer({ state, onClose }: { state: ViewerState; onClose: () => void }) {
  const app = useApp();
  const photos = useLibrary((s) => s.photos);
  const [index, setIndex] = useState(state.index);
  const [chrome, setChrome] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const alive = state.list.filter((p) => photos.some((x) => x.id === p.id)).map((p) => photos.find((x) => x.id === p.id)!);
  const i = Math.min(index, alive.length - 1);
  const p = alive[i];
  useStatusBar(app.id, chrome ? null : 'hidden', true);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  useEffect(() => {
    if (!alive.length) onClose();
  }, [alive.length, onClose]);
  const g = useRef<{ x: number; y: number; k: number; id: number; mode: '' | 'h' | 'v'; t: number; lastTap: number } | null>(null);
  const lastTap = useRef(0);
  if (!p || !app.host) return null;
  const close = () => {
    setShown(false);
    window.setTimeout(onClose, 220);
  };
  const share = async () => {
    const { getBlob } = await import('../../../core/db');
    const b = await getBlob(p.blobKey);
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = p.name || 'photo.jpg';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const del = () =>
    os.alert({
      sheet: true,
      message: 'This photo will be deleted from your library.',
      actions: [
        {
          label: 'Delete Photo',
          style: 'destructive',
          onPress: () => {
            useLibrary.getState().removePhoto(p.id);
            if (i >= alive.length - 1) setIndex(Math.max(0, i - 1));
          },
        },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  const dx = drag?.dx ?? 0;
  const dy = drag?.dy ?? 0;
  const prev = alive[i - 1];
  const next = alive[i + 1];
  return createPortal(
    <div className={`t7ph-viewer ${chrome ? 'chrome' : 'bare'} ${shown ? 'shown' : ''}`} style={{ ['--fade' as string]: String(1 - Math.min(1, Math.abs(dy) / 300)) }}>
      <div
        ref={ref}
        className="t7ph-stage"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          g.current = { x: e.clientX, y: e.clientY, k: unitScale(e.currentTarget).kx, id: e.pointerId, mode: '', t: performance.now(), lastTap: 0 };
        }}
        onPointerMove={(e) => {
          const s = g.current;
          if (!s || zoomed) return;
          const ddx = (e.clientX - s.x) * s.k;
          const ddy = (e.clientY - s.y) * s.k;
          if (!s.mode) {
            if (Math.hypot(ddx, ddy) < 8) return;
            if (!claim(e.pointerId, e.currentTarget)) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            s.mode = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v';
          }
          if (s.mode === 'h') setDrag({ dx: (!prev && ddx > 0) || (!next && ddx < 0) ? ddx * 0.3 : ddx, dy: 0 });
          else setDrag({ dx: 0, dy: Math.max(0, ddy) });
        }}
        onPointerUp={(e) => {
          const s = g.current;
          g.current = null;
          if (!s) return;
          if (!s.mode) {
            const now = performance.now();
            if (now - lastTap.current < 300) {
              lastTap.current = 0;
              setZoomed((z) => !z);
            } else {
              lastTap.current = now;
              window.setTimeout(() => {
                if (lastTap.current === now) setChrome((c) => !c);
              }, 300);
            }
            return;
          }
          suppressNextClick();
          const ddx = (e.clientX - s.x) * s.k;
          const ddy = (e.clientY - s.y) * s.k;
          const v = Math.abs(ddx) / Math.max(1, performance.now() - s.t);
          if (s.mode === 'h') {
            if ((ddx < -80 || (ddx < -20 && v > 0.5)) && next) setIndex(i + 1);
            else if ((ddx > 80 || (ddx > 20 && v > 0.5)) && prev) setIndex(i - 1);
            setDrag(null);
          } else {
            setDrag(null);
            if (ddy > 110) close();
          }
        }}
        onPointerCancel={() => {
          g.current = null;
          setDrag(null);
        }}
      >
        <div className={`t7ph-strip ${drag ? 'dragging' : ''}`} style={{ transform: `translate3d(${dx}px, ${dy}px, 0) scale(${1 - Math.min(0.3, dy / 900)})` }}>
          {prev && <Slide p={prev} pos={-1} />}
          <Slide key={p.id} p={p} pos={0} zoomed={zoomed} />
          {next && <Slide p={next} pos={1} />}
        </div>
      </div>
      <div className="t7ph-vtop">
        <button className="t7-back" onClick={close}>
          <Glyph name="chevron.left" size={21} />
        </button>
        <div className="t7ph-vtitle">
          <b>{new Date(p.addedAt).toLocaleDateString('en-US', { weekday: 'long' }) === new Date().toLocaleDateString('en-US', { weekday: 'long' }) && Date.now() - p.addedAt < 86400_000 ? 'Today' : new Date(p.addedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</b>
          <span>{new Date(p.addedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
        </div>
        <TextButton onPress={() => os.toast('Edit', 'slider.horizontal.3')}>Edit</TextButton>
      </div>
      <div className="t7ph-vbottom">
        <button aria-label="Share" onClick={() => void share()}>
          <Glyph name="square.and.arrow.up" size={22} />
        </button>
        <button aria-label="Favorite" onClick={() => useLibrary.getState().togglePhotoFavorite(p.id)}>
          <Glyph name={p.favorite ? 'heart.fill' : 'heart'} size={22} />
        </button>
        <button aria-label="Info" onClick={() => os.toast(`${p.name} · ${p.width}×${p.height}`, 'info.circle')}>
          <Glyph name="info.circle" size={22} />
        </button>
        <button aria-label="Delete" onClick={del}>
          <Glyph name="trash" size={21} />
        </button>
      </div>
    </div>,
    app.host,
  );
}

function Slide({ p, pos, zoomed }: { p: Photo; pos: number; zoomed?: boolean }) {
  const url = useBlobUrl(p.blobKey);
  const [origin, setOrigin] = useState('50% 50%');
  return (
    <div
      className="t7ph-slide"
      style={{ transform: `translateX(${pos * 330}px)` }}
      onDoubleClick={(e) => {
        const r = localPoint(e.currentTarget, e.clientX, e.clientY);
        setOrigin(`${r.x}px ${r.y}px`);
      }}
    >
      {url && <img src={url} alt="" draggable={false} style={{ transform: zoomed ? 'scale(2.2)' : undefined, transformOrigin: origin }} />}
    </div>
  );
}
