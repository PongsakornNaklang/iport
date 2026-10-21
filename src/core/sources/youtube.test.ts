import { describe, expect, it } from 'vitest';
import { cleanChannelName, cleanVideoTitle, isAlbumList, isExpandableList, parseYouTubeUrl, splitArtistTitle, youtubeTrack } from './youtube';

describe('parseYouTubeUrl', () => {
  const id = 'dQw4w9WgXcQ';
  it.each([
    [`https://www.youtube.com/watch?v=${id}`, { videoId: id }],
    [`https://youtube.com/watch?v=${id}&t=42s`, { videoId: id }],
    [`youtube.com/watch?v=${id}`, { videoId: id }],
    [`https://m.youtube.com/watch?v=${id}&feature=share`, { videoId: id }],
    [`https://youtu.be/${id}?si=abcDEF123`, { videoId: id }],
    [`https://www.youtube.com/shorts/${id}`, { videoId: id }],
    [`https://www.youtube.com/embed/${id}?autoplay=1`, { videoId: id }],
    [`https://www.youtube-nocookie.com/embed/${id}`, { videoId: id }],
    [`https://www.youtube.com/live/${id}?feature=shared`, { videoId: id }],
    [`https://music.youtube.com/watch?v=${id}&list=RDAMVM${id}`, { videoId: id, listId: `RDAMVM${id}` }],
    [`https://www.youtube.com/watch?app=desktop&v=${id}`, { videoId: id }],
    [`https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI`, { listId: 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' }],
    [`https://music.youtube.com/playlist?list=OLAK5uy_kVJbqMclyB2qzq3G2BSh2PTCnCazQQVlE`, { listId: 'OLAK5uy_kVJbqMclyB2qzq3G2BSh2PTCnCazQQVlE' }],
    [`https://www.youtube.com/watch?v=${id}&list=PL123456789abc`, { videoId: id, listId: 'PL123456789abc' }],
    [id, { videoId: id }],
  ])('%s', (url, expected) => {
    expect(parseYouTubeUrl(url)).toEqual(expected);
  });

  it('rejects other sites, channels and words', () => {
    expect(parseYouTubeUrl('https://vimeo.com/12345')).toBeNull();
    expect(parseYouTubeUrl('https://www.youtube.com/@LinkinPark')).toBeNull();
    expect(parseYouTubeUrl('programming')).toBeNull();
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseYouTubeUrl('')).toBeNull();
  });

  it('classifies lists', () => {
    expect(isExpandableList('RDAMVMdQw4w9WgXcQ')).toBe(false);
    expect(isExpandableList('PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI')).toBe(true);
    expect(isAlbumList('OLAK5uy_abc')).toBe(true);
  });
});

describe('titles', () => {
  it('cleans noise but keeps meaningful brackets', () => {
    expect(cleanVideoTitle('Queen – Bohemian Rhapsody (Official Video Remastered)')).toBe('Queen – Bohemian Rhapsody');
    expect(cleanVideoTitle('Rick Astley - Never Gonna Give You Up (Official Music Video)')).toBe('Rick Astley - Never Gonna Give You Up');
    expect(cleanVideoTitle('Song Name (feat. Someone) [Official Lyric Video]')).toBe('Song Name (feat. Someone)');
    expect(cleanVideoTitle('Song (Remix) | Official MV | Label')).toBe('Song (Remix)');
    expect(cleanVideoTitle('Song (Live at Wembley)')).toBe('Song (Live at Wembley)');
    expect(cleanVideoTitle('ARTIST - Song【Official MV】')).toBe('ARTIST - Song');
  });

  it('cleans channel names', () => {
    expect(cleanChannelName('RickAstleyVEVO')).toBe('Rick Astley');
    expect(cleanChannelName('Queen - Topic')).toBe('Queen');
    expect(cleanChannelName('LinkinParkOfficial')).toBe('Linkin Park');
    expect(cleanChannelName('Lofi Girl')).toBe('Lofi Girl');
    expect(cleanChannelName('BLACKPINK')).toBe('BLACKPINK');
    expect(cleanChannelName('Taylor Swift Official Channel')).toBe('Taylor Swift');
  });

  it('splits artist and title', () => {
    expect(splitArtistTitle('Queen – Bohemian Rhapsody (Official Video Remastered)', 'Queen Official')).toEqual({ artist: 'Queen', title: 'Bohemian Rhapsody' });
    expect(splitArtistTitle('Numb [Official Music Video] - Linkin Park', 'Linkin Park')).toEqual({ artist: 'Linkin Park', title: 'Numb' });
    expect(splitArtistTitle('Never Gonna Give You Up', 'Rick Astley - Topic')).toEqual({ artist: 'Rick Astley', title: 'Never Gonna Give You Up' });
    expect(splitArtistTitle('lofi hip hop radio 📚 beats to relax/study to', 'Lofi Girl')).toEqual({
      artist: 'Lofi Girl',
      title: 'lofi hip hop radio 📚 beats to relax/study to',
    });
    expect(splitArtistTitle('Jay-Z Empire State Of Mind', 'JayZVEVO').title).toBe('Jay-Z Empire State Of Mind');
    expect(splitArtistTitle('YOASOBI「アイドル」 Official Music Video', 'Ayase / YOASOBI')).toEqual({ artist: 'YOASOBI', title: 'アイドル' });
    expect(splitArtistTitle('Polycat - มะลิ (Official MV)', 'Smallroom')).toEqual({ artist: 'Polycat', title: 'มะลิ' });
  });

  it('builds a track', () => {
    const t = youtubeTrack({ id: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)', channel: 'Rick Astley', seconds: 213 });
    expect(t).toMatchObject({
      source: 'youtube',
      ref: 'dQw4w9WgXcQ',
      mediaType: 'music',
      hasVideo: true,
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      album: 'Never Gonna Give You Up - Single',
      duration: 213,
      artwork: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      playCount: 0,
    });
    expect(youtubeTrack({ id: 'dQw4w9WgXcQ', title: 'x' }, { musicVideo: true }).mediaType).toBe('musicvideo');
  });
});
