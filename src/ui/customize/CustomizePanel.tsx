import { useEffect, useMemo, useRef, useState } from 'react';
import { SegTabs } from '../SegTabs';
import {
  DEFAULT_SCENE,
  defaultAppearance,
  encodePreset,
  useAppearance,
  useCustomize,
  type Backdrop,
  type Preset,
} from '../../core/customize/store';
import { getModel } from '../../devices/registry';
import type { CoverKind, Decal, DecalFont, DeviceModel, OptionDef } from '../../devices/types';
import { DECAL_FONTS, useDecalSelection } from '../../shell/decals/Decals';
import { useStage } from '../../shell/stageStore';
import { ModelThumb } from '../ModelPicker';
import { Panel } from '../Panel';
import { IconDownload, IconRedo, IconSave, IconShare, IconTrash, IconUndo, IconUpload } from '../icons';
import { redo, undo, useHistory } from '../../core/customize/history';
import { toast } from '../toast';
import { SHOWCASE_PRESETS } from './showcase';
import './customize.css';

type Tab = 'design' | 'scene' | 'presets';

const QUICK_COLORS = [
  '#f5f5f7', '#d6d7d9', '#9fa1a6', '#5c5e62', '#2b2c2e', '#0d0d0f',
  '#c3132f', '#f08a24', '#f0d03e', '#8bc540', '#2a87d3', '#8e62b8',
  '#ec9ab6', '#e5ccaf', '#3fb6a8', '#1f3a5f',
];

