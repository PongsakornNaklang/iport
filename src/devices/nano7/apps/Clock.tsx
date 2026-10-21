/**
 * Clock: swipe between the clock face, the stopwatch and the timer (page
 * dots at the bottom, like the nano). Tap the clock face to change it.
 * The stopwatch and timer keep running while you use other apps; the timer
 * itself fires from services.ts (alarm screen or "Sleep iPod").
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '../../../core/settings/store';
import { useNow } from '../../../core/util/hooks';
import { nano, stopwatchMs, useClockState, useNanoData } from '../state';
import { NavStack, usePage } from '../os/Nav';
import { Dots, Pager } from '../os/Pager';
import { ScrollView } from '../os/ScrollView';
import { Wheel } from '../os/Wheel';
import { t } from '../os/i18n';
import { useAppNav } from './registry';

export const CLOCK_FACES = ['Classic', 'Night', 'Digital', 'Color', 'Minimal'];

let lastPage = 0;

export function ClockApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('clock');
  return <NavStack root={{ title: 'Clock', node: <ClockPages />, bar: false, theme: 'light', bg: '#000' }} tint="#ff9500" active={active} apiRef={apiRef} />;
}

function ClockPages() {
  const [page, setPage] = useState(lastPage);
  const { active } = usePage();
  const go = (i: number) => {
    lastPage = i;
    setPage(i);
  };
  return (
    <div className="n7-clock">
      <Pager
        index={page}
        count={3}
        onChange={go}
        render={(i) => (i === 0 ? <ClockFacePage /> : i === 1 ? <StopwatchPage live={active && page === 1} /> : <TimerPage />)}
      />
      <Dots count={3} index={page} onPick={go} />
    </div>
  );
}

// ---------------------------------------------------------------- clock faces

function ClockFacePage() {
  const face = useNanoData((s) => s.clockFace);
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  const next = () => useNanoData.getState().set('clockFace', (face + 1) % CLOCK_FACES.length);
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className="n7-clockface-page" onClick={next}>
      <div className="n7-clockface" key={face}>
        {face === 2 ? <DigitalFace now={now} use24h={use24h} /> : <AnalogFace now={now} kind={face} />}
      </div>
      {face !== 2 && <div className="n7-clock-date">{date}</div>}
      <div className="n7-clock-hint">{t(CLOCK_FACES[face])}</div>
    </div>
  );
}

function AnalogFace({ now, kind }: { now: Date; kind: number }) {
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const night = kind === 1;
  const color = kind === 3;
  const minimal = kind === 4;
  const dial = night ? '#111113' : minimal ? '#f4f4f2' : '#fbfbfb';
  const ink = night ? '#f5f5f7' : '#111';
  const sec = night ? '#ff9500' : '#ff3b30';
  const RAINBOW = ['#ff3b30', '#ff9500', '#ffcc00', '#8bd448', '#4cd964', '#2cc8a7', '#34aadc', '#007aff', '#5856d6', '#9b59b6', '#ff2d55', '#ff5e7a'];
  const ticks: ReactNode[] = [];
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0;
    if (minimal && !(i % 15 === 0)) continue;
    if (color && hour) {
      ticks.push(<circle key={i} cx="100" cy="16" r="5.2" fill={RAINBOW[i / 5]} transform={`rotate(${i * 6} 100 100)`} />);
      continue;
    }
    if (color) {
      ticks.push(<circle key={i} cx="100" cy="16" r="1" fill="#c7c7cc" transform={`rotate(${i * 6} 100 100)`} />);
      continue;
    }
    ticks.push(
      <line
        key={i}
        x1="100"
        y1={minimal ? 10 : 9}
        x2="100"
        y2={minimal ? 22 : hour ? 21 : 14}
        stroke={ink}
        strokeOpacity={hour || minimal ? 1 : 0.55}
        strokeWidth={minimal ? 2 : hour ? 2.6 : 1}
        transform={`rotate(${i * 6} 100 100)`}
      />,
    );
  }
  const numerals =
    kind === 0 || night
      ? Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          const a = (n * 30 * Math.PI) / 180;
          return (
            <text key={n} x={100 + Math.sin(a) * 63} y={100 - Math.cos(a) * 63 + 6} textAnchor="middle" fontSize="17" fontWeight="300" fill={ink} fontFamily="-apple-system, 'Helvetica Neue', Helvetica, Arial">
              {n}
            </text>
          );
        })
      : null;
  return (
    <svg viewBox="0 0 200 200" width="216" height="216">
      <circle cx="100" cy="100" r="99" fill={dial} />
      {!night && <circle cx="100" cy="100" r="98.5" fill="none" stroke="rgba(0,0,0,0.12)" />}
      {ticks}
      {numerals}
      <g transform={`rotate(${h * 30} 100 100)`}>
        <line x1="100" y1="112" x2="100" y2={minimal ? 54 : 50} stroke={ink} strokeWidth={minimal ? 3 : 6} strokeLinecap="round" />
      </g>
      <g transform={`rotate(${m * 6} 100 100)`}>
        <line x1="100" y1="114" x2="100" y2={minimal ? 22 : 24} stroke={ink} strokeWidth={minimal ? 2 : 4} strokeLinecap="round" />
      </g>
      <g transform={`rotate(${s * 6} 100 100)`} className="n7-sechand">
        <line x1="100" y1="122" x2="100" y2="14" stroke={color ? '#111' : sec} strokeWidth="1.4" />
        <circle cx="100" cy="100" r="3.6" fill={color ? '#111' : sec} />
      </g>
      <circle cx="100" cy="100" r="1.4" fill={dial} />
    </svg>
  );
}

function DigitalFace({ now, use24h }: { now: Date; use24h: boolean }) {
  let h = now.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (!use24h) h = h % 12 || 12;
  return (
    <div className="n7-digital">
      <div className="n7-digital-time">
        {use24h ? String(h).padStart(2, '0') : h}
        <span className="n7-digital-colon">:</span>
        {String(now.getMinutes()).padStart(2, '0')}
        {!use24h && <span className="n7-digital-ampm">{ampm}</span>}
      </div>
      <div className="n7-digital-day">{now.toLocaleDateString(undefined, { weekday: 'long' })}</div>
      <div className="n7-digital-date">{now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
  );
}

// ---------------------------------------------------------------- stopwatch

function fmtSw(ms: number): string {
  const cs = Math.floor(ms / 10) % 100;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  return h ? `${h}:${base}` : base;
}

function StopwatchPage({ live }: { live: boolean }) {
  const st = useClockState();
  const big = useRef<HTMLDivElement>(null);
  const lap = useRef<HTMLDivElement>(null);
  const lapsTotal = st.laps.reduce((a, b) => a + b, 0);

  useEffect(() => {
    const paint = () => {
      const c = useClockState.getState();
      const ms = stopwatchMs(c);
      if (big.current) big.current.textContent = fmtSw(ms);
      if (lap.current) lap.current.textContent = c.laps.length || c.swRunning ? fmtSw(ms - c.laps.reduce((a, b) => a + b, 0)) : '';
    };
    paint();
    if (!st.swRunning || !live) return;
    let raf = 0;
    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [st.swRunning, st.swAcc, st.laps, live]);

  const startStop = () => {
    const c = useClockState.getState();
    if (c.swRunning) useClockState.setState({ swRunning: false, swAcc: stopwatchMs(c) });
    else useClockState.setState({ swRunning: true, swStart: Date.now() });
  };
  const lapReset = () => {
    const c = useClockState.getState();
    if (c.swRunning) useClockState.setState({ laps: [...c.laps, stopwatchMs(c) - lapsTotal] });
    else useClockState.setState({ swAcc: 0, laps: [] });
  };
  const idle = !st.swRunning && st.swAcc === 0;
  const best = st.laps.length > 1 ? Math.min(...st.laps) : -1;
  const worst = st.laps.length > 1 ? Math.max(...st.laps) : -1;
  return (
    <div className="n7-sw">
      <div className="n7-sw-title">{t('Stopwatch')}</div>
      <div className="n7-sw-big" ref={big}>
        00:00.00
      </div>
      <div className="n7-sw-lap" ref={lap} />
      <div className="n7-roundbtns">
        <button className="n7-roundbtn grey" onClick={lapReset} disabled={idle}>
          {st.swRunning || idle ? t('Lap') : t('Reset')}
        </button>
        <button className={`n7-roundbtn ${st.swRunning ? 'red' : 'green'}`} onClick={startStop}>
          {st.swRunning ? t('Stop') : t('Start')}
        </button>
      </div>
      <div className="n7-sw-laps">
        <ScrollView className="n7-dark-scroll">
          {st.laps
            .map((l, i) => (
              <div key={i} className={`n7-sw-laprow ${l === best ? 'best' : l === worst ? 'worst' : ''}`}>
                <span>
                  {t('Lap')} {i + 1}
                </span>
                <span>{fmtSw(l)}</span>
              </div>
            ))
            .reverse()}
        </ScrollView>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- timer

const HOURS = Array.from({ length: 24 }, (_, i) => String(i));
const MINS = Array.from({ length: 60 }, (_, i) => String(i));

function fmtTimer(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function TimerPage() {
  const secs = useNanoData((s) => s.timerSeconds);
  const action = useNanoData((s) => s.timerAction);
  const timerEnd = useClockState((s) => s.timerEnd);
  const paused = useClockState((s) => s.timerPaused);
  const total = useClockState((s) => s.timerTotal);
  const running = timerEnd !== null || paused !== null;
  useNow(running && timerEnd ? 250 : 60_000);
  const left = timerEnd ? Math.max(0, timerEnd - Date.now()) : paused ?? 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const setHM = (hh: number, mm: number) => useNanoData.getState().set('timerSeconds', Math.max(60, hh * 3600 + mm * 60));

  const start = () => {
    const ms = secs * 1000;
    useClockState.setState({ timerEnd: Date.now() + ms, timerPaused: null, timerTotal: ms });
  };
  const cancel = () => useClockState.setState({ timerEnd: null, timerPaused: null });
  const pause = () => {
    const c = useClockState.getState();
    if (c.timerEnd) useClockState.setState({ timerPaused: Math.max(0, c.timerEnd - Date.now()), timerEnd: null });
    else if (c.timerPaused != null) useClockState.setState({ timerEnd: Date.now() + c.timerPaused, timerPaused: null });
  };
  const whenEnds = () =>
    nano.sheet(
      [
        { label: 'Alarm', onSelect: () => useNanoData.getState().set('timerAction', 'alarm') },
        { label: 'Sleep iPod', onSelect: () => useNanoData.getState().set('timerAction', 'sleep') },
      ],
      'When Timer Ends',
    );

  const R = 92;
  const C = 2 * Math.PI * R;
  const frac = total ? left / total : 0;
  return (
    <div className="n7-timer">
      <div className="n7-sw-title">{t('Timer')}</div>
      {running ? (
        <div className="n7-timer-run">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={R} fill="none" stroke="#2c2c2e" strokeWidth="4" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="#ff9500"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - frac)}
              transform="rotate(-90 100 100)"
              style={{ transition: 'stroke-dashoffset 0.25s linear' }}
            />
          </svg>
          <div className="n7-timer-left">{fmtTimer(left)}</div>
          <div className="n7-timer-action">{action === 'sleep' ? 'Sleep iPod' : t('Alarm')}</div>
        </div>
      ) : (
        <div className="n7-timer-pick">
          <Wheel items={HOURS} value={h} onChange={(i) => setHM(i, m)} label="hours" width={110} dark />
          <Wheel items={MINS} value={m} onChange={(i) => setHM(h, i)} label="min" width={110} dark />
        </div>
      )}
      {!running && (
        <div className="n7-timer-ends" onClick={whenEnds}>
          <span>When Timer Ends</span>
          <span className="n7-timer-ends-v">{action === 'sleep' ? 'Sleep iPod' : t('Alarm')} ›</span>
        </div>
      )}
      <div className="n7-roundbtns n7-timer-btns">
        <button className="n7-roundbtn grey" onClick={cancel} disabled={!running}>
          {t('Cancel')}
        </button>
        {running ? (
          <button className="n7-roundbtn orange" onClick={pause}>
            {paused != null ? t('Resume') : t('Pause')}
          </button>
        ) : (
          <button className="n7-roundbtn green" onClick={start}>
            {t('Start')}
          </button>
        )}
      </div>
    </div>
  );
}
