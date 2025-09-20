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
  const log = (level: LogLevel, message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    const logEntry: Record<string, unknown> = {
      timestamp,
      level,
      context,
      message,
      ...(data && typeof data === "object" ? { data } : {}),
    };

    // In Convex, console.log is the only reliable output
    console.log(JSON.stringify(logEntry));
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
