/**
 * The Library panel — iPort's "iTunes": everything that ends up on the iPods
 * (music from your computer and free online sources, photos, notes,
 * contacts, calendars, alarms) is added and managed here.
 */
import { useEffect, useState } from 'react';
import { SegTabs } from '../SegTabs';
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
    <SegTabs
      className="lib-tabs"
      items={[
        { id: 'library', label: <><IconMusic /> Library {trackCount > 0 && <span className="lib-tab-n">{trackCount}</span>}</> },
        { id: 'add', label: <><IconPlus /> Add Music</> },
        { id: 'photos', label: <><IconPhoto /> Photos {photoCount > 0 && <span className="lib-tab-n">{photoCount}</span>}</> },
        { id: 'info', label: <><IconNote /> Info</> },
      ]}
      value={tab}
      onChange={go}
    />
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
