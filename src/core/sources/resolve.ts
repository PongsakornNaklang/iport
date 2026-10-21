import { blobUrl } from '../db';
import type { Track } from '../types';
import { audiusStreamUrl } from './audius';

/** Turn a track into a URL an HTML media element can play. */
export async function resolveStreamUrl(track: Track): Promise<string> {
  switch (track.source) {
    case 'local': {
      const u = await blobUrl(track.ref);
      if (!u) throw new Error('This file is no longer in the library');
      return u;
    }
    case 'audius':
      return audiusStreamUrl(track.ref);
    case 'youtube':
    case 'soundcloud':
      throw new Error(`${track.source} tracks use their own player`);
    default:
      return track.ref;
  }
}
