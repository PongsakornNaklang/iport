import { describe, expect, it } from 'vitest';
import type { Playlist, Track } from '../types';
import { albums, albumsOfArtist, artists, genres, geniusPlaylist, playlistTracks, searchLibrary, songs, tracksOfArtist } from './selectors';

let n = 0;
function t(p: Partial<Track>): Track {
  n++;
  return {
    id: `t${n}`,
    source: 'local',
    ref: `media:${n}`,
    mediaType: 'music',
    title: `Song ${n}`,
    artist: 'Artist',
    album: 'Album',
    addedAt: n,
    playCount: 0,
    skipCount: 0,
    ...p,
  };
}

function lib(list: Track[]): Record<string, Track> {
  return Object.fromEntries(list.map((x) => [x.id, x]));
}

describe('library selectors', () => {
  const list = [
    t({ title: 'The Way', artist: 'Beta', album: 'Zeta', trackNo: 2, year: 1995, genre: 'Rock' }),
    t({ title: 'Alpha', artist: 'Beta', album: 'Zeta', trackNo: 1, year: 1995, genre: 'Rock', playCount: 5 }),
    t({ title: '99 Problems', artist: 'Gamma', album: 'Black', genre: 'Hip Hop', playCount: 9, rating: 5 }),
    t({ title: 'Comp Song', artist: 'Delta', album: 'Hits', compilation: true, genre: 'Pop' }),
    t({ title: 'Episode 1', mediaType: 'podcast', show: 'Talk' }),
  ];
  const tracks = lib(list);

  it('sorts songs like the iPod (ignores "The", letters before digits)', () => {
    expect(songs(tracks).map((s) => s.title)).toEqual(['Alpha', 'Comp Song', 'The Way', '99 Problems']);
  });

  it('groups albums and orders tracks by number', () => {
    const z = albums(tracks).find((a) => a.title === 'Zeta')!;
    expect(z.trackIds.map((id) => tracks[id].title)).toEqual(['Alpha', 'The Way']);
    expect(z.year).toBe(1995);
  });

  it('keeps compilations out of artists', () => {
    expect(artists(tracks).map((a) => a.name)).toEqual(['Beta', 'Gamma']);
    expect(albums(tracks).find((a) => a.title === 'Hits')?.artist).toBe('Various Artists');
  });

  it('lists albums and songs of an artist', () => {
    expect(albumsOfArtist(tracks, 'beta').map((a) => a.title)).toEqual(['Zeta']);
    expect(tracksOfArtist(tracks, 'Beta').map((id) => tracks[id].title)).toEqual(['Alpha', 'The Way']);
  });

  it('builds genres', () => {
    expect(genres(tracks).map((g) => g.name)).toEqual(['Hip Hop', 'Pop', 'Rock']);
  });

  it('computes smart playlists', () => {
    const p = (smart: Playlist['smart']): Playlist => ({ id: 'x', name: 'x', trackIds: [], createdAt: 0, smart });
    expect(playlistTracks(tracks, p('top-25')).map((id) => tracks[id].title)).toEqual(['99 Problems', 'Alpha']);
    expect(playlistTracks(tracks, p('nineties')).length).toBe(2);
    expect(playlistTracks(tracks, p('top-rated')).map((id) => tracks[id].title)).toEqual(['99 Problems']);
  });

  it('drops deleted tracks from normal playlists', () => {
    const pl: Playlist = { id: 'p', name: 'p', trackIds: ['t1', 'missing', 't2'], createdAt: 0 };
    expect(playlistTracks(tracks, pl)).toEqual(['t1', 't2']);
  });

  it('searches titles, artists and albums', () => {
    expect(searchLibrary(tracks, 'zeta').length).toBe(2);
    expect(searchLibrary(tracks, 'beta way').map((x) => x.title)).toEqual(['The Way']);
    expect(searchLibrary(tracks, '   ')).toEqual([]);
  });

  it('starts Genius with the seed and never repeats it', () => {
    const g = geniusPlaylist(tracks, 't1');
    expect(g[0]).toBe('t1');
    expect(new Set(g).size).toBe(g.length);
  });
});
