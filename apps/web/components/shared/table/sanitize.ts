export function sanitizeDecimal(val: string): string {
  if (val === undefined || val === null) return "";
  if (val === "") return "";
  const cleaned = String(val).replace(/[^0-9.]/g, "");
  if (cleaned === ".") return "0.";
  const parts = cleaned.split(".");
  const head = parts.shift() || "";
  const result = head + (parts.length > 0 ? "." + parts.join("") : "");
  return result;
}

