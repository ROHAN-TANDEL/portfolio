import themesData from '../../data/themes.json';
import { loadFromStorage, saveToStorage } from './helpers';

export const DEFAULT_THEMES = themesData;
export const STORAGE_KEY = 'flashlearn_active_theme';

export function getStoredThemeId() {
  return loadFromStorage(STORAGE_KEY, 'violet');
}

export function applyThemeToDom(theme) {
  if (typeof document === 'undefined' || !theme) return;
  const root = document.documentElement;
  const c = theme.colors || theme;

  // 1. Granular Nexora hierarchy (1 to 10)
  if (c.primary) root.style.setProperty('--nx-primary', c.primary);
  if (c.secondary) root.style.setProperty('--nx-secondary', c.secondary);
  if (c.third) root.style.setProperty('--nx-third', c.third);
  if (c.fourth) root.style.setProperty('--nx-fourth', c.fourth);
  if (c.fifth) root.style.setProperty('--nx-fifth', c.fifth);
  if (c.sixth) root.style.setProperty('--nx-sixth', c.sixth);
  if (c.seventh) root.style.setProperty('--nx-seventh', c.seventh);
  if (c.eighth) root.style.setProperty('--nx-eighth', c.eighth);
  if (c.ninth) root.style.setProperty('--nx-ninth', c.ninth);
  if (c.tenth) root.style.setProperty('--nx-tenth', c.tenth);

  // 2. Semantic Nexora tokens
  if (c.primary_hover) root.style.setProperty('--nx-primary-hover', c.primary_hover);
  if (c.primary_subtle) root.style.setProperty('--nx-primary-subtle', c.primary_subtle);
  if (c.primary_border) root.style.setProperty('--nx-primary-border', c.primary_border);
  if (c.primary_active) root.style.setProperty('--nx-primary-active', c.primary_active);
  if (c.accent || c.primary) root.style.setProperty('--nx-accent', c.accent || c.primary);
  if (c.text_primary) root.style.setProperty('--nx-text-primary', c.text_primary);
  if (c.text_secondary) root.style.setProperty('--nx-text-secondary', c.text_secondary);
  if (c.bg_app) root.style.setProperty('--nx-bg-app', c.bg_app);
  if (c.bg_surface) root.style.setProperty('--nx-bg-surface', c.bg_surface);

  // 3. General theme tokens for components and Tailwind utilities
  root.style.setProperty('--theme-primary', c.primary);
  root.style.setProperty('--theme-primary-hover', c.primary_hover || c.secondary || c.primary);
  root.style.setProperty('--theme-primary-subtle', c.primary_subtle || c.eighth || '#F8FAFC');
  root.style.setProperty('--theme-primary-border', c.primary_border || c.sixth || c.primary);
  root.style.setProperty('--theme-primary-active', c.primary_active || c.ninth || c.primary);
  root.style.setProperty('--theme-primary-text', c.primary);
  root.style.setProperty('--theme-accent', c.accent || c.primary);

  // 4. Adaptive Dark Mode tokens
  root.style.setProperty('--theme-primary-dark-subtle', c.tenth ? `${c.tenth}33` : 'rgba(255,255,255,0.08)');
  root.style.setProperty('--theme-primary-dark-border', c.ninth ? `${c.ninth}80` : 'rgba(255,255,255,0.2)');
  root.style.setProperty('--theme-primary-dark-text', c.fourth || c.fifth || '#A5B4FC');
}

export async function fetchThemes() {
  try {
    const res = await fetch('/data/themes.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not fetch /data/themes.json, using bundled presets:', err);
  }
  return DEFAULT_THEMES;
}
