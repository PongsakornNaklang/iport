import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePlayer } from '../../../../core/player/player';
import { useLibrary } from '../../../../core/library/store';
import { albumsByKey } from '../../../../core/library/selectors';
import { prefs, usePrefs, useOS } from '../../os/store';
import { NavStack, Tabs, useApp, type NavApi } from '../../os/ui';
import { MusicCtx, type MusicApi } from './common';
import { AlbumPage, ArtistPage, LibraryRoot } from './library';
import { Browse, ListenNow, Radio, SearchTab } from './listen';
import { MiniPlayer, NowPlaying } from './NowPlaying';
import './music.css';

export default function Music() {
  const tab = usePrefs((s) => s.musicTab);
  const setTab = (v: string) => usePrefs.getState().set('musicTab', v);
  const [np, setNp] = useState(false);
  const hasTrack = usePlayer((s) => !!s.currentId);
  const navs = useRef<Record<string, NavApi>>({});
  const app = useApp();

  const pushTo = useCallback((tabId: string, node: ReactNode, title: string) => {
    setNp(false);
    if (prefs().musicTab !== tabId) usePrefs.getState().set('musicTab', tabId);
    window.setTimeout(() => navs.current[tabId]?.push(node, title), 60);
  }, []);

  const api: MusicApi = useMemo(
    () => ({
      openNowPlaying: () => setNp(true),
      goAlbum: (key: string) => {
        const a = albumsByKey(useLibrary.getState().tracks).get(key);
        pushTo('library', <AlbumPage albumKey={key} />, a?.title ?? 'Album');
      },
      goArtist: (name: string) => pushTo('library', <ArtistPage name={name} />, name),
      push: (node: ReactNode, title: string) => navs.current[prefs().musicTab]?.push(node, title),
    }),
    [pushTo],
  );

  // deep links (Control Center / Home Screen quick actions)
  const intent = useOS((s) => s.intent);
  useEffect(() => {
    if (!intent || intent.app !== 'music') return;
    if (intent.data === 'search') setTab('search');
    if (intent.data === 'nowplaying') setNp(true);
    useOS.setState({ intent: null });
  }, [intent]);

  const roots = useMemo(
    () => ({
      listen: <ListenNow />,
      browse: <Browse />,
      radio: <Radio />,
      library: <LibraryRoot />,
      search: <SearchTab />,
    }),
    [],
  );
  const stack = (id: keyof typeof roots, title: string) => (reset: number) => (
    <NavStack root={roots[id]} rootTitle={title} resetSerial={reset} onApi={(a) => (navs.current[id] = a)} />
  );

  return (
    <MusicCtx.Provider value={api}>
      <div className={`t7m-root ${np && app.host ? 'np-open' : ''}`}>
        <Tabs
          value={tab}
          onChange={setTab}
          accessory={hasTrack ? <MiniPlayer onOpen={() => setNp(true)} /> : undefined}
          tabs={[
            { id: 'listen', label: 'Listen Now', glyph: 'play.circle.fill', render: stack('listen', 'Listen Now') },
            { id: 'browse', label: 'Browse', glyph: 'square.grid.2x2.fill', render: stack('browse', 'Browse') },
            { id: 'radio', label: 'Radio', glyph: 'dot_radiowaves', render: stack('radio', 'Radio') },
            { id: 'library', label: 'Library', glyph: 'rectangle.stack.fill', render: stack('library', 'Library') },
            { id: 'search', label: 'Search', glyph: 'magnifyingglass', render: stack('search', 'Search') },
          ]}
        />
      </div>
      <NowPlaying open={np} onClose={() => setNp(false)} />
    </MusicCtx.Provider>
  );
}
