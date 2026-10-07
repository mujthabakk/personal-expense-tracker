const STORAGE_KEY = 'folio-gemini-key';

export function readAiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeAiKey(value: string): void {
  const next = value.trim();
  if (!next) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, next);
}
