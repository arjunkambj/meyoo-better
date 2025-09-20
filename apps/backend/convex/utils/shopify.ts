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

