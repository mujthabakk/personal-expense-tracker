export function chartColor(hex: string): string {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  if (!dark) return hex;
  const value = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return hex;
  const channels = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  const luminance = (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255;
  if (luminance >= 0.55) return hex;
  const lifted = channels.map((channel) => Math.round(channel + (255 - channel) * 0.5));
  return `#${lifted.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