export default function CustomizePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('design');
  const modelId = useCustomize((s) => s.modelId);
  const model = getModel(modelId);
  return (
    <Panel
      title="Customize"
      side="right"
      onClose={onClose}
      tabs={
        <SegTabs
          items={[
            { id: 'design', label: 'Design' },
            { id: 'scene', label: 'Scene' },
            { id: 'presets', label: 'Presets' },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
    >
      {tab === 'design' && <DesignTab model={model} />}
      {tab === 'scene' && <SceneTab />}
      {tab === 'presets' && <PresetsTab />}
    </Panel>
  );
}

// ------------------------------------------------------------------ Design

function DesignTab({ model }: { model: DeviceModel }) {
  const a = useAppearance(model.id);
  const { applyFinish, setColor, setOption, setEngraving, resetAppearance } = useCustomize.getState();
  const finish = model.finishes.find((f) => f.id === a.finishId);

  return (
    <>
      <div className="cz-model">
        <ModelThumb model={model} color={finish?.swatch ?? Object.values(a.colors)[0]} size={46} />
        <div>
          <div className="cz-model-name">{model.name}</div>
          <div className="tiny">
            {model.generation} · {model.year}
          </div>
        </div>
        <UndoRedo />
      </div>

      <div className="section">
        <div className="section-title">
          Finish <span className="cz-finish-name">{finish ? finish.name : 'Custom'}</span>
        </div>
        <div className="swatches">
          {model.finishes.map((f) => (
            <button
              key={f.id}
              className={`swatch ${a.finishId === f.id ? 'on' : ''}`}
              style={{ background: f.swatch }}
              title={f.name}
              aria-label={f.name}
              onClick={() => applyFinish(f.id)}
            />
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Colors</div>
        {model.colorSlots.map((slot) => (
          <ColorRow key={slot.key} label={slot.label} value={a.colors[slot.key] ?? '#cccccc'} onChange={(c) => setColor(slot.key, c)} />
        ))}
      </div>

      {model.cover && <CoverSection model={model} />}

      {model.options && model.options.length > 0 && (
        <div className="section">
          <div className="section-title">Options</div>
          {model.options.map((o) => (
            <OptionRow key={o.key} def={o} value={a.options[o.key]} onChange={(v) => setOption(o.key, v)} />
          ))}
        </div>
      )}

      {model.engravable && (
        <div className="section">
          <div className="section-title">Engraving</div>
          <p className="tiny" style={{ marginTop: -2 }}>
            Up to two lines, engraved on the back — just like ordering from the Apple Store.
          </p>
          <div className="field">
            <input
              className="input cz-engrave"
              placeholder="Line 1"
              maxLength={28}
              value={a.engraving[0]}
              onChange={(e) => setEngraving([e.target.value, a.engraving[1]])}
            />
            <input
              className="input cz-engrave"
              placeholder="Line 2"
              maxLength={28}
              value={a.engraving[1]}
              onChange={(e) => setEngraving([a.engraving[0], e.target.value])}
            />
          </div>
          <button className="btn small" onClick={() => useStage.getState().back()}>
            Turn around to see it
          </button>
        </div>
      )}

      <DecalSection />

      <div className="section" style={{ marginTop: 22 }}>
        <button className="btn" onClick={resetAppearance}>
          Reset {model.name} to default
        </button>
      </div>
    </>
  );
}

function UndoRedo() {
  const canUndo = useHistory((s) => s.canUndo);
  const canRedo = useHistory((s) => s.canRedo);
  const mac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);
  return (
    <div className="cz-undo">
      <button className="icon-btn" onClick={undo} disabled={!canUndo} title={`Undo (${mac ? '⌘Z' : 'Ctrl+Z'})`} aria-label="Undo">
        <IconUndo />
      </button>
      <button className="icon-btn" onClick={redo} disabled={!canRedo} title={`Redo (${mac ? '⇧⌘Z' : 'Ctrl+Y'})`} aria-label="Redo">
        <IconRedo />
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ back decals

const STICKERS = ['🍎', '🌈', '⭐', '❤️', '😎', '🎧', '🎵', '⚡', '🌸', '🔥', '👾', '🐱', '🍕', '✌️', '🦄', '💿', '🌙', '🍀'];

/** A picture, shrunk to a sticker-sized image (data URL). */
async function stickerImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const webp = c.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png');
}

function DecalSection() {
  const decals = useAppearance().decals ?? [];
  const selected = useDecalSelection((s) => s.selected);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addDecal, updateDecal, removeDecal } = useCustomize.getState();
  const select = useDecalSelection.getState().select;
  const [side, setSide] = useState<'back' | 'front'>('back');
  const turnTo = (s: 'back' | 'front') => (s === 'front' ? useStage.getState().front() : useStage.getState().back());
  // decals can be moved while this is on screen; locked again once it goes
  useEffect(() => {
    useDecalSelection.getState().setEditing(true);
    return () => useDecalSelection.getState().setEditing(false);
  }, []);

  const add = (d: Omit<Decal, 'id'>) => {
    const id = addDecal(d);
    if (!id) {
      toast('That’s as many as fit');
      return;
    }
    select(id);
    turnTo(d.side ?? 'back');
  };
  const jitter = () => (Math.random() - 0.5) * 0.16;
  const addSticker = (emoji?: string, image?: string) =>
    add({ kind: 'sticker', side, emoji, image, x: 0.5 + jitter(), y: 0.42 + jitter(), size: 0.28, rotate: Math.round((Math.random() - 0.5) * 24) });

  return (
    <div className="section">
      <div className="section-title">Stickers &amp; engraving</div>
      <p className="tiny" style={{ marginTop: -2 }}>
        Put them anywhere: drag them on the iPod. To resize and turn one, pinch it, drag its corner handle, or scroll over it (Shift
        to turn). They stay put once you close Customize.
      </p>
      <SegTabs
        className="cz-seg"
        items={[
          { id: 'back', label: 'Stick on the back' },
          { id: 'front', label: 'On the front' },
        ]}
        value={side}
        onChange={(s) => {
          setSide(s);
          turnTo(s);
        }}
      />
      <div className="cz-stickers">
        {STICKERS.map((e) => (
          <button key={e} className="cz-sticker" onClick={() => addSticker(e)} aria-label={`Add ${e} sticker`}>
            {e}
          </button>
        ))}
        <button className="cz-sticker cz-sticker-upload" onClick={() => fileRef.current?.click()} title="Your own picture" aria-label="Add your own picture">
          <IconUpload />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              addSticker(undefined, await stickerImage(f));
            } catch {
              toast('Couldn’t read that picture');
            }
          }}
        />
      </div>
      <button
        className="btn small"
        style={{ marginTop: 10 }}
        onClick={() => add({ kind: 'text', side: 'back', text: 'Hello', font: 'helvetica', x: 0.5, y: 0.62, size: 0.07, rotate: 0 })}
      >
        Add engraved text (back)
      </button>
      {decals.length > 0 && (
        <div className="cz-decals">
          {decals.map((d) => (
            <div key={d.id} className={`cz-decal ${d.id === selected ? 'on' : ''}`} onPointerDown={() => select(d.id)}>
              <div className="cz-decal-head">
                <span className="cz-decal-thumb">{d.kind === 'text' ? 'Aa' : d.image ? <img src={d.image} alt="" /> : d.emoji}</span>
                {d.kind === 'text' ? (
                  <input
                    className="input cz-decal-text"
                    value={d.text ?? ''}
                    maxLength={40}
                    placeholder="Text"
                    onChange={(e) => updateDecal(d.id, { text: e.target.value })}
                    aria-label="Engraved text"
                  />
                ) : (
                  <>
                    <span className="cz-decal-name">{d.image ? 'Your picture' : 'Sticker'}</span>
                    <button
                      className="btn small cz-decal-side"
                      onClick={() => {
                        const to = d.side === 'front' ? 'back' : 'front';
                        updateDecal(d.id, { side: to });
                        turnTo(to);
                      }}
                      title={d.side === 'front' ? 'Move it to the back' : 'Move it to the front'}
                    >
                      {d.side === 'front' ? 'Front' : 'Back'}
                    </button>
                  </>
                )}
                <button className="icon-btn" onClick={() => removeDecal(d.id)} title="Remove" aria-label="Remove">
                  <IconTrash />
                </button>
              </div>
              {d.kind === 'text' && (
                <select className="select" value={d.font ?? 'helvetica'} onChange={(e) => updateDecal(d.id, { font: e.target.value as DecalFont })} aria-label="Font">
                  {Object.entries(DECAL_FONTS).map(([k, f]) => (
                    <option key={k} value={k}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
              <label className="cz-decal-row">
                <span>Size</span>
                <input
                  type="range"
                  min={d.kind === 'text' ? 0.03 : 0.08}
                  max={d.kind === 'text' ? 0.2 : 0.8}
                  step={0.005}
                  value={d.size}
                  onChange={(e) => updateDecal(d.id, { size: Number(e.target.value) })}
                />
              </label>
              <label className="cz-decal-row">
                <span>Turn</span>
                <input type="range" min={-180} max={180} step={1} value={d.rotate} onChange={(e) => updateDecal(d.id, { rotate: Number(e.target.value) })} />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Colors each kind of cover came in. */
const COVER_COLORS: Record<Exclude<CoverKind, 'none'>, { name: string; color: string }[]> = {
  silicone: [
    { name: 'Black', color: '#1f1f21' },
    { name: 'White', color: '#f1f1ef' },
    { name: 'Midnight Blue', color: '#2b3a57' },
    { name: 'Pink Sand', color: '#e6c3b7' },
    { name: 'Red', color: '#c3132f' },
    { name: 'Mint', color: '#b4dbc4' },
    { name: 'Lavender', color: '#b7a5d6' },
    { name: 'Yellow', color: '#f1d24a' },
  ],
  clear: [
    { name: 'Clear', color: '#f4f6f8' },
    { name: 'Smoke', color: '#3a3b3f' },
    { name: 'Ice Blue', color: '#8fc8f2' },
    { name: 'Rose', color: '#f2a7bd' },
  ],
  leather: [
    { name: 'Saddle Brown', color: '#8a5a34' },
    { name: 'Tan', color: '#be8a57' },
    { name: 'Black', color: '#262324' },
    { name: 'Midnight', color: '#27324a' },
    { name: 'Oxblood', color: '#5c1f25' },
  ],
  // the six in the 2004 iPod Socks box
  sock: [
    { name: 'Grey', color: '#8e9196' },
    { name: 'Purple', color: '#7a57a5' },
    { name: 'Blue', color: '#3a7fc4' },
    { name: 'Green', color: '#6eb14b' },
    { name: 'Orange', color: '#ee8936' },
    { name: 'Pink', color: '#eb8fb2' },
  ],
};

function CoverSection({ model }: { model: DeviceModel }) {
  const a = useAppearance(model.id);
  const setCover = useCustomize((s) => s.setCover);
  const cases = !!model.cover?.cases;
  const kind: CoverKind = a.cover?.kind ?? 'none';
  const current = kind === 'none' || (kind !== 'sock' && !cases) ? 'none' : kind;
  const items = [
    { id: 'none' as const, label: 'None' },
    ...(cases
      ? [
          { id: 'silicone' as const, label: 'Silicone' },
          { id: 'leather' as const, label: 'Leather' },
          { id: 'clear' as const, label: 'Clear' },
        ]
      : []),
    { id: 'sock' as const, label: 'Socks' },
  ];
  const palette = current === 'none' ? [] : COVER_COLORS[current];
  const color = a.cover?.color ?? '#888888';
  const named = palette.find((c) => c.color === color.toLowerCase());
  return (
    <div className="section">
      <div className="section-title">
        {cases ? 'Case' : 'Accessory'} {current !== 'none' && <span className="cz-finish-name">{named ? named.name : 'Custom'}</span>}
      </div>
      <SegTabs
        className="cz-seg"
        items={items}
        value={current}
        onChange={(k) => setCover({ kind: k, color: k === 'none' ? color : COVER_COLORS[k][0].color })}
      />
      {current !== 'none' && (
        <div className="swatches cz-cover-colors">
          {palette.map((c) => (
            <button
              key={c.color}
              className={`swatch ${color.toLowerCase() === c.color ? 'on' : ''}`}
              style={{ background: c.color }}
              title={c.name}
              aria-label={c.name}
              onClick={() => setCover({ kind: current, color: c.color })}
            />
          ))}
          <input type="color" className="color-input" value={toHex(color)} onChange={(e) => setCover({ kind: current, color: e.target.value })} aria-label="Custom color" title="Custom color" />
        </div>
      )}
      {current === 'sock' && (
        <p className="tiny" style={{ marginTop: 8 }}>
          Apple’s knitted socks from 2004. The buttons still work through the fabric.
        </p>
      )}
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const hex = toHex(value);
  return (
    <div className="cz-color">
      <div className="color-row">
        <span className="label">{label}</span>
        <button className="cz-chip" style={{ background: value }} onClick={() => setOpen(!open)} aria-label={`${label} presets`} />
        <input type="color" className="color-input" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      </div>
      {open && (
        <div className="cz-quick">
          {QUICK_COLORS.map((c) => (
            <button key={c} className={`swatch small ${hex.toLowerCase() === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function OptionRow({ def, value, onChange }: { def: OptionDef; value: unknown; onChange: (v: string | number | boolean) => void }) {
  if (def.type === 'toggle')
    return (
      <div className="color-row">
        <span className="label">{def.label}</span>
        <button className={`switch ${value ? 'on' : ''}`} onClick={() => onChange(!value)} role="switch" aria-checked={!!value} aria-label={def.label} />
      </div>
    );
  if (def.type === 'range')
    return (
      <div className="field">
        <label>{def.label}</label>
        <input type="range" min={def.min} max={def.max} step={def.step} value={Number(value ?? def.min)} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    );
  return (
    <div className="field">
      <label>{def.label}</label>
      <select className="select" value={String(value ?? def.choices[0].value)} onChange={(e) => onChange(e.target.value)}>
        {def.choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function toHex(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map((x) => x + x).join('');
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  return '#cccccc';
}

// ------------------------------------------------------------------ Scene

const BACKDROPS: { id: Backdrop; name: string; preview: string; colors: 0 | 1 | 2 }[] = [
  { id: 'white', name: 'White', preview: '#ffffff', colors: 0 },
  { id: 'studio', name: 'Studio', preview: 'radial-gradient(circle at 50% 35%, #2a2d34, #0d0e11)', colors: 2 },
  { id: 'light', name: 'Light', preview: 'radial-gradient(circle at 50% 30%, #fff, #cfd1d6)', colors: 0 },
  { id: 'desk', name: 'Desk', preview: 'linear-gradient(180deg, #6b4a32, #2b1d13)', colors: 0 },
  { id: 'aurora', name: 'Aurora', preview: 'linear-gradient(120deg, #0b1026, #1a0b2e 40%, #04202a)', colors: 0 },
  { id: 'gradient', name: 'Gradient', preview: 'linear-gradient(160deg, #ff7e5f, #6a5cff)', colors: 2 },
  { id: 'solid', name: 'Solid', preview: '#3b3f46', colors: 1 },
];

function SceneTab() {
  const scene = useCustomize((s) => s.scene);
  const setScene = useCustomize((s) => s.setScene);
  const current = BACKDROPS.find((b) => b.id === scene.backdrop);
  return (
    <>
      <div className="section">
        <div className="section-title">Backdrop</div>
        <div className="cz-backdrops">
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              className={`cz-backdrop ${scene.backdrop === b.id ? 'on' : ''}`}
              onClick={() => {
                const patch: Partial<typeof scene> = { backdrop: b.id };
                if (b.id === 'gradient' && scene.backdrop !== 'gradient') Object.assign(patch, { color1: '#ff7e5f', color2: '#6a5cff' });
                if (b.id === 'studio' && scene.backdrop !== 'studio') Object.assign(patch, { color1: DEFAULT_SCENE.color1, color2: DEFAULT_SCENE.color2 });
                if (b.id === 'solid' && scene.backdrop !== 'solid') Object.assign(patch, { color1: '#3b3f46' });
                setScene(patch);
              }}
            >
              <span className="cz-backdrop-prev" style={{ background: b.preview }} />
              <span>{b.name}</span>
            </button>
          ))}
        </div>
        {current && current.colors > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="color-row">
              <span className="label">{current.colors === 1 ? 'Color' : 'Color 1'}</span>
              <input type="color" className="color-input" value={toHex(scene.color1)} onChange={(e) => setScene({ color1: e.target.value })} />
            </div>
            {current.colors === 2 && (
              <div className="color-row">
                <span className="label">Color 2</span>
                <input type="color" className="color-input" value={toHex(scene.color2)} onChange={(e) => setScene({ color2: e.target.value })} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="section">
        <div className="section-title">Motion & light</div>
        <Toggle label="Floor shadow" value={scene.shadow} onChange={(v) => setScene({ shadow: v })} />
        <Toggle label="Spin slowly when idle" value={scene.autoRotate} onChange={(v) => setScene({ autoRotate: v })} />
        <Toggle label="Tilt towards the pointer" value={scene.parallax} onChange={(v) => setScene({ parallax: v })} />
        <Toggle label="EarPods plug in when music plays" value={scene.earpods !== false} onChange={(v) => setScene({ earpods: v })} />
      </div>
      <div className="section">
        <div className="section-title">View</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn small" onClick={() => useStage.getState().front()}>
            Front
          </button>
          <button className="btn small" onClick={() => useStage.getState().back()}>
            Back
          </button>
          <button className="btn small" onClick={() => useStage.getState().view(-18, -35)}>
            Hero angle
          </button>
          <button className="btn small" onClick={() => useStage.getState().view(70, 0)}>
            Top
          </button>
          <button className="btn small" onClick={() => useStage.getState().view(-70, 0)}>
            Bottom
          </button>
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>
          Drag the background to spin the iPod. Hold Shift (or right-drag) to spin while over its controls. Double-click empty space to face front.
        </p>
      </div>
    </>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="color-row">
      <span className="label">{label}</span>
      <button className={`switch ${value ? 'on' : ''}`} onClick={() => onChange(!value)} role="switch" aria-checked={value} aria-label={label} />
    </div>
  );
}

// ------------------------------------------------------------------ Presets

function PresetsTab() {
  const presets = useCustomize((s) => s.presets);
  const modelId = useCustomize((s) => s.modelId);
  const [name, setName] = useState('');
  const [withScene, setWithScene] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = useCustomize.getState;

  const save = () => {
    const p = st().savePreset(name || `My ${getModel(modelId).name}`, withScene);
    setName('');
    toast(`Saved preset “${p.name}”`);
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ app: 'iport', version: 1, presets }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'iport-presets.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const importFile = async (f: File) => {
    try {
      const j = JSON.parse(await f.text());
      const list: Preset[] = Array.isArray(j) ? j : Array.isArray(j.presets) ? j.presets : [j];
      const n = st().importPresets(list);
      toast(n ? `Imported ${n} preset${n > 1 ? 's' : ''}` : 'No presets found in that file');
    } catch {
      toast('That file is not an iPort preset file');
    }
  };

  const share = async (p: Pick<Preset, 'name' | 'modelId' | 'appearance' | 'scene'>) => {
    const url = `${location.origin}${location.pathname}#preset=${encodePreset(p)}`;
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: `My iPod: ${p.name}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Share link copied to clipboard');
    } catch {
      prompt('Copy this link:', url);
    }
  };

  const shareCurrent = () => {
    const s = st();
    void share({ name: `My ${getModel(s.modelId).name}`, modelId: s.modelId, appearance: s.appearances[s.modelId] ?? defaultAppearance(getModel(s.modelId)), scene: s.scene });
  };

  return (
    <>
      <div className="section">
        <div className="section-title">Save current design</div>
        <div className="row">
          <input
            className="input"
            placeholder={`My ${getModel(modelId).name}`}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <button className="btn primary" onClick={save}>
            <IconSave /> Save
          </button>
        </div>
        <label className="cz-check">
          <input type="checkbox" checked={withScene} onChange={(e) => setWithScene(e.target.checked)} /> Include backdrop & scene
        </label>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <button className="btn small" onClick={shareCurrent}>
            <IconShare /> Share current
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-title">My presets {presets.length > 0 && <span className="tiny">({presets.length})</span>}</div>
        {presets.length === 0 ? (
          <p className="muted">No presets yet. Design an iPod, then save it here — presets remember the model, colors, options, engraving and scene.</p>
        ) : (
          <div className="list">
            {presets.map((p) => (
              <PresetRow
                key={p.id}
                preset={p}
                editing={editing === p.id}
                onEdit={() => setEditing(editing === p.id ? null : p.id)}
                onShare={() => share(p)}
              />
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={exportAll} disabled={!presets.length}>
            <IconDownload /> Export all
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            <IconUpload /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Showcase</div>
        <div className="cz-showcase">
          {SHOWCASE_PRESETS.map((p) => (
            <ShowcaseCard key={p.name} preset={p} />
          ))}
        </div>
      </div>
    </>
  );
}

function presetSwatch(p: Pick<Preset, 'modelId' | 'appearance'>): string {
  const m = getModel(p.modelId);
  const f = m.finishes.find((x) => x.id === p.appearance.finishId);
  return f?.swatch ?? p.appearance.colors[m.colorSlots[0]?.key] ?? '#999';
}

function PresetRow({ preset, editing, onEdit, onShare }: { preset: Preset; editing: boolean; onEdit: () => void; onShare: () => void }) {
  const m = getModel(preset.modelId);
  const [name, setName] = useState(preset.name);
  const st = useCustomize.getState;
  return (
    <div className="list-item cz-preset">
      <button className="cz-preset-main" onClick={() => (st().applyPreset(preset.id), toast(`Applied “${preset.name}”`))} title="Apply">
        <span className="cz-preset-thumb">
          <ModelThumb model={m} color={presetSwatch(preset)} size={34} />
        </span>
        <span className="li-text">
          {editing ? (
            <input
              className="input"
              autoFocus
              value={name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  st().renamePreset(preset.id, name.trim() || preset.name);
                  onEdit();
                }
              }}
              onBlur={() => {
                st().renamePreset(preset.id, name.trim() || preset.name);
              }}
              style={{ height: 30 }}
            />
          ) : (
            <span className="li-title">{preset.name}</span>
          )}
          <span className="li-sub">
            {m.name} · {preset.appearance.engraving.filter(Boolean).join(' / ') || new Date(preset.createdAt).toLocaleDateString()}
          </span>
        </span>
      </button>
      <div className="cz-preset-actions">
        <button className="btn small" onClick={onEdit} title="Rename">
          {editing ? 'Done' : 'Rename'}
        </button>
        <button
          className="btn small"
          onClick={() => {
            if (useCustomize.getState().modelId !== preset.modelId && !confirm(`Overwrite “${preset.name}” with the current ${getModel(useCustomize.getState().modelId).name} design?`)) return;
            st().updatePreset(preset.id);
            toast(`Updated “${preset.name}”`);
          }}
          title="Overwrite with current design"
        >
          Update
        </button>
        <button className="btn small" onClick={onShare} title="Copy share link">
          <IconShare />
        </button>
        <button
          className="btn small danger"
          onClick={() => {
            if (confirm(`Delete preset “${preset.name}”?`)) st().deletePreset(preset.id);
          }}
          title="Delete"
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

function ShowcaseCard({ preset }: { preset: Omit<Preset, 'id' | 'createdAt'> }) {
  const m = getModel(preset.modelId);
  const bg = useMemo(() => {
    const s = preset.scene;
    if (!s) return '#f5f5f7';
    if (s.backdrop === 'gradient') return `linear-gradient(160deg, ${s.color1}, ${s.color2})`;
    if (s.backdrop === 'solid') return s.color1;
    return BACKDROPS.find((b) => b.id === s.backdrop)?.preview ?? '#f5f5f7';
  }, [preset.scene]);
  return (
    <button className="cz-show" onClick={() => (useCustomize.getState().applyPresetObject(preset), toast(`Applied “${preset.name}”`))}>
      <span className="cz-show-prev" style={{ background: bg }}>
        <ModelThumb model={m} color={presetSwatch(preset)} size={48} />
      </span>
      <span className="cz-show-name">{preset.name}</span>
      <span className="tiny">{m.name}</span>
    </button>
  );
}
