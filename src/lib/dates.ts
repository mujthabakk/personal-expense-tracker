export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function localDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return toISODate(date);
}

export function localMonth(iso: string): string {
  return localDay(iso).slice(0, 7);
}

export function monthKey(value: string | Date): string {
  if (value instanceof Date) return toISODate(value).slice(0, 7);
  return localMonth(value);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return monthKey(date);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseISODate(toIso).getTime() - parseISODate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function combineDate(date: string, now = new Date()): string {
  if (date === toISODate(now)) return now.toISOString();
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

export function formatMonth(month: string, language = 'en'): string {
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(parseISODate(`${month}-01`));
}

export function formatDay(iso: string, language = 'en', today = new Date()): string {
  const day = iso.slice(0, 10);
  const todayKey = toISODate(today);
  const yesterdayKey = toISODate(addDays(today, -1));
  if (day === todayKey) return language === 'hi' ? 'आज' : 'Today';
  if (day === yesterdayKey) return language === 'hi' ? 'कल' : 'Yesterday';
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseISODate(day));
}

export function formatTime(iso: string, language = 'en'): string {
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatShortDate(iso: string, language = 'en'): string {
  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(parseISODate(iso));
}

export function monthsRemaining(targetDate: string, today = new Date()): number {
  const end = parseISODate(targetDate);
  if (end.getTime() < startOfDay(today).getTime()) return 0;
  const whole = (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth());
  if (whole <= 0) return 1;
  return whole;
}

export function rangesOverlap(start: string, end: string, month: string): boolean {
  if (!start || !end) return false;
  const monthStart = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const monthEnd = `${month}-${String(last).padStart(2, '0')}`;
  return start <= monthEnd && end >= monthStart;
}
