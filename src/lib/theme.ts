import type { ThemeMode } from '@/models/types';

export function applyTheme(theme: ThemeMode) {
  localStorage.setItem('folio-theme', theme);
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function applyLanguage(language: string) {
  document.documentElement.lang = language === 'hi' ? 'hi' : 'en';
}
