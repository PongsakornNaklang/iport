import { describe, expect, it } from 'vitest';
import { namesFromUrl, oembedTitle, parseSoundCloudUrl, scArtwork, scTrack } from './soundcloud';
import { buildArchiveQuery, parseArchiveUrl, pickPlayableFiles, toArchiveItem, archiveTrack } from './archive';
import { playableStations, stationTrack, type Station } from './radio';
import { classifyLink, directTrack } from './links';
import { itunesArtwork, previewTrack } from './itunes';
import { makeTrack } from './track';

describe('SoundCloud links', () => {
  it.each([
    ['https://soundcloud.com/odesza/say-my-name', 'track', 'https://soundcloud.com/odesza/say-my-name'],
    ['soundcloud.com/odesza/say-my-name?in=odesza/sets/x&utm_source=clipboard', 'track', 'https://soundcloud.com/odesza/say-my-name'],
    ['https://m.soundcloud.com/odesza/say-my-name', 'track', 'https://soundcloud.com/odesza/say-my-name'],
    ['https://soundcloud.com/odesza/secret-song/s-AbC123', 'track', 'https://soundcloud.com/odesza/secret-song/s-AbC123'],
    ['https://soundcloud.com/odesza/sets/a-moment-apart', 'set', 'https://soundcloud.com/odesza/sets/a-moment-apart'],
    ['https://soundcloud.com/odesza', 'user', 'https://soundcloud.com/odesza'],
    ['https://soundcloud.com/odesza/tracks', 'user', 'https://soundcloud.com/odesza/tracks'],
    ['https://soundcloud.com/discover', 'other', 'https://soundcloud.com/discover'],
    ['https://on.soundcloud.com/AbCdEf', 'short', 'https://on.soundcloud.com/AbCdEf'],
    ['https://api.soundcloud.com/tracks/123456', 'track', 'https://api.soundcloud.com/tracks/123456'],
  ])('%s', (input, kind, url) => {
    expect(parseSoundCloudUrl(input)).toEqual({ kind, url });
  });
  it('rejects other hosts', () => expect(parseSoundCloudUrl('https://example.com/a/b')).toBeNull());

  it('cleans oEmbed titles and artwork', () => {
    expect(oembedTitle({ title: 'Say My Name by ODESZA', author_name: 'ODESZA' })).toBe('Say My Name');
    expect(oembedTitle({ title: 'Plain', author_name: 'X' })).toBe('Plain');
    expect(scArtwork('https://i1.sndcdn.com/artworks-000-abc-large.jpg')).toBe('https://i1.sndcdn.com/artworks-000-abc-t500x500.jpg');
    expect(namesFromUrl('https://soundcloud.com/odesza/say-my-name')).toEqual({ artist: 'Odesza', title: 'Say My Name' });
  });

  it('builds tracks with URL fallbacks', () => {
    expect(scTrack({ url: 'https://soundcloud.com/odesza/say-my-name' })).toMatchObject({ source: 'soundcloud', title: 'Say My Name', artist: 'Odesza', album: 'Say My Name - Single' });
    expect(scTrack({ url: 'https://api.soundcloud.com/tracks/2' })).toMatchObject({ title: 'SoundCloud Track', artist: 'SoundCloud' });
  });
});

describe('Internet Archive', () => {
  const files = [
    { name: 'gd77-05-08d1t01.flac', source: 'original', format: 'Flac', title: 'Minglewood Blues', track: '1', length: '5:31' },
    { name: 'gd77-05-08d1t01.mp3', source: 'derivative', format: 'VBR MP3', title: 'Minglewood Blues', track: '1', length: '331.2' },
    { name: 'gd77-05-08d1t01.ogg', source: 'derivative', format: 'Ogg Vorbis', title: 'Minglewood Blues', track: '1' },
    { name: 'gd77-05-08d1t02.mp3', source: 'derivative', format: 'VBR MP3', title: 'Loser', track: '2/20', length: '7:41' },
    { name: 'gd77-05-08d1t10.mp3', source: 'derivative', format: 'VBR MP3', title: 'Ten', track: '10' },
    { name: 'gd77-05-08.txt', format: 'Text' },
    { name: '__ia_thumb.jpg', format: 'Item Tile' },
    { name: 'gd77-05-08d1t01_spectrogram.png', format: 'PNG' },
  ];

  it('picks one streamable file per recording, in track order', () => {
    const picked = pickPlayableFiles('gd1977', files, 'audio');
    expect(picked.map((f) => [f.name, f.trackNo, f.duration])).toEqual([
      ['gd77-05-08d1t01.mp3', 1, 331.2],
      ['gd77-05-08d1t02.mp3', 2, 461],
      ['gd77-05-08d1t10.mp3', 10, undefined],
    ]);
    expect(picked[0].url).toBe('https://archive.org/download/gd1977/gd77-05-08d1t01.mp3');
  });

  it('prefers h.264 for films', () => {
    const picked = pickPlayableFiles(
      'night_of_the_living_dead',
      [
        { name: 'film.mpeg', format: 'MPEG2' },
        { name: 'film_512kb.mp4', format: '512Kb MPEG4' },
        { name: 'film.ia.mp4', format: 'h.264 IA' },
        { name: 'film.ogv', format: 'Ogg Video' },
        { name: 'sub dir/clip 1.mp4', format: 'h.264' },
      ],
      'movies',
    );
    expect(picked.map((f) => f.name)).toEqual(['film.ia.mp4', 'sub dir/clip 1.mp4']);
    expect(picked[1].url).toBe('https://archive.org/download/night_of_the_living_dead/sub%20dir/clip%201.mp4');
    expect(picked.every((f) => f.video)).toBe(true);
  });

  it('builds items, tracks and queries', () => {
    const item = toArchiveItem('lv', { metadata: { title: 'Book', creator: ['Author'], date: '1910', mediatype: 'audio', collection: ['librivoxaudio'] }, files });
    expect(item.year).toBe(1910);
    expect(archiveTrack(item, item.files[0])).toMatchObject({ source: 'archive', mediaType: 'audiobook', artist: 'Author', album: 'Book', artwork: 'https://archive.org/services/img/lv' });
    expect(() => toArchiveItem('x', {})).toThrow();
    expect(buildArchiveQuery('grateful dead', 'audio')).toBe(
      '(title:(grateful dead) OR creator:(grateful dead) OR subject:(grateful dead) OR description:(grateful dead)) AND mediatype:(audio) AND -access-restricted-item:(true)',
    );
    expect(parseArchiveUrl('https://archive.org/details/gd1977?q=x')).toBe('gd1977');
    expect(parseArchiveUrl('https://example.com/details/x')).toBeNull();
  });
});

