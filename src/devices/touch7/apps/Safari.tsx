/**
 * Safari (iOS 15, bottom tab bar). Start page with Favorites, a real
 * address bar, and pages shown in a sandboxed frame. Plain words search
 * Wikipedia (most search engines refuse to be framed). Sites that refuse
 * framing can be opened in a real browser tab.
 */
import { useRef, useState } from 'react';
import { Glyph } from '../os/glyphs';
import { os } from '../os/store';
import { Scroller } from '../os/Scroller';
import { useApp } from '../os/ui';

const FAVORITES: { name: string; url: string; color: string }[] = [
  { name: 'Wikipedia', url: 'https://en.m.wikipedia.org/', color: '#636366' },
  { name: 'Open-Meteo', url: 'https://open-meteo.com/', color: '#ff9500' },
  { name: 'Internet Archive', url: 'https://archive.org/', color: '#3a3a3c' },
  { name: 'MDN', url: 'https://developer.mozilla.org/', color: '#1c1c1e' },
  { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/', color: '#7ebc6f' },
  { name: 'Wikivoyage', url: 'https://en.m.wikivoyage.org/', color: '#00a3a3' },
  { name: 'Wiktionary', url: 'https://en.m.wiktionary.org/', color: '#2c6eb5' },
  { name: 'iPort Help', url: 'about:help', color: '#007aff' },
];

function toUrl(input: string): string {
  const s = input.trim();
  if (!s) return '';
  if (/^about:/.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s) && !/\s/.test(s)) return `https://${s}`;
  return `https://en.m.wikipedia.org/w/index.php?search=${encodeURIComponent(s)}`;
}
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

export default function Safari() {
  const app = useApp();
  const [hist, setHist] = useState<string[]>([]);
  const [pos, setPos] = useState(-1);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [reader, setReader] = useState(false);
  const [nonce, setNonce] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const url = pos >= 0 ? hist[pos] : '';

  const go = (raw: string) => {
    const u = toUrl(raw);
    setEditing(false);
    input.current?.blur();
    if (!u) return;
    const h = [...hist.slice(0, pos + 1), u];
    setHist(h);
    setPos(h.length - 1);
    setLoading(u !== 'about:help');
  };

  return (
    <div className="t7sf">
      <div className="t7sf-content">
        {!url && (
          <Scroller className="t7sf-start">
            <div className="t7sf-h">Favorites</div>
            <div className="t7sf-favs">
              {FAVORITES.map((f) => (
                <button key={f.name} onClick={() => go(f.url)}>
                  <span className="ic" style={{ background: f.color }}>
                    {f.name[0]}
                  </span>
                  <span className="n">{f.name}</span>
                </button>
              ))}
            </div>
            <div className="t7sf-h">Privacy Report</div>
            <div className="t7sf-card">
              <Glyph name="hand.raised.fill" size={22} />
              <span>In the last seven days, Safari has prevented 12 trackers from profiling you.</span>
            </div>
            <div className="t7sf-h">Reading List</div>
            <div className="t7sf-card muted">
              <Glyph name="book" size={20} />
              <span>Save pages to read later — your Reading List is empty.</span>
            </div>
          </Scroller>
        )}
        {url === 'about:help' && (
          <Scroller className="t7sf-help">
            <h1>Using iPort’s iPod touch</h1>
            <p>
              <b>Home button</b> — click to go Home, double-click for the app switcher, hold for Siri. Keyboard: <kbd>H</kbd>.
            </p>
            <p>
              <b>Sleep/Wake</b> — the button on the top edge, or <kbd>L</kbd>. <b>Volume</b> — the side buttons, or <kbd>+</kbd> / <kbd>−</kbd>. <kbd>Space</kbd> plays and pauses.
            </p>
            <p>
              <b>Control Center</b> — drag up from the bottom edge of the screen. <b>Notifications</b> — drag down from the top edge.
            </p>
            <p>
              <b>Music</b> — import files, YouTube, SoundCloud and free music with the Library button above the iPod. Long-press songs for more options.
            </p>
            <p>Drag outside the screen (or with Shift held) to rotate the iPod in 3D.</p>
          </Scroller>
        )}
        {url && url !== 'about:help' && (
          <iframe
            key={`${url}#${nonce}`}
            className={`t7sf-frame ${reader ? 'reader' : ''}`}
            src={url}
            title="Safari"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            onLoad={() => setLoading(false)}
            style={{ pointerEvents: app.active ? 'auto' : 'none' }}
          />
        )}
        {url && url !== 'about:help' && (
          <div className="t7sf-hint">
            <span>Page not showing? Some sites can’t be shown inside an iPod frame.</span>
            <button onClick={() => window.open(url, '_blank', 'noopener')}>Open ↗</button>
          </div>
        )}
      </div>
      <div className="t7sf-bar">
        <div className={`t7sf-addr ${editing ? 'editing' : ''}`}>
          {!editing && url && (
            <button className="t7sf-aa" onClick={() => setReader(!reader)} aria-label="Reader">
              <Glyph name="aA" size={18} />
            </button>
          )}
          <div className="t7sf-field" onClick={() => !editing && (setEditing(true), setText(url && url !== 'about:help' ? url : ''), window.setTimeout(() => input.current?.select(), 30))}>
            {editing ? (
              <input
                ref={input}
                value={text}
                autoFocus
                placeholder="Search or enter website name"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') go(text);
                  if (e.key === 'Escape') setEditing(false);
                }}
                onBlur={() => window.setTimeout(() => setEditing(false), 150)}
                spellCheck={false}
              />
            ) : (
              <span className={url ? '' : 'ph'}>
                {url && url !== 'about:help' && <Glyph name="lock.fill" size={11} />}
                {url ? (url === 'about:help' ? 'iPort Help' : host(url)) : 'Search or enter website name'}
              </span>
            )}
          </div>
          {!editing && url && (
            <button className="t7sf-aa" onClick={() => (setLoading(true), setNonce(nonce + 1))} aria-label="Reload">
              <Glyph name="arrow.clockwise" size={16} />
            </button>
          )}
          {loading && <span className="t7sf-progress" />}
        </div>
        <div className="t7sf-tools">
          <button disabled={pos < 0} onClick={() => setPos(pos - 1)} aria-label="Back">
            <Glyph name="chevron.left" size={22} />
          </button>
          <button disabled={pos >= hist.length - 1} onClick={() => setPos(pos + 1)} aria-label="Forward">
            <Glyph name="chevron.right" size={22} />
          </button>
          <button
            aria-label="Share"
            disabled={!url}
            onClick={() => void navigator.clipboard?.writeText(url).then(() => os.toast('Link Copied', 'link'), () => {})}
          >
            <Glyph name="square.and.arrow.up" size={22} />
          </button>
          <button aria-label="Bookmarks" onClick={() => (setPos(-1), setEditing(false))}>
            <Glyph name="book" size={22} />
          </button>
          <button aria-label="Tabs" onClick={() => os.toast('1 Tab', 'square.on.square')}>
            <Glyph name="square.on.square" size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
