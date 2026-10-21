/**
 * Look & feel: which model is on the stage, its colors/materials/engraving,
 * the backdrop, and the user's saved presets.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODEL_ID, getModel, MODELS } from '../../devices/registry';
import type { Appearance, DeviceModel } from '../../devices/types';
import { uid } from '../util/id';

export type Backdrop = 'studio' | 'light' | 'desk' | 'gradient' | 'aurora' | 'solid';

export interface Scene {
  backdrop: Backdrop;
  color1: string;
  color2: string;
  shadow: boolean;
  reflection: boolean;
  /** spin slowly when idle */
  autoRotate: boolean;
  /** tilt a few degrees towards the pointer */
  parallax: boolean;
}

export interface Preset {
  id: string;
  name: string;
  modelId: string;
  appearance: Appearance;
  scene?: Scene;
  createdAt: number;
}

interface CustomizeState {
  modelId: string;
  appearances: Record<string, Appearance>;
  scene: Scene;
  presets: Preset[];

  setModel(id: string): void;
  setColor(slot: string, color: string): void;
  setOption(key: string, value: string | number | boolean): void;
  setEngraving(lines: [string, string]): void;
  applyFinish(finishId: string): void;
  resetAppearance(): void;
  setScene(p: Partial<Scene>): void;

  savePreset(name: string, includeScene?: boolean): Preset;
  updatePreset(id: string): void;
  applyPreset(id: string): void;
  applyPresetObject(p: Omit<Preset, 'id' | 'createdAt'> & Partial<Preset>): void;
  renamePreset(id: string, name: string): void;
  deletePreset(id: string): void;
  importPresets(list: Preset[]): number;
}

export const DEFAULT_SCENE: Scene = {
  backdrop: 'studio',
  color1: '#2a2d34',
  color2: '#0d0e11',
  shadow: true,
  reflection: true,
  autoRotate: false,
  parallax: false,
};

export function defaultAppearance(model: DeviceModel, finishId?: string): Appearance {
  const f = model.finishes.find((x) => x.id === finishId) ?? model.finishes[0];
  const options: Record<string, string | number | boolean> = {};
  for (const o of model.options ?? []) {
    if (o.type === 'select') options[o.key] = o.choices[0].value;
    else if (o.type === 'toggle') options[o.key] = false;
    else options[o.key] = o.min;
  }
  return {
    colors: { ...f.colors },
    options: { ...options, ...(f.options ?? {}) },
    engraving: ['', ''],
    finishId: f.id,
  };
}

function initialAppearances(): Record<string, Appearance> {
  return Object.fromEntries(MODELS.map((m) => [m.id, defaultAppearance(m)]));
}

