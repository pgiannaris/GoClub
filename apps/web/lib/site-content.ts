export type BlockType =
  | 'hero'
  | 'text'
  | 'image'
  | 'features'
  | 'announcements'
  | 'events'
  | 'members'
  | 'polls'
  | 'attendance'
  | 'tasks';

export type Block = {
  id: string;
  type: BlockType;
  content?: any;
  settings?: any;
};

export type PageBlocks = Block[];

export type SiteAccentPreset = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
export type SiteAccent = string;
export type SiteSurface = 'paper' | 'glass' | 'tint';
export type SiteRadius = 'soft' | 'rounded' | 'sharp';
export type HeroAlign = 'center' | 'left';
export type PageBackground = 'canvas' | 'tint' | 'spotlight';
export type PageSpacing = 'compact' | 'comfortable' | 'airy';

export type SiteSettings = {
  accent: SiteAccent;
  surface: SiteSurface;
  radius: SiteRadius;
  heroAlign: HeroAlign;
};

export type PageSettings = {
  background: PageBackground;
  spacing: PageSpacing;
  showPageHeader: boolean;
  intro: string;
};

export type SiteContent = {
  pages: Record<string, PageBlocks>;
  siteSettings?: Partial<SiteSettings>;
  pageSettings?: Record<string, Partial<PageSettings>>;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  accent: '#4189e2',
  surface: 'paper',
  radius: 'rounded',
  heroAlign: 'center',
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  background: 'canvas',
  spacing: 'comfortable',
  showPageHeader: false,
  intro: '',
};

export const SITE_ACCENT_OPTIONS: {
  value: SiteAccentPreset;
  label: string;
  color: string;
}[] = [
  { value: 'blue', label: 'Blue', color: '#4189e2' },
  { value: 'emerald', label: 'Emerald', color: '#059669' },
  { value: 'amber', label: 'Amber', color: '#d97706' },
  { value: 'rose', label: 'Rose', color: '#e11d48' },
  { value: 'slate', label: 'Slate', color: '#475569' },
];

export const SITE_SURFACE_OPTIONS: { value: SiteSurface; label: string }[] = [
  { value: 'paper', label: 'Paper' },
  { value: 'glass', label: 'Glass' },
  { value: 'tint', label: 'Tint' },
];

export const SITE_RADIUS_OPTIONS: { value: SiteRadius; label: string }[] = [
  { value: 'soft', label: 'Soft' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'sharp', label: 'Sharp' },
];

export const HERO_ALIGN_OPTIONS: { value: HeroAlign; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'left', label: 'Left' },
];

export const PAGE_BACKGROUND_OPTIONS: {
  value: PageBackground;
  label: string;
}[] = [
  { value: 'canvas', label: 'Canvas' },
  { value: 'tint', label: 'Tint' },
  { value: 'spotlight', label: 'Spotlight' },
];

export const PAGE_SPACING_OPTIONS: { value: PageSpacing; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'airy', label: 'Airy' },
];

const ACCENT_THEME: Record<
  SiteAccentPreset,
  {
    accent: string;
    accentSoft: string;
    accentMuted: string;
    accentText: string;
    accentRing: string;
  }
> = {
  blue: {
    accent: '#4189e2',
    accentSoft: '#e7f1ff',
    accentMuted: 'rgba(65, 137, 226, 0.12)',
    accentText: '#2f6fbd',
    accentRing: 'rgba(65, 137, 226, 0.22)',
  },
  emerald: {
    accent: '#059669',
    accentSoft: '#d1fae5',
    accentMuted: 'rgba(5, 150, 105, 0.12)',
    accentText: '#047857',
    accentRing: 'rgba(5, 150, 105, 0.24)',
  },
  amber: {
    accent: '#d97706',
    accentSoft: '#fef3c7',
    accentMuted: 'rgba(217, 119, 6, 0.14)',
    accentText: '#b45309',
    accentRing: 'rgba(217, 119, 6, 0.25)',
  },
  rose: {
    accent: '#e11d48',
    accentSoft: '#ffe4e6',
    accentMuted: 'rgba(225, 29, 72, 0.12)',
    accentText: '#be123c',
    accentRing: 'rgba(225, 29, 72, 0.24)',
  },
  slate: {
    accent: '#475569',
    accentSoft: '#e2e8f0',
    accentMuted: 'rgba(71, 85, 105, 0.12)',
    accentText: '#334155',
    accentRing: 'rgba(71, 85, 105, 0.24)',
  },
};

