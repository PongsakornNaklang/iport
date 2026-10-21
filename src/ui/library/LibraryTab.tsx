/** Library tab: storage summary, every item (search / filter / sort / select), playlists, manage. */
import { memo, useMemo, useState } from 'react';
import { Artwork } from '@/core/library/Artwork';
import { ON_THE_GO_ID, useLibrary } from '@/core/library/store';
import { artistOf, playlistTracks, usePlaylists } from '@/core/library/selectors';
import { seedDemoLibrary } from '@/core/library/demo';
import { player, usePlayer } from '@/core/player/player';
import { compareTitles, formatTime } from '@/core/util/format';
import type { Playlist, SourceKind, Track } from '@/core/types';
import { IconCheck, IconClose, IconMusic, IconPlay, IconPlus, IconTrash } from '../icons';
import { toast } from '../toast';
import { IconDown, IconEdit, IconPlaylist, IconQueueNext, IconSelect, IconSpeaker, IconUp } from './icons';
import { PlaylistPicker } from './PlaylistPicker';
import { StorageCard } from './StorageCard';
import { MEDIA_LABEL, SOURCE_LABEL, stopPreview, useSticky } from './state';
import { TrackEditor } from './TrackEditor';
import { Chips, Confirm, Empty, MenuButton, RowBtn, SearchField, Segmented, useIncremental } from './ui';

type Filter = 'all' | 'music' | 'video' | 'podcast' | 'audiobook' | 'radio' | 'voicememo';
type Sort = 'title' | 'artist' | 'album' | 'added';

const FILTERS: { value: Filter; label: string; test: (t: Track) => boolean }[] = [
  { value: 'all', label: 'All', test: () => true },
  { value: 'music', label: 'Music', test: (t) => t.mediaType === 'music' },
  { value: 'video', label: 'Videos', test: (t) => t.mediaType === 'musicvideo' || t.mediaType === 'movie' || t.mediaType === 'tvshow' },
  { value: 'podcast', label: 'Podcasts', test: (t) => t.mediaType === 'podcast' },
  { value: 'audiobook', label: 'Audiobooks', test: (t) => t.mediaType === 'audiobook' },
  { value: 'radio', label: 'Radio', test: (t) => t.mediaType === 'radio' },
  { value: 'voicememo', label: 'Voice Memos', test: (t) => t.mediaType === 'voicememo' },
];

function byDiscTrack(a: Track, b: Track): number {
  return (a.discNo ?? 1) - (b.discNo ?? 1) || (a.trackNo ?? 9999) - (b.trackNo ?? 9999);
}

const SORTS: Record<Sort, (a: Track, b: Track) => number> = {
  title: (a, b) => compareTitles(a.title, b.title),
  artist: (a, b) => compareTitles(artistOf(a), artistOf(b)) || compareTitles(a.album, b.album) || byDiscTrack(a, b) || compareTitles(a.title, b.title),
  album: (a, b) => compareTitles(a.album || '￿', b.album || '￿') || byDiscTrack(a, b) || compareTitles(a.title, b.title),
  added: (a, b) => b.addedAt - a.addedAt,
};

function subtitle(t: Track): string {
  switch (t.mediaType) {
    case 'podcast':
      return [t.show || t.album, t.pubDate ? new Date(t.pubDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ');
    case 'radio':
      return t.artist;
    case 'movie':
    case 'tvshow':
    case 'musicvideo':
    case 'audiobook':
      return [MEDIA_LABEL[t.mediaType], t.artist !== 'Unknown Artist' ? t.artist : ''].filter(Boolean).join(' · ');
    default:
      return [t.artist, t.album].filter(Boolean).join(' · ');
  }
}

function totalTime(list: Track[]): string {
  const s = list.reduce((a, t) => a + (t.mediaType === 'radio' ? 0 : (t.duration ?? 0)), 0);
  if (s < 60) return '';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = s / 3600;
  return h < 48 ? `${h.toFixed(1)} hours` : `${(h / 24).toFixed(1)} days`;
}

export function LibraryTab({ onAddMusic }: { onAddMusic: () => void }) {
  const [view, setView] = useSticky<'items' | 'playlists'>('lib.view', 'items');
  return (
    <>
      <StorageCard />
      <div style={{ marginTop: 12 }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'items', label: 'Songs & Videos' },
            { value: 'playlists', label: 'Playlists' },
          ]}
        />
      </div>
      {view === 'items' ? <TrackList onAddMusic={onAddMusic} /> : <Playlists />}
      <Manage />
    </>
  );
}