export const useCustomize = create<CustomizeState>()(
  persist(
    (set, get) => ({
      modelId: DEFAULT_MODEL_ID,
      appearances: initialAppearances(),
      scene: DEFAULT_SCENE,
      presets: [],

      setModel(id) {
        const m = getModel(id);
        const a = get().appearances;
        set({ modelId: m.id, appearances: a[m.id] ? a : { ...a, [m.id]: defaultAppearance(m) } });
      },

      setColor(slot, color) {
        const { modelId, appearances } = get();
        const cur = appearances[modelId] ?? defaultAppearance(getModel(modelId));
        set({ appearances: { ...appearances, [modelId]: { ...cur, colors: { ...cur.colors, [slot]: color }, finishId: undefined } } });
      },

      setOption(key, value) {
        const { modelId, appearances } = get();
        const cur = appearances[modelId] ?? defaultAppearance(getModel(modelId));
        set({ appearances: { ...appearances, [modelId]: { ...cur, options: { ...cur.options, [key]: value } } } });
      },

      setEngraving(lines) {
        const { modelId, appearances } = get();
        const cur = appearances[modelId] ?? defaultAppearance(getModel(modelId));
        set({ appearances: { ...appearances, [modelId]: { ...cur, engraving: [lines[0].slice(0, 28), lines[1].slice(0, 28)] } } });
      },

      applyFinish(finishId) {
        const { modelId, appearances } = get();
        const model = getModel(modelId);
        const cur = appearances[modelId] ?? defaultAppearance(model);
        const base = defaultAppearance(model, finishId);
        set({
          appearances: {
            ...appearances,
            // keep non-finish options (wallpaper, theme…) and the engraving
            [modelId]: { ...base, options: { ...cur.options, ...(model.finishes.find((f) => f.id === finishId)?.options ?? {}) }, engraving: cur.engraving },
          },
        });
      },

      resetAppearance() {
        const { modelId, appearances } = get();
        set({ appearances: { ...appearances, [modelId]: defaultAppearance(getModel(modelId)) } });
      },

      setScene(p) {
        set({ scene: { ...get().scene, ...p } });
      },

      savePreset(name, includeScene = true) {
        const { modelId, appearances, scene, presets } = get();
        const p: Preset = {
          id: uid('preset'),
          name: name.trim() || 'My iPod',
          modelId,
          appearance: structuredClone(appearances[modelId] ?? defaultAppearance(getModel(modelId))),
          scene: includeScene ? { ...scene } : undefined,
          createdAt: Date.now(),
        };
        set({ presets: [p, ...presets] });
        return p;
      },

      updatePreset(id) {
        const { modelId, appearances, scene, presets } = get();
        set({
          presets: presets.map((p) =>
            p.id === id ? { ...p, modelId, appearance: structuredClone(appearances[modelId]), scene: p.scene ? { ...scene } : undefined } : p,
          ),
        });
      },

      applyPreset(id) {
        const p = get().presets.find((x) => x.id === id);
        if (p) get().applyPresetObject(p);
      },

      applyPresetObject(p) {
        const model = getModel(p.modelId);
        const base = defaultAppearance(model);
        const a: Appearance = {
          colors: { ...base.colors, ...(p.appearance?.colors ?? {}) },
          options: { ...base.options, ...(p.appearance?.options ?? {}) },
          engraving: [p.appearance?.engraving?.[0] ?? '', p.appearance?.engraving?.[1] ?? ''],
          finishId: p.appearance?.finishId,
        };
        set({
          modelId: model.id,
          appearances: { ...get().appearances, [model.id]: a },
          ...(p.scene ? { scene: { ...DEFAULT_SCENE, ...p.scene } } : {}),
        });
      },

      renamePreset(id, name) {
        set({ presets: get().presets.map((p) => (p.id === id ? { ...p, name } : p)) });
      },

      deletePreset(id) {
        set({ presets: get().presets.filter((p) => p.id !== id) });
      },

      importPresets(list) {
        const valid = list.filter((p) => p && typeof p === 'object' && typeof p.modelId === 'string' && p.appearance);
        const fresh = valid.map((p) => ({ ...p, id: uid('preset'), createdAt: p.createdAt ?? Date.now(), name: p.name || 'Imported' }));
        set({ presets: [...fresh, ...get().presets] });
        return fresh.length;
      },
    }),
    {
      name: 'iport-customize-v1',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CustomizeState>;
        return {
          ...current,
          ...p,
          modelId: getModel(p.modelId).id,
          appearances: { ...current.appearances, ...(p.appearances ?? {}) },
          scene: { ...DEFAULT_SCENE, ...(p.scene ?? {}) },
        };
      },
    },
  ),
);

export function useAppearance(modelId?: string): Appearance {
  const id = useCustomize((s) => modelId ?? s.modelId);
  const a = useCustomize((s) => s.appearances[id]);
  return a ?? defaultAppearance(getModel(id));
}

// ------------------------------------------------------------ share links

/** Encode a preset into a URL-safe string for share links (#preset=…). */
export function encodePreset(p: Pick<Preset, 'name' | 'modelId' | 'appearance' | 'scene'>): string {
  const json = JSON.stringify({ n: p.name, m: p.modelId, a: p.appearance, s: p.scene });
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePreset(s: string): Omit<Preset, 'id' | 'createdAt'> | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const j = JSON.parse(new TextDecoder().decode(bytes));
    if (!j || typeof j.m !== 'string' || !j.a) return null;
    return { name: j.n ?? 'Shared iPod', modelId: j.m, appearance: j.a, scene: j.s };
  } catch {
    return null;
  }
}