const RADIUS_MAP: Record<SiteRadius, string> = {
  soft: '12px',
  rounded: '18px',
  sharp: '8px',
};

const PAGE_BACKGROUNDS: Record<PageBackground, string> = {
  canvas: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 42%, #f8fafc 100%)',
  tint: 'linear-gradient(180deg, rgba(241,245,249,1) 0%, rgba(248,250,252,1) 48%, rgba(255,255,255,1) 100%)',
  spotlight:
    'radial-gradient(circle at top, rgba(148,163,184,0.18), transparent 34%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
};

const PAGE_SPACING: Record<PageSpacing, { paddingY: string }> = {
  compact: { paddingY: '3.5rem' },
  comfortable: { paddingY: '4.75rem' },
  airy: { paddingY: '6rem' },
};

function sanitizeOption<T extends string>(
  value: string | undefined | null,
  allowed: readonly T[],
  fallback: T,
) {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

const PRESET_ACCENT_MAP = Object.fromEntries(
  SITE_ACCENT_OPTIONS.map((item) => [item.value, item.color]),
) as Record<SiteAccentPreset, string>;

function expandShortHex(hex: string) {
  return hex
    .slice(1)
    .split('')
    .map((char) => `${char}${char}`)
    .join('');
}

function parseHexColor(hex: string) {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  const value =
    normalized.length === 4
      ? expandShortHex(normalized)
      : normalized.length === 7
        ? normalized.slice(1)
        : null;

  if (!value || !/^[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function toHexColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

function mixHexColors(color: string, mixWith: string, weight: number) {
  const from = parseHexColor(color);
  const to = parseHexColor(mixWith);

  if (!from || !to) {
    return color;
  }

  return `#${toHexColor(from.r + (to.r - from.r) * weight)}${toHexColor(
    from.g + (to.g - from.g) * weight,
  )}${toHexColor(from.b + (to.b - from.b) * weight)}`;
}

function withAlpha(color: string, alpha: number) {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return `rgba(65, 137, 226, ${alpha})`;
  }

  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

function getRelativeLuminance(color: string) {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return 0.24;
  }

  const normalizeChannel = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const r = normalizeChannel(parsed.r);
  const g = normalizeChannel(parsed.g);
  const b = normalizeChannel(parsed.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function normalizeAccentColor(
  value: string | undefined | null,
  fallback = DEFAULT_SITE_SETTINGS.accent,
) {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed in PRESET_ACCENT_MAP) {
    return PRESET_ACCENT_MAP[trimmed as SiteAccentPreset];
  }

  const parsed = parseHexColor(trimmed);
  if (!parsed) {
    return fallback;
  }

  return `#${toHexColor(parsed.r)}${toHexColor(parsed.g)}${toHexColor(parsed.b)}`;
}

export function resolveSiteSettings(
  input?: Partial<SiteSettings> | null,
): SiteSettings {
  return {
    accent: normalizeAccentColor(input?.accent, DEFAULT_SITE_SETTINGS.accent),
    surface: sanitizeOption(
      input?.surface,
      SITE_SURFACE_OPTIONS.map((item) => item.value),
      DEFAULT_SITE_SETTINGS.surface,
    ),
    radius: sanitizeOption(
      input?.radius,
      SITE_RADIUS_OPTIONS.map((item) => item.value),
      DEFAULT_SITE_SETTINGS.radius,
    ),
    heroAlign: sanitizeOption(
      input?.heroAlign,
      HERO_ALIGN_OPTIONS.map((item) => item.value),
      DEFAULT_SITE_SETTINGS.heroAlign,
    ),
  };
}

export function resolvePageSettings(
  input?: Partial<PageSettings> | null,
): PageSettings {
  return {
    background: sanitizeOption(
      input?.background,
      PAGE_BACKGROUND_OPTIONS.map((item) => item.value),
      DEFAULT_PAGE_SETTINGS.background,
    ),
    spacing: sanitizeOption(
      input?.spacing,
      PAGE_SPACING_OPTIONS.map((item) => item.value),
      DEFAULT_PAGE_SETTINGS.spacing,
    ),
    showPageHeader: Boolean(input?.showPageHeader),
    intro: typeof input?.intro === 'string' ? input.intro : '',
  };
}

export function resolvePageSettingsMap(
  pages: Record<string, PageBlocks>,
  settings?: Record<string, Partial<PageSettings>> | null,
) {
  const next: Record<string, PageSettings> = {};

  Object.keys(pages).forEach((pageId) => {
    next[pageId] = resolvePageSettings(settings?.[pageId]);
  });

  return next;
}

export function getSiteTheme(
  siteSettings: SiteSettings,
  pageSettings: PageSettings,
  options?: {
    isDark?: boolean;
  },
) {
  const isDark = options?.isDark ?? false;
  const accent = normalizeAccentColor(siteSettings.accent);
  const presetAccent = SITE_ACCENT_OPTIONS.find(
    (option) => option.color === accent,
  );
  const accentTheme = presetAccent
    ? ACCENT_THEME[presetAccent.value]
    : {
        accent,
        accentSoft: mixHexColors(accent, '#ffffff', 0.88),
        accentMuted: withAlpha(accent, 0.12),
        accentText: mixHexColors(
          accent,
          '#0f172a',
          getRelativeLuminance(accent) > 0.42 ? 0.52 : 0.22,
        ),
        accentRing: withAlpha(accent, 0.22),
      };
  const radius = RADIUS_MAP[siteSettings.radius];
  const pageBackground = isDark
    ? pageSettings.background === 'spotlight'
      ? `radial-gradient(circle at top, ${withAlpha(accent, 0.22)}, transparent 30%), linear-gradient(180deg, #020617 0%, #0f172a 100%)`
      : pageSettings.background === 'tint'
        ? 'linear-gradient(180deg, #0f172a 0%, #111827 45%, #020617 100%)'
        : 'linear-gradient(180deg, #020617 0%, #0f172a 42%, #020617 100%)'
    : PAGE_BACKGROUNDS[pageSettings.background];

  const surface = isDark
    ? siteSettings.surface === 'glass'
      ? 'rgba(15, 23, 42, 0.72)'
      : siteSettings.surface === 'tint'
        ? 'rgba(15, 23, 42, 0.96)'
        : '#111827'
    : siteSettings.surface === 'glass'
      ? 'rgba(255, 255, 255, 0.72)'
      : siteSettings.surface === 'tint'
        ? 'rgba(248, 250, 252, 0.96)'
        : '#ffffff';

  const border = isDark
    ? siteSettings.surface === 'glass'
      ? 'rgba(148, 163, 184, 0.18)'
      : siteSettings.surface === 'tint'
        ? 'rgba(51, 65, 85, 0.95)'
        : 'rgba(51, 65, 85, 1)'
    : siteSettings.surface === 'glass'
      ? 'rgba(148, 163, 184, 0.25)'
      : siteSettings.surface === 'tint'
        ? 'rgba(226, 232, 240, 0.9)'
        : 'rgba(226, 232, 240, 1)';

  return {
    ...accentTheme,
    radius,
    pageBackground,
    surface,
    border,
    text: isDark ? '#e5e7eb' : '#0f172a',
    mutedText: isDark ? '#94a3b8' : '#64748b',
    cardText: isDark ? '#f8fafc' : '#0f172a',
    footerBackground: isDark ? '#020617' : '#0f172a',
    footerText: '#f8fafc',
    footerMuted: isDark ? '#64748b' : '#94a3b8',
    navSurface: isDark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255,255,255,0.72)',
    navHover: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)',
    chipSurface: isDark ? 'rgba(30,41,59,1)' : 'rgba(241,245,249,1)',
    panelShadow: `0 22px 50px ${accentTheme.accentRing}`,
  };
}

export function getPageSpacingStyle(pageSettings: PageSettings) {
  const spacing = PAGE_SPACING[pageSettings.spacing];

  return {
    paddingTop: spacing.paddingY,
    paddingBottom: spacing.paddingY,
  };
}
