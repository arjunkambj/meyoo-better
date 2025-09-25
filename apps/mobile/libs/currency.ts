export function getCurrencySymbol(code: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? "$";
  } catch (_error) {
    return "$";
  }
}

export function formatCurrency(
  value: number,
  code: string,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
) {
  if (Number.isNaN(value)) {
    return "–";
  }

  const { minimumFractionDigits = 0, maximumFractionDigits = minimumFractionDigits } =
    options ?? {};

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);
  } catch (_error) {
    const symbol = getCurrencySymbol(code);
    return `${symbol}${value.toFixed(maximumFractionDigits)}`;
  }
}

export function formatCurrencyChange(
  value: number | null | undefined,
  code: string,
  decimal = 0,
) {
  if (value === null || value === undefined) {
    return null;
  }

  return formatCurrency(value, code, {
    minimumFractionDigits: decimal,
    maximumFractionDigits: decimal,
  });
}
