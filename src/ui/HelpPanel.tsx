import { useCustomize } from '../core/customize/store';
import { getModel } from '../devices/registry';
import { Panel } from './Panel';
import { APP_COMMIT, APP_VERSION, BUILD_DATE, COPYRIGHT } from '../version';
import './help.css';

function K({ children }: { children: string }) {
  return <kbd className="kbd">{children}</kbd>;
}

export default function HelpPanel({ onClose }: { onClose: () => void }) {
  const model = getModel(useCustomize((s) => s.modelId));
  return (
    <Panel title="How to use iPort" side="right" onClose={onClose}>
      <div className="help">
        <p className="muted">
          Pick an iPod from the menu at the top, add your music from the <b>Library</b> panel, and make it yours in <b>Customize</b>.
          Everything stays in your browser.
        </p>

        <h3>Your {model.name}</h3>
        {model.family === 'clickwheel' && (
          <ul>
            <li>Drag your finger or mouse around the <b>Click Wheel</b> to scroll; a mouse wheel or trackpad works too.</li>
            <li>Click <b>MENU</b> to go back, the <b>center button</b> to select, <b>⏮ ⏭</b> to skip (hold to rewind / fast-forward).</li>
            <li>Hold the center button on a song for options (On-The-Go, Genius, Play Next).</li>
            <li>In Now Playing the wheel changes volume; press center to scrub, rate, or see lyrics.</li>
            <li>Slide the <b>Hold switch</b> on the top edge to lock the buttons. Hold ⏯ to sleep.</li>
          </ul>
        )}
        {model.family === 'touch' && (
          <ul>
            <li>Your mouse is your finger: click to tap, drag to scroll and swipe.</li>
            <li>Press the <b>Home button</b> to go home, double-press for the app switcher, hold for Siri.</li>
            <li>Swipe up from the bottom edge for Control Center, down from the top for notifications.</li>
            <li>The real buttons work: Sleep/Wake on top, volume on the left side.</li>
          </ul>
        )}
        {model.family === 'nano-touch' && (
          <ul>
            <li>Click to tap, drag to scroll and swipe between home pages. Swipe right from the left edge to go back.</li>
            <li>The <b>Home button</b> takes you home. The left-side buttons control volume and play/pause (double-click to skip).</li>
            <li>Try the <b>Radio</b> and <b>Fitness</b> apps.</li>
          </ul>
        )}
        {model.family === 'shuffle' && (
          <ul>
            <li>Slide the switch on top to turn it on (play in order or shuffle).</li>
            <li>Center button plays/pauses; double-click skips ahead, triple-click goes back.</li>
            <li>Press the <b>VoiceOver</b> button to hear the song name; hold it to choose a playlist.</li>
          </ul>
        )}

        <h3>Keyboard</h3>
        <table className="keys">
          <tbody>
            {model.family === 'clickwheel' ? (
              <>
                <tr>
                  <td>
                    <K>↑</K> <K>↓</K>
                  </td>
                  <td>Turn the Click Wheel</td>
                </tr>
                <tr>
                  <td>
                    <K>Enter</K>
                  </td>
                  <td>Center button</td>
                </tr>
                <tr>
                  <td>
                    <K>Esc</K>
                  </td>
                  <td>MENU</td>
                </tr>
                <tr>
                  <td>
                    <K>←</K> <K>→</K>
                  </td>
                  <td>Previous / Next (hold to scan)</td>
                </tr>
              </>
            ) : model.family === 'shuffle' ? (
              <>
                <tr>
                  <td>
                    <K>←</K> <K>→</K>
                  </td>
                  <td>Previous / Next</td>
                </tr>
                <tr>
                  <td>
                    <K>↑</K> <K>↓</K>
                  </td>
                  <td>Volume</td>
                </tr>
                <tr>
                  <td>
                    <K>V</K>
                  </td>
                  <td>VoiceOver button</td>
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <td>
                    <K>H</K>
                  </td>
                  <td>Home button</td>
                </tr>
                <tr>
                  <td>
                    <K>L</K>
                  </td>
                  <td>Sleep / Wake</td>
                </tr>
                <tr>
                  <td>
                    <K>+</K> <K>−</K>
                  </td>
                  <td>Volume</td>
                </tr>
              </>
            )}
            <tr>
              <td>
                <K>Space</K>
              </td>
              <td>Play / Pause</td>
            </tr>
            <tr>
              <td>
                <K>F</K> <K>B</K>
              </td>
              <td>Show front / back</td>
            </tr>
            <tr>
              <td>
                <K>R</K>
              </td>
              <td>Spin 360°</td>
            </tr>
            <tr>
              <td>
                <K>⌘/Ctrl</K> <K>Z</K>
              </td>
              <td>Undo a design change (add <K>Shift</K> to redo)</td>
            </tr>
            <tr>
              <td>
                <K>Shift</K> <K>←</K> <K>→</K>
              </td>
              <td>Previous / next iPod</td>
            </tr>
          </tbody>
        </table>

        <h3>Spin it in 3D</h3>
        <ul>
          <li>Drag the background to rotate. It keeps spinning if you let go mid-swipe.</li>
          <li>Hold <K>Shift</K> or drag with the right mouse button to rotate while over the controls.</li>
          <li>Scroll on the background to zoom (two fingers on a phone); double-click or double-tap empty space to face front at 100%.</li>
          <li>On a phone, the round button in the bottom corner holds the views: front, back, side, spin and save as a picture.</li>
          <li>The camera button with the view controls saves the iPod as a picture, as you see it, on a transparent background.</li>
        </ul>

        <h3>Adding music</h3>
        <ul>
          <li>
            <b>Your files</b> — MP3, AAC/M4A, FLAC, WAV, OGG, and videos. Drag them anywhere onto the page or use Library ▸ Add Music. Tags and
            album art are read automatically.
          </li>
          <li>
            <b>YouTube</b> and <b>SoundCloud</b> — paste a link or search.
          </li>
          <li>
            <b>Free sources</b> — Audius, the Internet Archive, thousands of internet radio stations, podcasts and 30-second iTunes previews.
          </li>
        </ul>

        <h3>Presets</h3>
        <p className="muted">
          Customize ▸ Presets saves the model, colors, options, engraving and backdrop. Share a design as a link, or export all your presets
          as a file.
        </p>

        <div className="help-about">
          <div className="help-version">
            iPort {APP_VERSION}
            <span className="tiny">
              {' '}
              · build {APP_COMMIT}
              {BUILD_DATE && ` · ${BUILD_DATE}`}
            </span>
          </div>
          <div className="tiny">{COPYRIGHT}</div>
          <a className="tiny help-link" href="third-party-notices.txt" target="_blank" rel="noreferrer">
            Open-source licenses
          </a>
        </div>

        <p className="tiny" style={{ marginTop: 12 }}>
          iPort is a fan-made tribute and is not affiliated with or endorsed by Apple Inc. iPod, iPod classic, iPod nano, iPod shuffle, iPod
          touch, Click Wheel and Cover Flow are trademarks of Apple Inc. Music from YouTube and SoundCloud plays through their official
          embedded players.
        </p>
      </div>
    </Panel>
  );
}
