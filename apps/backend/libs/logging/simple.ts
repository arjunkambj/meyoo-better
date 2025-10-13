/**
 * Simple logging utility for Convex functions
 * No external dependencies, suitable for server-side Convex environment
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface SimpleLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown, data?: unknown): void;
}

/**
 * Create a simple logger for Convex functions
 */
export function createSimpleLogger(context: string): SimpleLogger {
  const MAX_MESSAGE_WORDS = 10;

  const shortenMessage = (input: string) => {
    if (!input) return input;
    const words = input.trim().split(/\s+/).filter(Boolean);
    if (words.length <= MAX_MESSAGE_WORDS) {
      return words.join(" ");
    }
    return words.slice(0, MAX_MESSAGE_WORDS).join(" ");
  };

  const formatTimestamp = () => {
    const iso = new Date().toISOString();
    return iso.slice(11);
  };

  const log = (level: LogLevel, message: string, data?: unknown) => {
    const timestamp = formatTimestamp();
    const logEntry: Record<string, unknown> = {
      timestamp,
      level,
      context,
      message: shortenMessage(message),
      ...(data && typeof data === "object" ? { data } : {}),
    };

    const serialized = JSON.stringify(logEntry);

    switch (level) {
      case "error":
        console.error(serialized);
        break;
      case "warn":
        console.warn(serialized);
        break;
      default:
        console.log(serialized);
        break;
    }
  };

  return {
    debug: (message: string, data?: unknown) => {
      if (process.env.NODE_ENV === "development") {
        log("debug", message, data);
      }
    },
    info: (message: string, data?: unknown) => {
      log("info", message, data);
    },
    warn: (message: string, data?: unknown) => {
      log("warn", message, data);
    },
    error: (message: string, error?: unknown, data?: unknown) => {
      const errorInfo =
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
            ? { message: String(error) }
            : undefined;

      const base =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : {};
      log("error", message, { ...base, error: errorInfo });
    },
  };
}

/**
 * Shortened logger for minimal overhead
 */
export function log(context: string) {
  const logger = createSimpleLogger(context);

  return {
    d: (message: string, data?: unknown) => logger.debug(message, data),
    i: (message: string, data?: unknown) => logger.info(message, data),
    w: (message: string, data?: unknown) => logger.warn(message, data),
    e: (message: string, error?: unknown, data?: unknown) =>
      logger.error(message, error, data),
  };
}