// ------------------------------------------------------------------ track list

function TrackList({ onAddMusic }: { onAddMusic: () => void }) {
  const tracks = useLibrary((s) => s.tracks);
  const currentId = usePlayer((s) => s.currentId);
  const [q, setQ] = useSticky('lib.q', '');
  const [filter, setFilter] = useSticky<Filter>('lib.filter', 'all');
  const [sort, setSort] = useSticky<Sort>('lib.sort', 'title', true);
  const [source, setSource] = useSticky<SourceKind | 'any'>('lib.source', 'any');
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<Track | null>(null);
  const [picker, setPicker] = useState<string[] | null>(null);
  const [confirmDel, setConfirmDel] = useState<string[] | null>(null);

  const all = useMemo(() => Object.values(tracks), [tracks]);
  const counts = useMemo(() => {
    const c: Partial<Record<Filter, number>> = {};
    for (const f of FILTERS) c[f.value] = all.filter(f.test).length;
    return c;
  }, [all]);
  const sources = useMemo(() => [...new Set(all.map((t) => t.source))], [all]);

  const list = useMemo(() => {
    const test = FILTERS.find((f) => f.value === filter)?.test ?? (() => true);
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = all.filter((t) => {
      if (!test(t) || (source !== 'any' && t.source !== source)) return false;
      if (!words.length) return true;
      const hay = `${t.title} ${t.artist} ${t.album} ${t.albumArtist ?? ''} ${t.show ?? ''} ${t.genre ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    return out.sort(SORTS[sort]);
  }, [all, q, filter, source, sort]);
  const ids = useMemo(() => list.map((t) => t.id), [list]);
  const [shown, sentinel] = useIncremental(list.length, 120, `${q}|${filter}|${sort}|${source}`);

  const toggleSel = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const remove = (del: string[]) => {
    if (currentId && del.includes(currentId)) player.stop();
    useLibrary.getState().removeTracks(del);
    setSel(new Set());
    setSelecting(false);
    toast(del.length === 1 ? 'Deleted from your library' : `Deleted ${del.length} items`);
  };

  const filterOptions = FILTERS.filter((f) => f.value === 'all' || f.value === 'music' || (counts[f.value] ?? 0) > 0).map((f) => ({
    value: f.value,
    label: f.label,
    count: counts[f.value],
  }));

  if (!all.length)
    return (
      <Empty icon={<IconMusic />} title="Your library is empty">
        Add songs from your computer, YouTube, SoundCloud, free radio and more.
        <div style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={onAddMusic}>
            <IconPlus /> Add Music
          </button>
        </div>
      </Empty>
    );

  const selIds = ids.filter((id) => sel.has(id));

  return (
    <div className="section">
      <div className="lib-sticky">
        <SearchField value={q} onChange={setQ} placeholder="Search your library" live />
        <Chips value={filter} onChange={setFilter} options={filterOptions} />
        {selecting ? (
          <div className="lib-selbar">
            <button className="btn small" onClick={() => setSel(sel.size === ids.length ? new Set() : new Set(ids))}>
              {sel.size === ids.length && ids.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="grow">{sel.size} selected</span>
            <RowBtn title="Play selected" disabled={!selIds.length} onClick={() => player.playTracks(selIds, 0)}>
              <IconPlay width={14} height={14} />
            </RowBtn>
            <RowBtn title="Add selected to a playlist" disabled={!selIds.length} onClick={() => setPicker(selIds)}>
              <IconPlaylist width={17} height={17} />
            </RowBtn>
            <RowBtn title="Delete selected" disabled={!selIds.length} onClick={() => setConfirmDel(selIds)} className="danger">
              <IconTrash width={16} height={16} />
            </RowBtn>
            <button
              className="btn small primary"
              onClick={() => {
                setSelecting(false);
                setSel(new Set());
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="lib-toolbar">
            <select className="select compact" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
              <option value="title">Sort: Title</option>
              <option value="artist">Sort: Artist</option>
              <option value="album">Sort: Album</option>
              <option value="added">Sort: Recently Added</option>
            </select>
            {sources.length > 1 && (
              <select className="select compact" value={source} onChange={(e) => setSource(e.target.value as SourceKind | 'any')} aria-label="Source">
                <option value="any">All sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            )}
            <span className="grow" />
            <RowBtn title="Shuffle these" onClick={() => player.playTracks(ids, 0, { shuffle: true })} disabled={!ids.length}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5" />
              </svg>
            </RowBtn>
            <button className="btn small" onClick={() => setSelecting(true)} disabled={!ids.length}>
              <IconSelect width={15} height={15} /> Select
            </button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <Empty title="No matches">Try a different search or filter.</Empty>
      ) : (
        <div className="list" style={{ marginTop: 8 }}>
          {list.slice(0, shown).map((t, i) => (
            <TrackRow
              key={t.id}
              t={t}
              playing={t.id === currentId}
              selecting={selecting}
              selected={sel.has(t.id)}
              onClick={() => (selecting ? toggleSel(t.id) : player.playTracks(ids, i))}
              onPlayNext={() => {
                player.enqueueNext([t.id]);
                toast(`“${t.title}” will play next`);
              }}
              onPlayLater={() => {
                player.enqueue([t.id]);
                toast(`Added “${t.title}” to Up Next`);
              }}
              onAddToPlaylist={() => setPicker([t.id])}
              onEdit={() => setEditing(t)}
              onDelete={() => setConfirmDel([t.id])}
            />
          ))}
        </div>
      )}
      {shown < list.length && <div ref={sentinel} style={{ height: 1 }} />}
      {list.length > 0 && (
        <p className="tiny" style={{ textAlign: 'center', marginTop: 10 }}>
          {list.length} item{list.length === 1 ? '' : 's'}
          {totalTime(list) ? ` · ${totalTime(list)}` : ''}
        </p>
      )}

      {editing && <TrackEditor track={editing} onClose={() => setEditing(null)} />}
      {picker && (
        <PlaylistPicker
          trackIds={picker}
          onClose={() => setPicker(null)}
          onDone={() => {
            setSelecting(false);
            setSel(new Set());
          }}
        />
      )}
      {confirmDel && (
        <Confirm
          title={confirmDel.length === 1 ? 'Delete this item?' : `Delete ${confirmDel.length} items?`}
          message="They are removed from every iPod and from your playlists. Imported files are erased from this browser."
          confirm="Delete"
          danger
          onConfirm={() => remove(confirmDel)}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

const TrackRow = memo(function TrackRow({
  t,
  playing,
  selecting,
  selected,
  onClick,
  onPlayNext,
  onPlayLater,
  onAddToPlaylist,
  onEdit,
  onDelete,
}: {
  t: Track;
  playing: boolean;
  selecting: boolean;
  selected: boolean;
  onClick: () => void;
  onPlayNext: () => void;
  onPlayLater: () => void;
  onAddToPlaylist: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dur = t.mediaType === 'radio' ? 'Live' : t.duration ? formatTime(t.duration) : '';
  return (
    <div className={`list-item lib-row clickable ${playing ? 'playing' : ''} ${selected ? 'sel' : ''}`} onClick={onClick}>
      {selecting && <span className={`lib-check ${selected ? 'on' : ''}`}>{selected && <IconCheck />}</span>}
      <Artwork src={t.artwork} size={40} radius={6} />
      <div className="li-text">
        <div className="li-title">
          {playing && <IconSpeaker />}
          {t.title}
        </div>
        <div className="li-sub">{subtitle(t)}</div>
      </div>
      <div className="li-right">
        <span className={`badge src src-${t.source}`}>{SOURCE_LABEL[t.source]}</span>
        {dur && <span className="li-dur">{dur}</span>}
      </div>
      {!selecting && (
        <MenuButton
          items={[
            { label: 'Play Next', icon: <IconQueueNext />, onSelect: onPlayNext },
            { label: 'Play Later', icon: <IconPlay width={14} height={14} />, onSelect: onPlayLater },
            { label: 'Add to Playlist…', icon: <IconPlaylist />, onSelect: onAddToPlaylist },
            {
              label: 'Add to On-The-Go',
              icon: <IconPlus />,
              onSelect: () => {
                useLibrary.getState().addToOnTheGo([t.id]);
                toast('Added to On-The-Go');
              },
            },
            { label: 'Get Info…', icon: <IconEdit />, onSelect: onEdit },
            { label: 'Delete from Library', icon: <IconTrash />, onSelect: onDelete, danger: true },
          ]}
        />
      )}
    </div>
  );
});

// ------------------------------------------------------------------ playlists

function Playlists() {
  const playlists = usePlaylists();
  const tracks = useLibrary((s) => s.tracks);
  const [open, setOpen] = useSticky<string | null>('lib.plOpen', null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [rename, setRename] = useState('');
  const [newName, setNewName] = useState('');
  const [confirm, setConfirm] = useState<Playlist | null>(null);
  const user = playlists.filter((p) => !p.smart);
  const smart = playlists.filter((p) => p.smart);

  const create = () => {
    const id = useLibrary.getState().createPlaylist(newName.trim() || 'Untitled Playlist');
    setNewName('');
    setOpen(id);
    toast('Playlist created — add songs from Songs & Videos with ⋯ → Add to Playlist');
  };

  const playlistRow = (p: Playlist) => {
    const ids = playlistTracks(tracks, p);
    const isOpen = open === p.id && !p.smart;
    const otg = p.id === ON_THE_GO_ID;
    return (
      <div key={p.id}>
        <div className={`list-item lib-row clickable`} onClick={() => !p.smart && setOpen(isOpen ? null : p.id)}>
          <div className={`lib-pl-icon ${p.smart ? 'smart' : otg ? 'otg' : ''}`}>
            {p.smart ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
              </svg>
            ) : (
              <IconPlaylist />
            )}
          </div>
          <div className="li-text">
            {renaming === p.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (rename.trim()) useLibrary.getState().renamePlaylist(p.id, rename.trim());
                  setRenaming(null);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input className="input compact" style={{ width: '100%' }} autoFocus value={rename} onChange={(e) => setRename(e.target.value)} onBlur={() => setRenaming(null)} />
              </form>
            ) : (
              <div className="li-title">{p.name}</div>
            )}
            <div className="li-sub">
              {ids.length} item{ids.length === 1 ? '' : 's'}
              {totalTime(ids.map((id) => tracks[id])) ? ` · ${totalTime(ids.map((id) => tracks[id]))}` : ''}
              {p.smart ? ' · Smart' : ''}
            </div>
          </div>
          <RowBtn title="Play" disabled={!ids.length} onClick={() => player.playTracks(ids, 0)}>
            <IconPlay width={14} height={14} />
          </RowBtn>
          {!p.smart && (
            <MenuButton
              items={[
                !otg && {
                  label: 'Rename',
                  icon: <IconEdit />,
                  onSelect: () => {
                    setRename(p.name);
                    setRenaming(p.id);
                  },
                },
                { label: 'Shuffle', icon: <IconPlay width={14} height={14} />, onSelect: () => player.playTracks(ids, 0, { shuffle: true }), disabled: !ids.length },
                otg && {
                  label: 'Save as Playlist',
                  icon: <IconPlus />,
                  disabled: !ids.length,
                  onSelect: () => {
                    useLibrary.getState().saveOnTheGo();
                    toast('Saved On-The-Go as a new playlist');
                  },
                },
                otg
                  ? { label: 'Clear On-The-Go', icon: <IconClose width={14} height={14} />, onSelect: () => useLibrary.getState().clearOnTheGo(), danger: true, disabled: !ids.length }
                  : { label: 'Delete Playlist', icon: <IconTrash />, onSelect: () => setConfirm(p), danger: true },
              ]}
            />
          )}
          {!p.smart && <span className="lib-chev" style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}>›</span>}
        </div>
        {isOpen && (
          <div className="lib-pl-tracks">
            {ids.length === 0 && <div className="list-item muted" style={{ fontSize: 12.5 }}>Empty — use ⋯ → Add to Playlist on any song.</div>}
            {p.trackIds.map((id, i) => {
              const t = tracks[id];
              if (!t) return null;
              return (
                <div key={`${id}-${i}`} className="list-item lib-row clickable" onClick={() => player.playTracks(ids, ids.indexOf(id))}>
                  <span className="num">{i + 1}</span>
                  <Artwork src={t.artwork} size={30} radius={4} />
                  <div className="li-text">
                    <div className="li-title">{t.title}</div>
                    <div className="li-sub">{t.artist}</div>
                  </div>
                  <RowBtn title="Move up" disabled={i === 0} onClick={() => useLibrary.getState().movePlaylistItem(p.id, i, i - 1)}>
                    <IconUp width={15} height={15} />
                  </RowBtn>
                  <RowBtn title="Move down" disabled={i === p.trackIds.length - 1} onClick={() => useLibrary.getState().movePlaylistItem(p.id, i, i + 1)}>
                    <IconDown width={15} height={15} />
                  </RowBtn>
                  <RowBtn title="Remove from playlist" onClick={() => useLibrary.getState().removeFromPlaylist(p.id, i)}>
                    <IconClose width={12} height={12} />
                  </RowBtn>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="section">
      <form
        className="lib-search"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <input className="input" value={newName} placeholder="New playlist name" onChange={(e) => setNewName(e.target.value)} />
        <button className="btn primary" type="submit">
          <IconPlus /> New Playlist
        </button>
      </form>
      <div className="section-title" style={{ marginTop: 16 }}>
        Playlists
      </div>
      <div className="list">{user.map(playlistRow)}</div>
      <div className="section-title" style={{ marginTop: 16 }}>
        Smart Playlists
      </div>
      <div className="list">{smart.map(playlistRow)}</div>
      <p className="lib-hint">Smart playlists update themselves from your ratings, play counts and dates — just like iTunes.</p>
      {confirm && (
        <Confirm
          title={`Delete “${confirm.name}”?`}
          message="The songs stay in your library."
          confirm="Delete"
          danger
          onConfirm={() => useLibrary.getState().deletePlaylist(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ manage

function Manage() {
  const tracks = useLibrary((s) => s.tracks);
  const [confirm, setConfirm] = useState(false);
  const hasDemo = useMemo(() => Object.values(tracks).some((t) => t.artist === 'iPort Demo Band'), [tracks]);

  const restore = async () => {
    const before = Object.keys(useLibrary.getState().tracks).length;
    const p = seedDemoLibrary();
    // seedDemoLibrary adds its YouTube picks synchronously; if nothing changed it already ran this session
    if (Object.keys(useLibrary.getState().tracks).length === before) {
      useLibrary.getState().setSeeded(false);
      toast('The demo songs will be added the next time you open iPort');
      return;
    }
    toast('Restoring demo songs…');
    await p;
    toast('Demo songs restored');
  };

  const erase = async () => {
    player.stop();
    stopPreview();
    await useLibrary.getState().resetLibrary();
    toast('All content erased');
  };

  return (
    <div className="section lib-manage">
      <div className="section-title">Manage</div>
      <div className="list">
        <button className="list-item" disabled={hasDemo} onClick={() => void restore()} title={hasDemo ? 'The demo songs are already in your library' : undefined}>
          <IconMusic /> Restore Demo Songs
        </button>
        <button className="list-item danger" onClick={() => setConfirm(true)}>
          <IconTrash /> Erase All Content…
        </button>
      </div>
      <p className="lib-hint">
        Your library lives only in this browser (IndexedDB). Imported files never leave your computer; streamed items are saved as links.
      </p>
      {confirm && (
        <Confirm
          title="Erase all content?"
          message="Every song, video, podcast, station, playlist, photo, note, contact, event and alarm will be removed from this browser. This can’t be undone."
          confirm="Erase"
          danger
          onConfirm={() => void erase()}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
