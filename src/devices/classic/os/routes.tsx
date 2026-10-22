/**
 * Every screen the OS can push, as spec factories (title + element).
 * Screens call `nav.push(R.album(key, title))` etc.
 */
import type { ScreenSpec } from './core';
import {
  AlbumScreen,
  AlbumsScreen,
  ArtistScreen,
  ArtistsScreen,
  ArtistSongs,
  AudiobooksScreen,
  CompilationsScreen,
  ComposerScreen,
  ComposersScreen,
  GenreScreen,
  GenresScreen,
  GeniusMixesScreen,
  GeniusScreen,
  MusicMenu,
  PlaylistScreen,
  PlaylistsScreen,
  SongsScreen,
} from './screens/Music';
import { CoverFlow } from './screens/CoverFlow';
import { NowPlaying } from './screens/NowPlaying';
import { SearchScreen } from './screens/Search';
import { VideosMenu } from './screens/Videos';
import { PhotosMenu } from './screens/Photos';
import { PodcastsScreen } from './screens/Podcasts';
import { ExtrasMenu } from './screens/Extras';
import { SettingsMenu } from './screens/Settings';
import { t } from './i18n';

export const R = {
  music: (): ScreenSpec => ({ title: t('Music'), el: <MusicMenu /> }),
  coverFlow: (): ScreenSpec => ({ title: 'Cover Flow', el: <CoverFlow />, header: 'dark', kind: 'coverflow', landscape: true }),
  geniusMixes: (): ScreenSpec => ({ title: t('Genius Mixes'), el: <GeniusMixesScreen /> }),
  genius: (seedId: string): ScreenSpec => ({ title: 'Genius', el: <GeniusScreen seedId={seedId} /> }),
  playlists: (): ScreenSpec => ({ title: t('Playlists'), el: <PlaylistsScreen /> }),
  playlist: (id: string, name: string): ScreenSpec => ({ title: name, el: <PlaylistScreen id={id} /> }),
  artists: (): ScreenSpec => ({ title: t('Artists'), el: <ArtistsScreen /> }),
  artist: (name: string): ScreenSpec => ({ title: name, el: <ArtistScreen name={name} /> }),
  artistSongs: (name: string): ScreenSpec => ({ title: name, el: <ArtistSongs name={name} /> }),
  albums: (): ScreenSpec => ({ title: t('Albums'), el: <AlbumsScreen /> }),
  album: (key: string, title: string): ScreenSpec => ({ title, el: <AlbumScreen albumKey={key} /> }),
  compilations: (): ScreenSpec => ({ title: t('Compilations'), el: <CompilationsScreen /> }),
  songs: (): ScreenSpec => ({ title: t('Songs'), el: <SongsScreen /> }),
  genres: (): ScreenSpec => ({ title: t('Genres'), el: <GenresScreen /> }),
  genre: (name: string): ScreenSpec => ({ title: name, el: <GenreScreen name={name} /> }),
  composers: (): ScreenSpec => ({ title: t('Composers'), el: <ComposersScreen /> }),
  composer: (name: string): ScreenSpec => ({ title: name, el: <ComposerScreen name={name} /> }),
  audiobooks: (): ScreenSpec => ({ title: t('Audiobooks'), el: <AudiobooksScreen /> }),
  search: (): ScreenSpec => ({ title: t('Search'), el: <SearchScreen /> }),
  nowPlaying: (): ScreenSpec => ({ title: t('Now Playing'), el: <NowPlaying />, kind: 'nowplaying' }),
  videos: (): ScreenSpec => ({ title: t('Videos'), el: <VideosMenu /> }),
  photos: (): ScreenSpec => ({ title: t('Photos'), el: <PhotosMenu /> }),
  podcasts: (): ScreenSpec => ({ title: t('Podcasts'), el: <PodcastsScreen /> }),
  extras: (): ScreenSpec => ({ title: t('Extras'), el: <ExtrasMenu /> }),
  settings: (): ScreenSpec => ({ title: t('Settings'), el: <SettingsMenu /> }),
};
