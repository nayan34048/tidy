export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercent(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function toSnakeCase(input: string): string {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s\-]+/g, '_')
    .replace(/[^\w_]/g, '')
    .toLowerCase();
}

export function truncate(s: string, max = 40): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
