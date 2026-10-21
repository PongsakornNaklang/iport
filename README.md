# iPort — iPod for the web

A faithful iPod simulator that runs in your browser. Pick a model, load your own
music (or stream from YouTube, SoundCloud and free sources), spin it around in
3D, and design your own colorway.

**Models** (newest first)

| Model | Year | Highlights |
| --- | --- | --- |
| iPod touch (7th generation) | 2019 | iOS-style home screen, Music, Podcasts, Videos, Photos, Camera, Clock, Calculator, Notes, Weather, Voice Memos, Control Center, lock screen |
| iPod nano (7th generation) | 2012 | Circular app icons, Music, Videos, FM-style Radio, Fitness, Photos, Clock |
| iPod shuffle (4th generation) | 2010 | Clickable control pad, three-way switch, status light, VoiceOver |
| iPod classic (6th generation, 160GB) | 2009 | Click Wheel, Cover Flow, Now Playing, On-The-Go, Genius, Extras (alarms, clocks, games, notes, stopwatch, voice memos…), full Settings |

**Music sources**

- Your own files (MP3, AAC/M4A, FLAC, WAV, OGG, video) — tags and album art are read in the browser and kept in IndexedDB; nothing is uploaded.
- YouTube and SoundCloud links (and YouTube search) through their official embedded players.
- Free sources: Audius, the Internet Archive, internet radio (radio-browser.info), podcasts, 30-second iTunes previews, any direct audio URL.

**Everything else**

- Real 3D body: drag to spin, inertia, zoom, front/back/side views.
- Customize every colored part, materials, wallpapers, screen theme, engraving on the back, and the backdrop.
- Save designs as presets, share them as a link, export/import them as a file.
- Shared player: switching models keeps the music playing. Queue and position are remembered between visits.
- Equalizer (all iPod presets), Sound Check, sleep timer, alarms, Media Session (keyboard media keys / lock-screen controls).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173  (?model=classic|touch7|nano7|shuffle4)
npm run build      # type-check + production build into dist/
npm test           # unit tests
```

The serverless functions in `api/` (YouTube search, podcast feed proxy…) run on
Vercel. Locally, use `npx vercel dev` if you want them; the rest of the app
works with `npm run dev`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organised.

## Deploy to Vercel

1. Push this repository to GitHub (already done if you are reading this there).
2. Go to <https://vercel.com/new>, choose **Import Git Repository**, and pick this repo.
3. Vercel detects **Vite** automatically (`vercel.json` sets build command `npm run build` and output `dist`). Click **Deploy**.
4. Every push to the default branch redeploys; pull requests get preview URLs.

No environment variables or API keys are needed.

### วิธี deploy ขึ้น Vercel (ภาษาไทย)

1. เข้า <https://vercel.com/new> แล้วล็อกอินด้วย GitHub
2. กด **Import** ที่ repo นี้
3. Vercel จะตรวจเจอว่าเป็นโปรเจกต์ **Vite** เอง (ตั้งค่าไว้ใน `vercel.json` แล้ว) กด **Deploy** ได้เลย
4. หลังจากนั้นทุกครั้งที่ push โค้ดขึ้น branch หลัก Vercel จะ deploy ใหม่ให้อัตโนมัติ — ไม่ต้องตั้งค่า API key ใด ๆ

## Disclaimer

iPort is a fan-made tribute and is not affiliated with or endorsed by Apple Inc.
iPod, iPod classic, iPod nano, iPod shuffle, iPod touch, Click Wheel and Cover
Flow are trademarks of Apple Inc. All graphics are drawn from scratch with CSS
and SVG.
