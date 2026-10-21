import { useMemo, useRef, useState } from 'react';
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
import type { DeviceModel, OptionDef } from '../../devices/types';
import { useStage } from '../../shell/stageStore';
import { ModelThumb } from '../ModelPicker';
import { Panel } from '../Panel';
import { IconDownload, IconSave, IconShare, IconTrash, IconUpload } from '../icons';
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
        <div className="panel-tabs" role="tablist">
          {(
            [
              ['design', 'Design'],
              ['scene', 'Scene'],
              ['presets', 'Presets'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
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

      <div className="section" style={{ marginTop: 22 }}>
        <button className="btn" onClick={resetAppearance}>
          Reset {model.name} to default
        </button>
      </div>
    </>
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