describe('radio', () => {
  const st = (o: Partial<Station>): Station => ({ stationuuid: 'u', name: 'S', url_resolved: 'https://x/stream', ...o });
  it('keeps only https, non-HLS, deduped stations', () => {
    const list = playableStations([
      st({ name: 'A' }),
      st({ name: 'A ' }),
      st({ name: 'B', url_resolved: 'http://insecure/stream' }),
      st({ name: 'C', url_resolved: 'https://x/live.m3u8' }),
      st({ name: 'D', hls: 1, url_resolved: 'https://y' }),
      st({ name: 'E', url_resolved: '', url: 'https://fallback/stream' }),
    ]);
    expect(list.map((s) => s.name)).toEqual(['A', 'E']);
  });
  it('makes radio tracks', () => {
    expect(stationTrack(st({ name: 'Cool FM', country: 'Thailand', tags: 'pop,thai', favicon: 'http://insecure/icon.png' }))).toMatchObject({
      source: 'radio',
      mediaType: 'radio',
      title: 'Cool FM',
      artist: 'Thailand · Pop',
      genre: 'Pop',
      album: 'Internet Radio',
    });
  });
});

describe('links', () => {
  it.each([
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube'],
    ['https://soundcloud.com/a/b', 'soundcloud'],
    ['https://archive.org/details/gd1977', 'archive'],
    ['https://archive.org/download/gd1977/x.mp3', 'media'],
    ['https://podcasts.apple.com/us/podcast/x/id123', 'apple-podcast'],
    ['https://feeds.megaphone.fm/abc', 'feed'],
    ['https://example.com/podcast.rss', 'feed'],
    ['https://anchor.fm/s/1234/podcast/rss', 'feed'],
    ['https://example.com/song.mp3?dl=1', 'media'],
    ['example.com/movie.mp4', 'media'],
    ['https://example.com/stream', 'unknown'],
  ])('%s → %s', (url, kind) => expect(classifyLink(url)?.kind).toBe(kind));
  it('rejects junk', () => expect(classifyLink('not a link at all')).toBeNull());

  it('direct tracks', () => {
    expect(directTrack('https://example.com/music/01%20My_Song.mp3')).toMatchObject({ source: 'url', mediaType: 'music', title: '01 My Song', artist: 'example.com' });
    expect(directTrack('https://example.com/a.mp4')).toMatchObject({ mediaType: 'movie', hasVideo: true });
    expect(directTrack('https://example.com/live', { mediaType: 'radio', title: 'My Radio' })).toMatchObject({ source: 'radio', album: 'Internet Radio' });
  });
});

describe('iTunes', () => {
  it('upscales artwork', () => {
    expect(itunesArtwork('https://is1-ssl.mzstatic.com/image/thumb/Music/v4/ab/cd/source/100x100bb.jpg')).toBe('https://is1-ssl.mzstatic.com/image/thumb/Music/v4/ab/cd/source/600x600bb.jpg');
  });
  it('makes preview tracks', () => {
    expect(previewTrack({ kind: 'song', trackName: 'Song', artistName: 'Art', collectionName: 'Alb', previewUrl: 'https://audio/p.m4a', releaseDate: '2019-05-02T07:00:00Z' })).toMatchObject({
      source: 'preview',
      mediaType: 'music',
      year: 2019,
      duration: 30,
    });
    expect(previewTrack({ kind: 'music-video', previewUrl: 'https://v/p.m4v' })).toMatchObject({ mediaType: 'musicvideo', hasVideo: true });
    expect(previewTrack({ kind: 'song' })).toBeNull();
  });
});

describe('makeTrack', () => {
  it('fills bookkeeping and drops empty fields', () => {
    const t = makeTrack({ source: 'url', ref: 'x', mediaType: 'music', title: '  ', artist: '', album: '', genre: '', year: NaN });
    expect(t.title).toBe('Untitled');
    expect(t.artist).toBe('Unknown Artist');
    expect(t.album).toBe('');
    expect('genre' in t).toBe(false);
    expect('year' in t).toBe(false);
    expect(t.playCount).toBe(0);
  });
});
