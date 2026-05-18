/* eslint-disable @typescript-eslint/no-explicit-any */

// Shared logger utility.
// Uses pino from config/logger; falls back to console in test environments.

interface LoggerInterface {
  error: (obj: object) => void;
  warn: (obj: object) => void;
  info: (obj: object) => void;
  debug: () => void;
}

let logger: LoggerInterface;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../config/logger') as { logger: LoggerInterface };
  logger = mod.logger;
} catch {
  // Fallback for environments without pino (e.g., tests)
  logger = {
    error: (obj: object) => console.error((obj as { msg?: unknown })?.msg ?? obj),
    warn: (obj: object) => console.warn((obj as { msg?: unknown })?.msg ?? obj),
    info: (obj: object) => console.log((obj as { msg?: unknown })?.msg ?? obj),
    debug: () => {},
  };
}

export default logger;
