import type { SiteSettings } from './types';

export const APPEARANCE_STORAGE_KEY = 'mellow-appearance';
export const DEFAULT_READING_SIZE = 19;

type AppearanceDefaults = Pick<SiteSettings, 'colorMode' | 'background' | 'layout'>;
export type Appearance = {
  mode: SiteSettings['colorMode'];
  background: string;
  layout: SiteSettings['layout'];
  fontSize: number;
};
export type AppearanceOverrides = Partial<Appearance>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isBackgroundUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value)) return false;
  if (value === '' || /^\/(?!\/)/.test(value)) return true;
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validOverrides(value: Record<string, unknown>): AppearanceOverrides {
  const result: AppearanceOverrides = {};
  if (value.mode === 'light' || value.mode === 'dark' || value.mode === 'system') result.mode = value.mode;
  if (isBackgroundUrl(value.background)) result.background = value.background;
  if (value.layout === 'magazine' || value.layout === 'compact') result.layout = value.layout;
  if (typeof value.fontSize === 'number' && Number.isFinite(value.fontSize) && value.fontSize >= 15 && value.fontSize <= 24) result.fontSize = value.fontSize;
  return result;
}

export function readAppearance(raw: string | null, defaults: AppearanceDefaults): AppearanceOverrides {
  if (!raw) return {};
  try {
    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved)) return {};
    if (saved.version === 3) return isRecord(saved.overrides) ? validOverrides(saved.overrides) : {};
    if (saved.version != null && saved.version !== 1 && saved.version !== 2) return {};

    // Previous versions saved a complete snapshot, including automatic defaults.
    // An empty legacy background must not hide a newly configured site image.
    const overrides = validOverrides(saved);
    if (!overrides.background || overrides.background === defaults.background) delete overrides.background;
    if (overrides.mode === defaults.colorMode) delete overrides.mode;
    if (overrides.layout === defaults.layout) delete overrides.layout;
    if ((saved.version == null || saved.version === 1) && overrides.fontSize === 17) overrides.fontSize = DEFAULT_READING_SIZE;
    if (overrides.fontSize === DEFAULT_READING_SIZE) delete overrides.fontSize;
    return overrides;
  } catch {
    return {};
  }
}

export function resolveAppearance(overrides: AppearanceOverrides, defaults: AppearanceDefaults): Appearance {
  return {
    mode: overrides.mode ?? defaults.colorMode ?? 'light',
    background: overrides.background ?? defaults.background ?? '',
    layout: overrides.layout ?? defaults.layout ?? 'magazine',
    fontSize: overrides.fontSize ?? DEFAULT_READING_SIZE,
  };
}

export function resetAppearance(overrides: AppearanceOverrides, key?: keyof Appearance): AppearanceOverrides {
  if (!key) return {};
  const next = { ...overrides };
  delete next[key];
  return next;
}

export function serializeAppearance(overrides: AppearanceOverrides): string {
  return JSON.stringify({ version: 3, overrides });
}
