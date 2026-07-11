export class ToolRegistry {
  constructor(tools = []) {
    this._tools = new Map();
    for (const tool of tools) this.register(tool);
  }

  register(tool) {
    if (!tool.name || typeof tool.execute !== "function") {
      throw new Error(`Invalid tool registration: ${JSON.stringify(tool.name)}`);
    }
    this._tools.set(tool.name, tool);
  }

  get(name) {
    return this._tools.get(name);
  }

  has(name) {
    return this._tools.has(name);
  }

  list() {
    return Array.from(this._tools.values());
  }

  /** Schemas in the exact shape a Provider Layer adapter expects (doc 05 / doc 06). */
  schemas() {
    return this.list().map(({ name, description, input_schema }) => ({
      name,
      description,
      input_schema,
    }));
  }
}
