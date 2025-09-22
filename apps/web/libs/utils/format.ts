export function formatCurrency(
  amount: number,
  currency: string = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

// Currency symbols mapping for quick access
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", // US Dollar
  EUR: "€", // Euro
  GBP: "£", // British Pound
  JPY: "¥", // Japanese Yen
  CNY: "¥", // Chinese Yuan (same symbol as JPY)
  AUD: "A$", // Australian Dollar
  CAD: "C$", // Canadian Dollar
  CHF: "CHF", // Swiss Franc
  HKD: "HK$", // Hong Kong Dollar
  SGD: "S$", // Singapore Dollar
  SEK: "kr", // Swedish Krona
  NOK: "kr", // Norwegian Krone
  NZD: "NZ$", // New Zealand Dollar
  KRW: "₩", // South Korean Won
  MXN: "$", // Mexican Peso
  INR: "₹", // Indian Rupee
  RUB: "₽", // Russian Ruble
  BRL: "R$", // Brazilian Real
  ZAR: "R", // South African Rand
  TRY: "₺", // Turkish Lira
  AED: "د.إ", // UAE Dirham
  SAR: "﷼", // Saudi Riyal
  PLN: "zł", // Polish Złoty
  THB: "฿", // Thai Baht
  DKK: "kr", // Danish Krone
};

export function getCurrencySymbol(currency: string): string {
  // First check our predefined symbols
  if (CURRENCY_SYMBOLS[currency]) {
    return CURRENCY_SYMBOLS[currency];
  }

  // Fallback to Intl.NumberFormat for other currencies
  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    // Format 0 to get just the symbol
    const formatted = formatter.format(0);

    // Remove the number part to get just the symbol
    return formatted.replace(/[\d.,\s]/g, "").trim();
  } catch (_error) {
    // Return currency code if symbol extraction fails
    return currency;
  }
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale: string = "en-US",
): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}

// Compact number formatter (e.g., 1.2K, 3.4M)
export function formatCompactNumber(
  value: number,
  maximumFractionDigits: number = 1,
): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits,
  }).format(value);
}

// Compact currency with symbol kept simple (e.g., $1.2K)
export function formatCurrencyCompact(
  amount: number,
  currency: string = "USD",
  maximumFractionDigits: number = 1,
): string {
  const symbol = getCurrencySymbol(currency);
  const compact = formatCompactNumber(amount, maximumFractionDigits);
  // Normalize to lowercase "k" for thousands for visual consistency
  const normalized = compact.replace("K", "k");
  return `${symbol}${normalized}`;
}

export function formatPercent(
  value: number,
  maximumFractionDigits: number = 1,
): string {
  return `${value.toFixed(maximumFractionDigits)}%`;
}
