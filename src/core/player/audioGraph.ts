/**
 * Web Audio processing chain for media we are allowed to process
 * (local files and CORS-enabled streams):
 *
 *   <video> → preamp → 10-band EQ → Sound Check (compressor) → mono → analyser → out
 */
import { EQ_BANDS, EQ_PRESETS, preampFor } from './eq';

let ctx: AudioContext | null = null;
let preamp: GainNode;
let bands: BiquadFilterNode[] = [];
let compressor: DynamicsCompressorNode;
let makeup: GainNode;
/** Mono Audio: one channel, so both ears get the same sound */
let monoNode: GainNode;
let mono = false;
let analyser: AnalyserNode;
const connected = new WeakSet<HTMLMediaElement>();

let currentEq = 'Off';
let soundCheck = false;

function build(): AudioContext {
  ctx = new AudioContext({ latencyHint: 'playback' });
  preamp = ctx.createGain();
  bands = EQ_BANDS.map((f, i) => {
    const b = ctx!.createBiquadFilter();
    b.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
    b.frequency.value = f;
    b.Q.value = 1.1;
    b.gain.value = 0;
    return b;
  });
  compressor = ctx.createDynamicsCompressor();
  makeup = ctx.createGain();
  monoNode = ctx.createGain();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  let node: AudioNode = preamp;
  for (const b of bands) {
    node.connect(b);
    node = b;
  }
  node.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(monoNode);
  monoNode.connect(analyser);
  analyser.connect(ctx.destination);
  applyEq(currentEq);
  applySoundCheck(soundCheck);
  applyMono(mono);
  return ctx;
}

export function getAudioContext(): AudioContext {
  return ctx ?? build();
}

/** Route an element through the graph. Irreversible for that element. */
export function connectElement(el: HTMLMediaElement): void {
  if (connected.has(el)) return;
  const c = getAudioContext();
  const src = c.createMediaElementSource(el);
  src.connect(preamp);
  connected.add(el);
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

function applyEq(name: string) {
  if (!ctx) return;
  const gains = EQ_PRESETS[name] ?? EQ_PRESETS.Off;
  const t = ctx.currentTime;
  bands.forEach((b, i) => b.gain.setTargetAtTime(gains[i], t, 0.05));
  preamp.gain.setTargetAtTime(Math.pow(10, preampFor(gains) / 20), t, 0.05);
}

function applySoundCheck(on: boolean) {
  if (!ctx) return;
  // Sound Check approximation: gentle leveling + makeup gain.
  compressor.threshold.value = on ? -26 : 0;
  compressor.knee.value = on ? 12 : 0;
  compressor.ratio.value = on ? 3.5 : 1;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.4;
  makeup.gain.value = on ? 1.6 : 1;
}

export function setEq(name: string): void {
  currentEq = name;
  applyEq(name);
}

function applyMono(on: boolean) {
  if (!ctx) return;
  // mixed down to one channel here; the speakers' upmix sends it to both
  monoNode.channelCount = on ? 1 : 2;
  monoNode.channelCountMode = on ? 'explicit' : 'max';
  monoNode.channelInterpretation = 'speakers';
}

/** Mono Audio (an accessibility setting): the left and right channels mixed together. */
export function setMono(on: boolean): void {
  mono = on;
  applyMono(on);
}

export function setSoundCheck(on: boolean): void {
  soundCheck = on;
  applySoundCheck(on);
}

/** Frequency data for visualizers, or null when nothing is routed. */
export function getAnalyser(): AnalyserNode | null {
  return ctx ? analyser : null;
}
