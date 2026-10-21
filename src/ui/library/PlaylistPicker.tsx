/** "Add to Playlist" sheet: pick an existing playlist or create a new one. */
import { useState } from 'react';
import { ON_THE_GO_ID, useLibrary } from '@/core/library/store';
import { usePlaylists } from '@/core/library/selectors';
import { IconPlus } from '../icons';
import { toast } from '../toast';
import { IconPlaylist } from './icons';
import { Sheet } from './ui';

export function PlaylistPicker({ trackIds, onClose, onDone }: { trackIds: string[]; onClose: () => void; onDone?: () => void }) {
  const playlists = usePlaylists().filter((p) => !p.smart);
  const [name, setName] = useState('');
  const n = trackIds.length;
  const what = n === 1 ? '1 item' : `${n} items`;

  const addTo = (id: string, label: string) => {
    useLibrary.getState().addToPlaylist(id, trackIds);
    toast(`Added ${what} to “${label}”`);
    onDone?.();
    onClose();
  };

  const create = () => {
    const nm = name.trim() || 'Untitled Playlist';
    useLibrary.getState().createPlaylist(nm, trackIds);
    toast(`Created “${nm}” with ${what}`);
    onDone?.();
    onClose();
  };

  return (
    <Sheet title={`Add ${what} to…`} onClose={onClose}>
      <div className="section-title">New playlist</div>
      <form
        className="lib-search"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <input className="input" value={name} autoFocus placeholder="Playlist name" onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" type="submit">
          <IconPlus /> Create
        </button>
      </form>
      <div className="section-title" style={{ marginTop: 18 }}>
        Your playlists
      </div>
      <div className="list">
        {playlists.map((p) => (
          <div key={p.id} className="list-item lib-row clickable" onClick={() => addTo(p.id, p.name)}>
            <div className={`lib-pl-icon ${p.id === ON_THE_GO_ID ? 'otg' : ''}`}>
              <IconPlaylist />
            </div>
            <div className="li-text">
              <div className="li-title">{p.name}</div>
              <div className="li-sub">
                {p.trackIds.length} item{p.trackIds.length === 1 ? '' : 's'}
              </div>
            </div>
            <span className="lib-chev">›</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
