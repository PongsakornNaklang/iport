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

export const R = {
  music: (): ScreenSpec => ({ title: 'Music', el: <MusicMenu /> }),
  coverFlow: (): ScreenSpec => ({ title: 'Cover Flow', el: <CoverFlow />, header: 'dark', kind: 'coverflow', landscape: true }),
  geniusMixes: (): ScreenSpec => ({ title: 'Genius Mixes', el: <GeniusMixesScreen /> }),
  genius: (seedId: string): ScreenSpec => ({ title: 'Genius', el: <GeniusScreen seedId={seedId} /> }),
  playlists: (): ScreenSpec => ({ title: 'Playlists', el: <PlaylistsScreen /> }),
  playlist: (id: string, name: string): ScreenSpec => ({ title: name, el: <PlaylistScreen id={id} /> }),
  artists: (): ScreenSpec => ({ title: 'Artists', el: <ArtistsScreen /> }),
  artist: (name: string): ScreenSpec => ({ title: name, el: <ArtistScreen name={name} /> }),
  artistSongs: (name: string): ScreenSpec => ({ title: name, el: <ArtistSongs name={name} /> }),
  albums: (): ScreenSpec => ({ title: 'Albums', el: <AlbumsScreen /> }),
  album: (key: string, title: string): ScreenSpec => ({ title, el: <AlbumScreen albumKey={key} /> }),
  compilations: (): ScreenSpec => ({ title: 'Compilations', el: <CompilationsScreen /> }),
  songs: (): ScreenSpec => ({ title: 'Songs', el: <SongsScreen /> }),
  genres: (): ScreenSpec => ({ title: 'Genres', el: <GenresScreen /> }),
  genre: (name: string): ScreenSpec => ({ title: name, el: <GenreScreen name={name} /> }),
  composers: (): ScreenSpec => ({ title: 'Composers', el: <ComposersScreen /> }),
  composer: (name: string): ScreenSpec => ({ title: name, el: <ComposerScreen name={name} /> }),
  audiobooks: (): ScreenSpec => ({ title: 'Audiobooks', el: <AudiobooksScreen /> }),
  search: (): ScreenSpec => ({ title: 'Search', el: <SearchScreen /> }),
  nowPlaying: (): ScreenSpec => ({ title: 'Now Playing', el: <NowPlaying />, kind: 'nowplaying' }),
  videos: (): ScreenSpec => ({ title: 'Videos', el: <VideosMenu /> }),
  photos: (): ScreenSpec => ({ title: 'Photos', el: <PhotosMenu /> }),
  podcasts: (): ScreenSpec => ({ title: 'Podcasts', el: <PodcastsScreen /> }),
  extras: (): ScreenSpec => ({ title: 'Extras', el: <ExtrasMenu /> }),
  settings: (): ScreenSpec => ({ title: 'Settings', el: <SettingsMenu /> }),
};
