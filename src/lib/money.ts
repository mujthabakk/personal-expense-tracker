const LOCALES: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'en-AE',
};

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: number, currency = 'INR', language = 'en'): string {
  const amount = Number.isFinite(value) ? value : 0;
  const locale = language === 'hi' && currency === 'INR' ? 'hi-IN' : LOCALES[currency] ?? 'en-IN';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function formatSigned(type: 'expense' | 'income' | 'transfer', amount: number, currency = 'INR', language = 'en'): string {
  const formatted = formatMoney(Math.abs(amount), currency, language);
  if (type === 'expense') return `−${formatted}`;
  if (type === 'income') return `+${formatted}`;
  return formatted;
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(digits)}%`;
}

export function formatChange(current: number, previous: number): string {
  if (previous === 0 && current === 0) return '0%';
  if (previous === 0) return 'New';
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  const decimal = rest.join('').slice(0, 2);
  const normalized = decimal ? `${whole || '0'}.${decimal}` : whole;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}
