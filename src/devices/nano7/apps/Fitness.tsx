/**
 * Fitness: the built-in pedometer (all-day steps), Walk and Run workouts
 * with Basic / Time / Distance / Calories goals, and History with personal
 * bests. Steps come from the accelerometer (DeviceMotion) when the browser
 * has one, otherwise from a believable simulation (see services.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { player, useCurrentTrack, usePlayer } from '../../../core/player/player';
import { playTone } from '../../../core/sound/click';
import { useNow } from '../../../core/util/hooks';
import { dayKey, nano, useNanoData, useWorkout, workoutMs, type Workout, type WorkoutRun } from '../state';
import { Glyph } from '../os/icons';
import { NavStack, useNav, type PageSpec } from '../os/Nav';
import { Page, PillButton, Row, Section, Switch } from '../os/ui';
import { t } from '../os/i18n';
import { useAppNav } from './registry';
import { nowPlayingSpec } from './common';

const TINT = '#4cd964';
const GROUPED = '#efeff4';

// ---------------------------------------------------------------- maths

export function strideM(kind: 'walk' | 'run', heightCm: number): number {
  return (heightCm / 100) * (kind === 'run' ? 0.65 : 0.415);
}
export function kcal(kind: 'walk' | 'run', meters: number, weightKg: number): number {
  return (meters / 1000) * weightKg * (kind === 'run' ? 1.03 : 0.53);
}
const UNIT_M = { mi: 1609.344, km: 1000 };

export function fmtDist(m: number, units: 'mi' | 'km', digits = 2): string {
  return `${(m / UNIT_M[units]).toFixed(digits)} ${units}`;
}
function fmtPace(sec: number, meters: number, units: 'mi' | 'km'): string {
  if (meters < 20 || sec < 5) return `--'--"`;
  const p = sec / (meters / UNIT_M[units]);
  if (p > 99 * 60) return `--'--"`;
  return `${Math.floor(p / 60)}'${String(Math.round(p % 60)).padStart(2, '0')}"`;
}
function fmtDur(sec: number): string {
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
const num = (n: number) => Math.round(n).toLocaleString();

function useToday() {
  useNow(2000);
  const d = useNanoData();
  const steps = d.steps[dayKey(new Date())] ?? 0;
  const meters = steps * strideM('walk', d.heightCm);
  return { steps, meters, cal: kcal('walk', meters, d.weightKg), goal: d.stepGoal, units: d.units, pedometer: d.pedometer };
}

// ---------------------------------------------------------------- app

export function FitnessApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('fitness');
  return <NavStack root={{ title: 'Fitness', node: <FitnessRoot />, bg: GROUPED }} tint={TINT} active={active} apiRef={apiRef} />;
}

const sub = (title: string, node: React.ReactNode, extra?: Partial<PageSpec>): PageSpec => ({ title, node, bg: GROUPED, ...extra });

function workoutSpec(kind: 'walk' | 'run'): PageSpec {
  return { title: kind === 'run' ? 'Run' : 'Walk', node: <WorkoutPage />, bar: false, theme: 'light', bg: '#000', kind: 'workout' };
}

function Ring({ value, size, stroke, color, track = 'rgba(0,0,0,0.08)' }: { value: number; size: number; stroke: number; color: string; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="n7-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

function FitnessRoot() {
  const nav = useNav();
  const today = useToday();
  const run = useWorkout((s) => s.run);
  return (
    <Page grouped>
      <div className="n7-fit-today" onClick={() => nav.push(sub('Walk', <WalkPage />))}>
        <div className="n7-fit-today-ring">
          <Ring value={today.steps / today.goal} size={74} stroke={7} color={TINT} />
          <span className="n7-fit-today-icon">
            <Glyph.walk size={26} color={TINT} />
          </span>
        </div>
        <div className="n7-fit-today-text">
          <div className="n7-fit-today-steps">{num(today.steps)}</div>
          <div className="n7-fit-today-label">{today.pedometer ? 'steps today' : 'Pedometer off'}</div>
          <div className="n7-fit-today-goal">
            {Math.min(100, Math.round((today.steps / today.goal) * 100))}% of {num(today.goal)}
          </div>
        </div>
      </div>
      {run && (
        <Section>
          <Row icon={<Glyph.run size={20} />} title="Workout in Progress" tinted chevron onClick={() => nav.push(workoutSpec(run.kind))} />
        </Section>
      )}
      <Section>
        <Row icon={<Glyph.walk size={20} />} title="Walk" chevron onClick={() => nav.push(sub('Walk', <WalkPage />))} />
        <Row icon={<Glyph.run size={20} />} title="Run" chevron onClick={() => nav.push(sub('Run', <RunPage />))} />
        <Row icon={<Glyph.history size={18} />} title="History" chevron onClick={() => nav.push(sub('History', <HistoryPage />))} />
      </Section>
    </Page>
  );
}

// ---------------------------------------------------------------- walk

function WalkPage() {
  const nav = useNav();
  const today = useToday();
  const run = useWorkout((s) => s.run);
  return (
    <Page grouped>
      <div className="n7-walk">
        <div className="n7-walk-ring">
          <Ring value={today.steps / today.goal} size={150} stroke={11} color={TINT} />
          <div className="n7-walk-center">
            <div className="n7-walk-steps">{num(today.steps)}</div>
            <div className="n7-walk-label">steps</div>
          </div>
        </div>
        <div className="n7-walk-stats">
          <div>
            <b>{fmtDist(today.meters, today.units)}</b>
            <span>distance</span>
          </div>
          <div>
            <b>{num(today.cal)}</b>
            <span>calories</span>
          </div>
          <div>
            <b>{num(Math.max(0, today.goal - today.steps))}</b>
            <span>to goal</span>
          </div>
        </div>
      </div>
      <Section footer="The pedometer counts steps all day, even while the iPod is asleep.">
        <Row title="Pedometer" right={<Switch on={today.pedometer} onChange={(v) => useNanoData.getState().set('pedometer', v)} />} />
        <Row title="Daily Step Goal" detail={num(today.goal)} chevron onClick={() => nav.push(sub('Daily Step Goal', <GoalStepsPage />))} />
      </Section>
      <div className="n7-fit-start">
        <PillButton
          color={TINT}
          disabled={!!run}
          onClick={() => {
            startWorkout('walk', 'basic');
            nav.push(workoutSpec('walk'));
          }}
        >
          {run ? 'Workout in Progress' : 'Start Walk Workout'}
        </PillButton>
      </div>
    </Page>
  );
}

function GoalStepsPage() {
  const goal = useNanoData((s) => s.stepGoal);
  return (
    <Page grouped>
      <Section>
        {[2500, 5000, 7500, 10000, 12500, 15000, 20000].map((n) => (
          <Row key={n} title={`${num(n)} steps`} checked={goal === n} onClick={() => useNanoData.getState().set('stepGoal', n)} />
        ))}
      </Section>
    </Page>
  );
}

// ---------------------------------------------------------------- run

function startWorkout(kind: 'walk' | 'run', goal: Workout['goal'], goalValue?: number) {
  if (useWorkout.getState().run) return;
  useWorkout.setState({ run: { kind, goal, goalValue, start: Date.now(), acc: 0, segStart: null, steps: 0, countdown: 3 } });
  playTone(880, 90, { volume: 0.18 });
}

const GOALS: { goal: Workout['goal']; title: string; sub: string }[] = [
  { goal: 'basic', title: 'Basic', sub: 'Just run' },
  { goal: 'time', title: 'Time', sub: 'Run for a set time' },
  { goal: 'distance', title: 'Distance', sub: 'Run a set distance' },
  { goal: 'calories', title: 'Calories', sub: 'Burn a set number of calories' },
];

function RunPage() {
  const nav = useNav();
  const run = useWorkout((s) => s.run);
  const units = useNanoData((s) => s.units);
  const go = (goal: Workout['goal'], value?: number) => {
    if (useWorkout.getState().run) {
      nav.push(workoutSpec(useWorkout.getState().run!.kind));
      return;
    }
    startWorkout('run', goal, value);
    nav.push(workoutSpec('run'));
  };
  return (
    <Page grouped>
      {run && (
        <Section>
          <Row title="Workout in Progress" tinted chevron onClick={() => nav.push(workoutSpec(run.kind))} />
        </Section>
      )}
      <Section header="Choose a Workout">
        {GOALS.map((g) => (
          <Row
            key={g.goal}
            title={g.title}
            subtitle={g.sub}
            chevron={g.goal !== 'basic'}
            onClick={() => (g.goal === 'basic' ? go('basic') : nav.push(sub(g.title, <GoalValuesPage goal={g.goal} units={units} onPick={(v) => go(g.goal, v)} />)))}
          />
        ))}
      </Section>
    </Page>
  );
}

function GoalValuesPage({ goal, units, onPick }: { goal: Workout['goal']; units: 'mi' | 'km'; onPick: (v: number) => void }) {
  let opts: { v: number; label: string }[] = [];
  if (goal === 'time') opts = [10, 15, 20, 30, 45, 60, 90].map((m) => ({ v: m * 60, label: `${m} minutes` }));
  if (goal === 'distance') opts = (units === 'mi' ? [1, 2, 3.1, 5, 6.2, 13.1] : [1, 3, 5, 10, 21.1, 42.2]).map((d) => ({ v: d * UNIT_M[units], label: `${d} ${units}` }));
  if (goal === 'calories') opts = [100, 200, 300, 400, 500, 750].map((c) => ({ v: c, label: `${c} calories` }));
  return (
    <Page grouped>
      <Section>
        {opts.map((o) => (
          <Row key={o.label} title={o.label} onClick={() => onPick(o.v)} />
        ))}
      </Section>
    </Page>
  );
}

function liveStats(r: WorkoutRun, d: { heightCm: number; weightKg: number }, now = Date.now()) {
  const sec = workoutMs(r, now) / 1000;
  const meters = r.steps * strideM(r.kind, d.heightCm);
  return { sec, meters, cal: kcal(r.kind, meters, d.weightKg), steps: r.steps };
}

function goalProgress(r: WorkoutRun, s: { sec: number; meters: number; cal: number }): number | null {
  if (r.goal === 'basic' || !r.goalValue) return null;
  const v = r.goal === 'time' ? s.sec : r.goal === 'distance' ? s.meters : s.cal;
  return v / r.goalValue;
}

function WorkoutPage() {
  const nav = useNav();
  const run = useWorkout((s) => s.run);
  const d = useNanoData();
  const track = useCurrentTrack();
  const status = usePlayer((s) => s.status);
  const [summary, setSummary] = useState<Workout | null>(null);
  useNow(run && run.segStart ? 250 : 1000);

  const s = run ? liveStats(run, d) : null;
  const prog = run && s ? goalProgress(run, s) : null;

  // announce the goal once
  const announced = useRef(false);
  useEffect(() => {
    if (prog != null && prog >= 1 && !announced.current && run) {
      announced.current = true;
      useWorkout.setState({ run: { ...run, done: true } });
      nano.toast('Goal Reached!');
      playTone(784, 120, { volume: 0.2 });
      playTone(1046, 220, { volume: 0.2, delayMs: 140 });
    }
  }, [prog, run]);

  const pause = () => {
    const r = useWorkout.getState().run;
    if (!r || r.countdown > 0) return;
    if (r.segStart) useWorkout.setState({ run: { ...r, acc: r.acc + (Date.now() - r.segStart), segStart: null } });
    else useWorkout.setState({ run: { ...r, segStart: Date.now() } });
  };
  const end = () => {
    const r = useWorkout.getState().run;
    if (!r) return;
    const st = liveStats(r, useNanoData.getState());
    useWorkout.setState({ run: null });
    if (r.countdown > 0 || st.sec < 3) {
      nav.pop();
      return;
    }
    const w: Workout = {
      id: `w${Date.now().toString(36)}`,
      kind: r.kind,
      goal: r.goal,
      goalValue: r.goalValue,
      start: r.start,
      duration: Math.round(st.sec),
      distance: Math.round(st.meters),
      calories: Math.round(st.cal),
      steps: Math.round(st.steps),
    };
    useNanoData.getState().set('workouts', [w, ...useNanoData.getState().workouts].slice(0, 200));
    setSummary(w);
  };

  if (summary) return <WorkoutSummary w={summary} units={d.units} onDone={() => nav.popToRoot()} />;
  if (!run || !s) {
    return (
      <div className="n7-wo">
        <div className="n7-wo-empty">No workout in progress.</div>
        <div className="n7-wo-btns">
          <button className="n7-roundbtn grey" onClick={() => nav.pop()}>
            {t('Back')}
          </button>
        </div>
      </div>
    );
  }
  if (run.countdown > 0) {
    return (
      <div className="n7-wo">
        <div className="n7-wo-count" key={run.countdown}>
          {run.countdown}
        </div>
        <div className="n7-wo-countlabel">{run.kind === 'run' ? 'Get ready to run' : 'Get ready to walk'}</div>
        <div className="n7-wo-btns">
          <button className="n7-roundbtn grey" onClick={end}>
            {t('Cancel')}
          </button>
        </div>
      </div>
    );
  }
  const paused = !run.segStart;
  const goalLabel =
    run.goal === 'time'
      ? `${Math.round((run.goalValue ?? 0) / 60)} min workout`
      : run.goal === 'distance'
        ? `${fmtDist(run.goalValue ?? 0, d.units, 1)} workout`
        : run.goal === 'calories'
          ? `${run.goalValue} calorie workout`
          : run.kind === 'run'
            ? 'Basic Run'
            : 'Walk';
  const main =
    run.goal === 'time' && run.goalValue
      ? fmtDur(Math.max(0, run.goalValue - s.sec))
      : run.goal === 'distance' && run.goalValue
        ? (Math.max(0, run.goalValue - s.meters) / UNIT_M[d.units]).toFixed(2)
        : run.goal === 'calories' && run.goalValue
          ? num(Math.max(0, run.goalValue - s.cal))
          : fmtDur(s.sec);
  // the four smaller stats: everything except what the big number shows
  const shown = run.goal === 'basic' ? 'time' : run.goal;
  const cells = (
    [
      ['time', fmtDur(s.sec), 'time'],
      ['distance', (s.meters / UNIT_M[d.units]).toFixed(2), d.units],
      ['pace', fmtPace(s.sec, s.meters, d.units), `pace /${d.units}`],
      ['calories', num(s.cal), 'calories'],
      ['steps', num(s.steps), 'steps'],
    ] as const
  )
    .filter(([k]) => k !== shown)
    .slice(0, 4)
    .map(([, v, l]) => [v, l] as const);
  const mainLabel = run.goal === 'time' ? 'remaining' : run.goal === 'distance' ? `${d.units} to go` : run.goal === 'calories' ? 'calories to go' : 'elapsed';
  return (
    <div className={`n7-wo ${paused ? 'paused' : ''}`}>
      <div className="n7-wo-goal">
        {run.kind === 'run' ? <Glyph.run size={14} color={TINT} /> : <Glyph.walk size={14} color={TINT} />}
        {goalLabel}
      </div>
      <div className="n7-wo-main">{main}</div>
      <div className="n7-wo-mainlabel">{paused ? 'Paused' : run.done ? 'Goal Reached!' : mainLabel}</div>
      {prog != null && (
        <div className="n7-wo-prog">
          <div style={{ width: `${Math.min(100, prog * 100)}%` }} />
        </div>
      )}
      <div className="n7-wo-grid">
        {cells.map(([v, l]) => (
          <div key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <div className="n7-wo-btns">
        <button className="n7-roundbtn red" onClick={end}>
          End
        </button>
        <button className={`n7-roundbtn ${paused ? 'green' : 'orange'}`} onClick={pause}>
          {paused ? t('Resume') : t('Pause')}
        </button>
      </div>
      <div className="n7-wo-music">
        <button
          className="n7-wo-music-play"
          onClick={() => {
            if (!usePlayer.getState().currentId) return;
            player.toggle();
          }}
        >
          {status === 'playing' || status === 'loading' ? <Glyph.pause size={13} color="#fff" /> : <Glyph.play size={13} color="#fff" />}
        </button>
        <div className="n7-wo-music-text" onClick={() => track && nav.push(nowPlayingSpec())}>
          {track ? `${track.title}${track.artist ? ' — ' + track.artist : ''}` : 'No music playing'}
        </div>
      </div>
    </div>
  );
}

function WorkoutSummary({ w, units, onDone }: { w: Workout; units: 'mi' | 'km'; onDone: () => void }) {
  return (
    <div className="n7-wo n7-wo-sum">
      <div className="n7-wo-check">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="19" fill={TINT} />
          <path d="M11 20.5l6 6 12-13" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="n7-wo-sumtitle">Workout Complete</div>
      <div className="n7-wo-sumsub">{new Date(w.start).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</div>
      <div className="n7-wo-grid">
        <div>
          <b>{fmtDur(w.duration)}</b>
          <span>time</span>
        </div>
        <div>
          <b>{(w.distance / UNIT_M[units]).toFixed(2)}</b>
          <span>{units}</span>
        </div>
        <div>
          <b>{fmtPace(w.duration, w.distance, units)}</b>
          <span>pace /{units}</span>
        </div>
        <div>
          <b>{num(w.calories)}</b>
          <span>calories</span>
        </div>
      </div>
      <div className="n7-wo-btns">
        <button className="n7-roundbtn green" onClick={onDone}>
          {t('Done')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- history

function HistoryPage() {
  const nav = useNav();
  const d = useNanoData();
  const units = d.units;
  const days = useMemo(() => {
    const out: { key: string; date: Date; steps: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const key = dayKey(date);
      out.push({ key, date, steps: d.steps[key] ?? 0 });
    }
    return out;
  }, [d.steps]);
  const runs = d.workouts.filter((w) => w.kind === 'run');
  const longest = runs.reduce<Workout | null>((a, w) => (!a || w.distance > a.distance ? w : a), null);
  const fastest = runs.filter((w) => w.distance > 400).reduce<Workout | null>((a, w) => (!a || w.duration / w.distance < a.duration / a.distance ? w : a), null);
  const most = d.workouts.reduce<Workout | null>((a, w) => (!a || w.calories > a.calories ? w : a), null);
  const totalDist = d.workouts.reduce((n, w) => n + w.distance, 0);
  const totalCal = d.workouts.reduce((n, w) => n + w.calories, 0);
  const max = Math.max(d.stepGoal, ...days.map((x) => x.steps));
  return (
    <Page grouped>
      <div className="n7-hist-chart">
        <svg width="216" height="96" viewBox="0 0 216 96">
          <line x1="0" x2="216" y1={84 - (d.stepGoal / max) * 70} y2={84 - (d.stepGoal / max) * 70} stroke={TINT} strokeDasharray="3 3" strokeWidth="1" />
          {[...days].reverse().map((x, i) => {
            const h = Math.max(2, (x.steps / max) * 70);
            return (
              <g key={x.key}>
                <rect x={6 + i * 30} y={84 - h} width="18" height={h} rx="2" fill={x.steps >= d.stepGoal ? TINT : '#c7c7cc'} />
                <text x={15 + i * 30} y="95" textAnchor="middle" fontSize="8" fill="#8e8e93" fontFamily="-apple-system, Helvetica, Arial">
                  {x.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Section header="Personal Bests">
        <Row title="Longest Run" detail={longest ? fmtDist(longest.distance, units) : '—'} />
        <Row title="Fastest Pace" detail={fastest ? `${fmtPace(fastest.duration, fastest.distance, units)} /${units}` : '—'} />
        <Row title="Most Calories" detail={most ? `${num(most.calories)} cal` : '—'} />
      </Section>
      <Section header="Workout Totals">
        <Row title="Workouts" detail={num(d.workouts.length)} />
        <Row title="Distance" detail={fmtDist(totalDist, units, 1)} />
        <Row title="Calories" detail={num(totalCal)} />
      </Section>
      <Section header="Steps">
        {days.map((x, i) => (
          <Row
            key={x.key}
            title={i === 0 ? 'Today' : i === 1 ? 'Yesterday' : x.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            detail={num(x.steps)}
            chevron
            onClick={() => nav.push(sub(i === 0 ? 'Today' : x.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), <DayPage dayKeyStr={x.key} />))}
          />
        ))}
      </Section>
      {d.workouts.length > 0 && (
        <Section header="Workouts">
          {d.workouts.slice(0, 30).map((w) => (
            <Row
              key={w.id}
              icon={w.kind === 'run' ? <Glyph.run size={18} /> : <Glyph.walk size={18} />}
              title={fmtDist(w.distance, units)}
              subtitle={`${new Date(w.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${fmtDur(w.duration)} · ${num(w.calories)} cal`}
              chevron
              onClick={() => nav.push(sub(w.kind === 'run' ? 'Run' : 'Walk', <WorkoutDetail w={w} />))}
            />
          ))}
        </Section>
      )}
    </Page>
  );
}

function DayPage({ dayKeyStr }: { dayKeyStr: string }) {
  const d = useNanoData();
  const steps = d.steps[dayKeyStr] ?? 0;
  const meters = steps * strideM('walk', d.heightCm);
  const wos = d.workouts.filter((w) => dayKey(new Date(w.start)) === dayKeyStr);
  return (
    <Page grouped>
      <Section header="Steps">
        <Row title="Steps" detail={num(steps)} />
        <Row title="Distance" detail={fmtDist(meters, d.units)} />
        <Row title="Calories" detail={num(kcal('walk', meters, d.weightKg))} />
        <Row title="Goal" detail={steps >= d.stepGoal ? 'Reached' : `${Math.round((steps / d.stepGoal) * 100)}%`} />
      </Section>
      <Section header="Workouts">
        {wos.length ? wos.map((w) => <Row key={w.id} title={w.kind === 'run' ? 'Run' : 'Walk'} detail={`${fmtDist(w.distance, d.units)} · ${fmtDur(w.duration)}`} />) : <Row title="No Workouts" disabled />}
      </Section>
    </Page>
  );
}

function WorkoutDetail({ w }: { w: Workout }) {
  const units = useNanoData((s) => s.units);
  const nav = useNav();
  return (
    <Page grouped>
      <Section header={new Date(w.start).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}>
        <Row title="Workout" detail={w.goal === 'basic' ? 'Basic' : w.goal[0].toUpperCase() + w.goal.slice(1)} />
        <Row title="Time" detail={fmtDur(w.duration)} />
        <Row title="Distance" detail={fmtDist(w.distance, units)} />
        <Row title="Pace" detail={`${fmtPace(w.duration, w.distance, units)} /${units}`} />
        <Row title="Calories" detail={num(w.calories)} />
        <Row title="Steps" detail={num(w.steps)} />
      </Section>
      <Section>
        <Row
          title="Delete Workout"
          destructive
          center
          onClick={() =>
            nano.sheet([
              {
                label: 'Delete Workout',
                destructive: true,
                onSelect: () => {
                  useNanoData.getState().set(
                    'workouts',
                    useNanoData.getState().workouts.filter((x) => x.id !== w.id),
                  );
                  nav.pop();
                },
              },
            ])
          }
        />
      </Section>
    </Page>
  );
}
