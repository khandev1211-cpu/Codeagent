// Matches common LLM provider API key shapes (sk-ant-..., sk-..., Bearer tokens, etc.)
// so a key can never end up in log output even by accident.
const KEY_PATTERNS = [
  /sk-ant-[a-zA-Z0-9_-]{10,}/g,
  /sk-[a-zA-Z0-9_-]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]{15,}/g,
];

function redact(value) {
  if (typeof value === "string") {
    let out = value;
    for (const pattern of KEY_PATTERNS) {
      out = out.replace(pattern, "[REDACTED]");
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // Never log anything under a key-shaped field name, regardless of value.
      if (/api[_-]?key|authorization|secret/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

const LEVELS = ["debug", "info", "warn", "error"];

export function createLogger({ level = "info", sink = console } = {}) {
  const threshold = LEVELS.indexOf(level);

  function log(lvl, message, meta) {
    if (LEVELS.indexOf(lvl) < threshold) return;
    const safeMessage = redact(message);
    const safeMeta = meta !== undefined ? redact(meta) : undefined;
    const line = `[${new Date().toISOString()}] [${lvl.toUpperCase()}] ${safeMessage}`;
    const fn = sink[lvl] || sink.log;
    if (safeMeta !== undefined) {
      fn.call(sink, line, safeMeta);
    } else {
      fn.call(sink, line);
    }
  }

  return {
    debug: (msg, meta) => log("debug", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
  };
}

export const logger = createLogger();
