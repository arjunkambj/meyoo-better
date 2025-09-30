const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  HKD: 'HK$',
  SGD: 'S$',
  SEK: 'kr',
  NOK: 'kr',
  NZD: 'NZ$',
  KRW: '₩',
  MXN: '$',
  INR: '₹',
  RUB: '₽',
  BRL: 'R$',
  ZAR: 'R',
  TRY: '₺',
  AED: 'د.إ',
  SAR: '﷼',
  PLN: 'zł',
  THB: '฿',
  DKK: 'kr',
};

export function getCurrencySymbol(currency: string): string {
  const upper = currency?.toUpperCase?.() ?? currency;
  if (upper && CURRENCY_SYMBOLS[upper]) {
    return CURRENCY_SYMBOLS[upper];
  }

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: upper,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const formatted = formatter.format(0);
    const symbol = formatted.replace(/[\d.,\s]/g, '').trim();
    return symbol || upper;
  } catch {
    return upper || '$';
  }
}

export function formatCompactCurrency(value: number, currency: string, maximumFractionDigits = 1): string {
  const symbol = getCurrencySymbol(currency);
  const compactValue = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);
  return `${symbol}${compactValue.replace('K', 'k')}`;
}

export function formatPercentage(value: number, maximumFractionDigits = 1): string {
  return `${value.toFixed(maximumFractionDigits)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
