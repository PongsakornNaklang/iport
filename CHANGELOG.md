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

### Added
- A fifth iPod: the iPod (5th generation, 2005), "iPod video". Glossy white
  or black polycarbonate front, or the U2 Special Edition with its red
  Click Wheel; the stainless steel back; Hold switch and headphone jack on
  top, so the EarPods plug in there (an iPod Sock leaves them free); the
  Click Wheel software from before Cover Flow and Genius, with the plain
  full-width main menu. Cases, socks, stickers and engraving all fit it.

### Changed
- A new model chooser: click the iPod's name and every iPod floats up on
  the stage, live and 3D, in your colors and at their real sizes. Point at
  one to lift it, click to pick it, and it flies to the middle. ← → (and
  ↑ ↓ on phones) move between them, Enter picks, Esc keeps the one you have.
- Changing iPods turns the old one away and the new one in.
- Shift ← → steps to the previous or next iPod at any time.
- On phones the chooser is a carousel: one iPod big in the middle, its
  neighbours peeking in at the edges; swipe to move, tap the middle to pick.
- The model button is a round icon at the right of the top bar; the other
  controls step aside while you choose.

- On phones the view bar folds into one round button in the corner (front,
  back, side, spin, save image), giving the iPod the bottom of the screen.
  Zoom with two fingers; double-tap empty space to face front at 100%.

- The Library's small tab switches (Songs & Videos / Playlists and the
  others) slide their white thumb like the panel tabs.

### Fixed
- An iPod Sock covers the headphone jack on the iPod touch, nano and
  classic (it's on the bottom, inside the sock): the EarPods come out when
  you put one on, can't be plugged in while it's on, and the music plays
  on. They plug back in when the sock comes off. The shuffle's jack is on
  top, outside the sock, and still works.
- Smoother on phones: the EarPods no longer measure the iPod and redraw
  their canvases every frame when nothing moves, and a still iPod costs the
  stage nothing a frame. In the chooser the iPods' own screen animations pause.

## [1.2.0] - 2026-10-22

### Added
- Stickers can go on the front too, over the screen and the Click Wheel,
  like a real sticker; choose the side when you add one, or move it across
  later. Engraved text stays on the back.
- Save image: the camera button with the view controls downloads the iPod
  as a PNG, as you see it (case, sock, stickers, EarPods), on a transparent
  background and cropped to the iPod.
- Undo and redo for the design: ⌘Z / Ctrl+Z and Shift+⌘Z / Ctrl+Y, or the
  arrows in Customize. A drag, a pinch or a slider move is one step.
- Stickers on phones and tablets: pinch to resize, twist to turn. A selected
  sticker or engraving has a corner handle to resize and turn it and a ×
  to remove it. Stickers only move while Customize is open; the rest of the
  time a drag over one turns the iPod, and a tap goes through to the
  screen or button under it.

## [1.1.0] - 2026-10-22

### Added
- Cases and iPod Socks, under Customize → Design. Silicone and leather cases
  fit the iPod touch, nano and classic, with cut-outs for the buttons, ports
  and the touch's camera. iPod Socks fit every model, in the six colors of
  Apple's 2004 set or any color you pick. Like Apple's, each is one knitted
  piece: wide rib knit that spreads where it stretches over the iPod, a
  lighter cuff, the woven Apple tag, the iPod pulled a third of the way out
  of the top, and the empty toe narrowing to a flat seam. The toe is soft:
  it sags as you tilt the iPod and swings when you move it. The buttons and
  screen still work through either. Presets and share links keep the case.
- Stickers and engraved text anywhere on the back, under Customize →
  Design: a set of stickers or your own picture (die-cut, with a white
  border), and lines of text in four fonts, engraved the way each iPod
  engraves. Drag them around right on the iPod's back; scroll over one to
  resize it, Shift-scroll to turn it. They show through a clear case.
- A clear case (clear, smoke, ice blue or rose) for the iPod touch, nano and
  classic: the iPod shows through it.

### Changed
- iPod touch: over the screen the pointer is a fingertip circle, as on the
  nano.
- With a mouse, the view controls wait off the right edge of the window and
  slide in when the pointer comes near it (a thin grip marks the spot), so
  the iPod gets the whole window.
- The EarPods cable is shaded as round matte rubber instead of a white line
  with a grey outline.
- Panel tabs (Customize, Library) have a white thumb that slides to the
  chosen tab, and clicking a tab no longer leaves a focus ring on it.
- Scrollbars in panels and menus are thin and light instead of the system's
  dark bar.
- The view controls (Front, Back, Side, 360°, zoom) are a slim pill on the
  right edge of the window instead of a bar along the bottom, leaving room
  for the iPod and its EarPods cable. Phones keep them along the bottom.

### Fixed
- iPod touch: app cards in the app switcher have all four corners rounded
  (the tab bar at the bottom of some apps showed square corners).
- EarPods: in landscape (video on the iPod touch or nano) the plug stayed
  where the jack was before the iPod turned. It now follows the jack.
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
- EarPods: let go of an unplugged plug and the EarPods leave the screen
  (they used to lie along the bottom of the window); press play and they come
  back. Dropping the plug right by the jack still plugs it back in.

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

[Unreleased]: https://github.com/PongsakornNaklang/iport/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/PongsakornNaklang/iport/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/PongsakornNaklang/iport/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PongsakornNaklang/iport/releases/tag/v1.0.0
