// Small helpers for Shopify data normalization

export const gid = (id: string | null | undefined, kind: string) => {
  if (!id) return '';
  return String(id).replace(`gid://shopify/${kind}/`, '');
};

export const toMs = (iso: string | number | null | undefined): number | undefined => {
  if (iso === null || iso === undefined) return undefined;
  if (typeof iso === 'number') return iso;
  const t = Date.parse(String(iso));
  return isNaN(t) ? undefined : t;
};

export const toNum = (x: unknown): number => {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return x;
  const n = parseFloat(String(x));
  return isNaN(n) ? 0 : n;
};

export const toMoney = (x: unknown): number => toNum(x);

export const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const strings = value
    .map((entry) => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }

      if (typeof entry === 'number') {
        return String(entry);
      }

      return undefined;
    })
    .filter((entry): entry is string => entry !== undefined);

  return strings.length > 0 ? strings : [];
};
