/**
 * The Library panel — iPort's "iTunes": everything that ends up on the iPods
 * (music from your computer and free online sources, photos, notes,
 * contacts, calendars, alarms) is added and managed here.
 */
import { useEffect, useState } from 'react';
import { useLibrary } from '@/core/library/store';
import { Panel } from '../Panel';
import { IconMusic, IconPlus } from '../icons';
import { AddMusicTab } from './AddMusicTab';
import { IconNote, IconPhoto } from './icons';
import { InfoTab } from './InfoTab';
import { LibraryTab } from './LibraryTab';
import { PhotosTab } from './PhotosTab';
import { disposePreview, useSticky } from './state';
import './library.css';

type Tab = 'library' | 'add' | 'photos' | 'info';

export default function LibraryPanel({ onClose }: { onClose: () => void }) {
  const trackCount = useLibrary((s) => Object.keys(s.tracks).length);
  const photoCount = useLibrary((s) => s.photos.length);
  // first visit lands on "Add Music"; afterwards the last tab is remembered
  const [tab, setTab] = useSticky<Tab>('tab', 'add', true);
  const [bodyKey, setBodyKey] = useState(0);

  // stop any search-result preview when the panel closes
  useEffect(() => () => disposePreview(), []);

  const go = (t: Tab) => {
    setTab(t);
    setBodyKey((k) => k + 1);
    document.querySelector('.panel.left .panel-body')?.scrollTo({ top: 0 });
  };

  const tabs = (
    <div className="panel-tabs lib-tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'on' : ''} onClick={() => go('library')}>
        <IconMusic /> Library {trackCount > 0 && <span className="lib-tab-n">{trackCount}</span>}
      </button>
      <button role="tab" aria-selected={tab === 'add'} className={tab === 'add' ? 'on' : ''} onClick={() => go('add')}>
        <IconPlus /> Add Music
      </button>
      <button role="tab" aria-selected={tab === 'photos'} className={tab === 'photos' ? 'on' : ''} onClick={() => go('photos')}>
        <IconPhoto /> Photos {photoCount > 0 && <span className="lib-tab-n">{photoCount}</span>}
      </button>
      <button role="tab" aria-selected={tab === 'info'} className={tab === 'info' ? 'on' : ''} onClick={() => go('info')}>
        <IconNote /> Info
      </button>
    </div>
  );

  return (
    <Panel title="Library & Sync" side="left" onClose={onClose} tabs={tabs}>
      <div className="lib-root" key={`${tab}-${bodyKey}`}>
        {tab === 'library' && <LibraryTab onAddMusic={() => go('add')} />}
        {tab === 'add' && <AddMusicTab />}
        {tab === 'photos' && <PhotosTab />}
        {tab === 'info' && <InfoTab />}
      </div>
    </Panel>
  );
}
