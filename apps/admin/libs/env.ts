export function requireEnv(key: keyof NodeJS.ProcessEnv): string {
  const rawValue = process.env[key];

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return rawValue;
}

export function optionalEnv(
  key: keyof NodeJS.ProcessEnv,
): string | undefined {
  const rawValue = process.env[key];

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }

  return rawValue;
}
