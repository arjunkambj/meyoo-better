/**
 * Minimal, Edge-safe logger for testing/dev only.
 * Prints structured messages via console.* without Node-only APIs.
 * Replace with Axiom or a full logger in production.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  [key: string]: unknown;
}

export interface ILogger {
  debug(message: string, data?: LogContext): void;
  info(message: string, data?: LogContext): void;
  warn(message: string, data?: LogContext): void;
  error(message: string, error?: Error | unknown, data?: LogContext): void;
  success(message: string, data?: LogContext): void;
}

export class Logger implements ILogger {
  private static logLevel: LogLevel = LogLevel.INFO;
  constructor(private context: string) {}

  static setLogLevel(level: LogLevel): void {
    Logger.logLevel = level;
  }

  private shouldLog(level: LogLevel) {
    return level >= Logger.logLevel;
  }

  private base(message: string, data?: LogContext) {
    return {
      ts: new Date().toISOString(),
      ctx: this.context,
      msg: message,
      ...(data ? { data } : {}),
    };
  }

  debug(message: string, data?: LogContext): void {
    // Keep debug light to avoid noise in production builds
    if (this.shouldLog(LogLevel.DEBUG)) console.debug(this.base(message, data));
  }
  info(message: string, data?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) console.info(this.base(message, data));
  }
  warn(message: string, data?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) console.warn(this.base(message, data));
  }
  error(message: string, error?: Error | unknown, data?: LogContext): void {
    const errInfo =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error
          ? { message: String(error) }
          : undefined;
    if (this.shouldLog(LogLevel.ERROR))
      console.error(
        this.base(message, { ...data, ...(errInfo ? { error: errInfo } : {}) }),
      );
  }
  success(message: string, data?: LogContext): void {
    console.info(this.base(`Success: ${message}`, data));
  }
}

const loggers = new Map<string, Logger>();

export function getLogger(context: string): Logger {
  if (!loggers.has(context)) {
    loggers.set(context, new Logger(context));
  }
  return loggers.get(context) as Logger;
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}

export const defaultLogger = createLogger("App");

export const LoggerFactory = {
  getLogger,
  createLogger,
  loggers,
};

// Backward-compatibility type for code importing it
export interface LogEntry {
  ts: string;
  ctx: string;
  msg: string;
  data?: LogContext;
  error?: { message?: string; stack?: string };
}
