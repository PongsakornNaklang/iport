# iPort architecture

iPort is a Vite + React 19 + TypeScript app (Zustand for state, IndexedDB via
idb-keyval for storage). It deploys to Vercel as a static site plus a few
serverless functions in `api/`.

```
src/
  core/                 shared, device-independent logic
    types.ts            Track, Playlist, Photo, Note, Contact, CalendarEvent, Alarm…
    db.ts               IndexedDB blobs (putBlob/getBlob/blobUrl) + zustand IDB storage
    library/
      store.ts          useLibrary: tracks, playlists, photos, notes, contacts, events, alarms, world clocks, voice memos
      selectors.ts      songs/artists/albums/genres/composers/compilations/podcasts/audiobooks/videos,
                        playlistTracks (smart playlists), searchLibrary, geniusPlaylist, geniusMixes
      artwork.ts        useArtworkUrl(ref) resolves `idb:` refs; DEFAULT_ARTWORK
      Artwork.tsx       <Artwork src size radius/> — use this to show any artwork
      importLocal.ts    importFiles(files) — audio/video/images → library
      demo.ts           first-run demo songs (synthesized) + YouTube seeds
    player/
      player.ts         usePlayer (state) + player (actions) — ONE queue for every model
      MediaLayer.tsx    <MediaLayer visible style/> — host for YouTube/SoundCloud iframes + local video
      audioGraph.ts     EQ / Sound Check (Web Audio), getAnalyser()
      eq.ts             EQ_PRESETS (iPod list), EQ_PRESET_NAMES
    settings/store.ts   useSettings: volume, shuffle, repeat, eq, soundCheck, backlight, brightness,
                        clicker, use24h, lockCode, mainMenu/musicMenu, per-device `device[modelId]`
    customize/store.ts  useCustomize: current model, appearance per model, scene, presets
    sound/click.ts      playClick() (clicker), playTone(), playTap(), playLock(), alarm sound
    alarms.ts           useAlarmState { ringing }, dismissAlarm(), snoozeAlarm()
    util/               format.ts (formatTime, compareTitles, indexLetter, formatClock),
                        hooks.ts (useNow, useBattery, useInterval), id.ts (uid)
  shell/
    Stage.tsx           3D stage: fit to viewport, drag-rotate, inertia, zoom
    Device3D.tsx        <Device3D> slab with real thickness, <Box3D> cuboids, <EdgeDecal>
    keyboard.ts         isTypingTarget(e.target)
  devices/
    registry.ts         MODELS (newest first) — size, color slots, options, finishes
    types.ts            DeviceModel, DeviceProps, Appearance
    shared/clickwheel/  WheelBus (input events), <ClickWheel>, useWheelKeyboard
    shared/games/       Click Wheel games (Brick, Music Quiz, Parachute, Solitaire, Vortex)
    touch7/  nano7/  shuffle4/  classic/   one folder per model, default export = device component
  ui/                   website chrome: top bar, panels (Library, Customize, Help)
api/                    Vercel functions (YouTube search, feed proxy…)
```

## Device contract

A model is an entry in `devices/registry.ts` plus a folder whose `index.tsx`
default-exports `function Device({ model, appearance }: DeviceProps)`.

* Render a `<Device3D width height depth radius front back edge>` whose size
  is exactly `model.size` (CSS px). Sizes are real mm converted so the screen
  renders at native resolution (classic 320×240, nano 7G 240×432, touch 320×568).
* Colors come from `appearance.colors[slot]` (slots declared in the registry),
  options from `appearance.options[key]`, engraving from `appearance.engraving`.
* Mark every interactive element with the `data-control` attribute. Pointer
  downs elsewhere rotate the device; Shift/Alt/right-drag always rotates.
* The stage sets CSS variables on an ancestor you can use for lighting:
  `--rx`, `--ry` (degrees), `--lx`, `--ly` (sin of the angles, −1..1).
* Keyboard: devices may listen on `window`, but must ignore events where
  `isTypingTarget(e.target)` is true and events with meta/ctrl.
* Only one device is mounted at a time. Music keeps playing when the user
  switches models; every model must reflect the shared player state.

## Playing media

```ts
import { player, usePlayer, useCurrentTrack } from '@/core/player/player';
player.playTracks(ids, startIndex, { shuffle? })   // start a list
player.toggle() / play() / pause() / next() / prev() / seek(s) / seekBy(d)
player.volumeBy(±0.05) / setVolume(v)              // persisted in settings
player.setShuffle('off'|'songs'|'albums') / setRepeat('off'|'one'|'all')
player.enqueueNext(ids) / enqueue(ids) / jumpTo(i) / setSleepTimer(min|null)
usePlayer(s => s.status)  // 'idle'|'loading'|'playing'|'paused'
usePlayer(s => s.position), s.duration, s.queue, s.index, s.currentId, s.kind ('html5'|'youtube'|'soundcloud')
usePlayer(s => s.hasVideo)   // current item has a picture (local video / YouTube)
```

The queue and position are saved to localStorage and restored (paused) on the
next visit; `player.play()` loads the media on demand.

**MediaLayer**: every device with a screen renders exactly one
`<MediaLayer visible={…} style={…}/>` inside its screen and keeps it mounted
while the device exists (YouTube/SoundCloud iframes live inside it; unmounting
reloads them). `visible` shows the picture: use it for video playback and to
show the YouTube video as "artwork" on Now Playing (position it with `style`).

## Library

```ts
const tracks = useLibrary(s => s.tracks)          // Record<id, Track>
songs(tracks), artists(tracks), albums(tracks), albumsOfArtist(tracks, name),
tracksOfArtist, genres, composers, compilations, podcasts, audiobooks,
videosOf(tracks, 'movie'|'tvshow'|'musicvideo'), radioStations,
playlistTracks(tracks, playlist), searchLibrary(tracks, q), geniusPlaylist, geniusMixes
usePlaylists()  // ordered, includes smart playlists and On-The-Go
useLibrary.getState().addToOnTheGo(ids) / setRating(id, n) / upsertNote(...) …
```

Show artwork with `<Artwork src={track.artwork} size={n} />`.
