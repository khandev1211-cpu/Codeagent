/**
 * Every provider adapter implements this same shape (doc 06). The Agent Core
 * only ever calls send() / stream() / countTokens() — it never branches on
 * which provider is active.
 */
export class Provider {
  /**
   * Non-streaming call.
   * @returns {Promise<{content: Array<{type: 'text'|'tool_use', text?: string, id?: string, name?: string, input?: object}>, usage: {inputTokens: number, outputTokens: number}, stopReason: string}>}
   */
  async send(_messages, _tools, _opts) {
    throw new Error("not implemented");
  }

  /**
   * Streaming call. Yields chunks as they arrive, then returns the same
   * shape as send() once exhausted.
   */
  async *stream(_messages, _tools, _opts) {
    throw new Error("not implemented");
  }

  /** Estimate token count for a message list, for budget tracking (doc 04). */
  countTokens(_messages) {
    throw new Error("not implemented");
  }
}
