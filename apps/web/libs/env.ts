const clientEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_INSTALL_URI: process.env.NEXT_PUBLIC_APP_INSTALL_URI,
  NEXT_PUBLIC_META_API_VERSION: process.env.NEXT_PUBLIC_META_API_VERSION,
};

function readEnv(key: keyof NodeJS.ProcessEnv): string | undefined {
  return clientEnv[key] ?? process.env[key];
}

export function requireEnv(key: keyof NodeJS.ProcessEnv): string {
  const rawValue = readEnv(key);

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return rawValue;
}

export function optionalEnv(key: keyof NodeJS.ProcessEnv): string | undefined {
  const rawValue = readEnv(key);

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }

  return rawValue;
}
