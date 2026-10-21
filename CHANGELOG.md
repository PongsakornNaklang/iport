# Changelog

All notable changes to iPort are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
versions follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (2.0.0): something users relied on changes or goes away
  (saved libraries or presets stop loading, a model is removed).
- **MINOR** (1.1.0): new features that keep everything working
  (a new iPod model, a new music source, a new app or game).
- **PATCH** (1.0.1): bug fixes and polish only.

The running app shows its version and build in the Help panel (?).

## [Unreleased]

### Fixed
- The sides of every iPod are now one continuous surface. Seen edge-on or
  zoomed in they no longer show stripes, gaps or saw-tooth corners, and their
  shading (the iPod classic's mirror-steel back especially) is smooth instead
  of banded.
- Spinning the iPod classic and iPod nano is noticeably smoother.
- The iPod classic's headphone jack, dock connector and Hold switch follow
  the curve of the steel edge, so the edge no longer hides part of them.
- iPod shuffle: the clip's edge is smooth too, the front and back no longer
  stick out at the corners, and the headphone port looks like a real hole
  from every angle.
- iPod nano: the side and top buttons are rounded pills without the stray
  dash above and below them.
- EarPods: the plug and cable grow with the zoom, and the cable is stiffer
  (especially at the plug) so it no longer droops, loops or wobbles like
  string when you shake the iPod.
- EarPods: pressing play starts the music with the click of the plug, not
  before; the part of the plug inside the jack is no longer drawn over the
  iPod while it goes in, and the stray line across the plug is gone.
- EarPods: the plug stays round where it meets the jack from every angle;
  letting go of the cable after pulling it no longer leaves it stuck in the
  air, and pulling it far enough yanks the plug out (and pauses); the cable
  is stiffer, can't get tied in loops, and springs back to a natural curve.

## [1.0.0] - 2026-10-21

First release.

### Models
- iPod touch (7th generation): lock screen, home screen with pages and dock,
  Control Center, app switcher, Music (Listen Now, Browse, Radio, Library,
  Search, Now Playing with synced lyrics and Up Next), Podcasts, TV, Photos,
  Camera, Clock, Calculator, Notes, Calendar, Contacts, Voice Memos, Weather,
  Settings and iTunes Store previews.
- iPod nano (7th generation): circular app icons, Music, Videos (rotates
  sideways), Fitness, Podcasts, Photos, FM-style Radio, Clock, iTunes U,
  Voice Memos, Settings, lock screen.
- iPod shuffle (4th generation): clickable control pad, three-way switch,
  status light, VoiceOver with spoken playlists and an on-screen caption.
- iPod classic (6th generation, 160GB): Click Wheel, split-screen main menu,
  Cover Flow, Now Playing (scrubber, Genius, rating, shuffle, lyrics),
  On-The-Go, Genius and Genius Mixes, Videos, Photos, Podcasts, Extras
  (alarms, sleep timer, calendars, clocks, contacts, notes, screen lock,
  stopwatch, voice memos), full Settings.
- Click Wheel games: Brick, Parachute, Music Quiz, Solitaire, Vortex.

### Music
- One shared player for every model: switching models keeps the music
  playing; the queue and position are remembered between visits.
- Your own files (MP3, AAC/M4A, FLAC, WAV, OGG, video) with tags and album
  art, stored privately in the browser; drag and drop anywhere.
- YouTube and SoundCloud through their official players; Audius, Internet
  Archive, internet radio, podcasts, iTunes previews and direct links.
- Equalizer with all iPod presets, Sound Check, synced lyrics (LRCLIB),
  Media Session controls, sleep timer, alarms.
- Five demo songs generated in the browser on first launch.

### Look and feel
- Real 3D bodies: drag to spin, inertia, zoom, front/back/side views.
- EarPods: a physics cable rises and plugs into the headphone jack when
  music plays; pull the plug out to pause.
- Customize every part's color, materials, wallpapers, screen theme,
  engraving and backdrop; save presets, share them as links, export and
  import them.
- Apple-style minimal Liquid Glass interface on white; works on phones and
  installs as a web app.

[Unreleased]: https://github.com/PongsakornNaklang/iport/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/PongsakornNaklang/iport/releases/tag/v1.0.0
