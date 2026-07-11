export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ProviderError extends Error {
  constructor(message, { cause, retryable = false } = {}) {
    super(message, { cause });
    this.name = "ProviderError";
    this.retryable = retryable;
  }
}

export class ToolError extends Error {
  constructor(message, { toolName } = {}) {
    super(message);
    this.name = "ToolError";
    this.toolName = toolName;
  }
}

export class LimitExceededError extends Error {
  constructor(message, { limit, current } = {}) {
    super(message);
    this.name = "LimitExceededError";
    this.limit = limit;
    this.current = current;
  }
}
