import fs from "fs";
import path from "path";

/**
 * Discovers and parses installed plugins in .codeagent/plugins/<plugin-dir>/
 * 
 * @param {string} cwd 
 * @returns {Array<{ name: string, version: string, description: string, path: string, manifest: object }>}
 */
export function discoverPlugins(cwd) {
  const plugins = [];
  const pluginsDir = path.join(cwd, ".codeagent", "plugins");

  if (fs.existsSync(pluginsDir) && fs.statSync(pluginsDir).isDirectory()) {
    const entries = fs.readdirSync(pluginsDir);

    for (const entry of entries) {
      const pluginPath = path.join(pluginsDir, entry);
      if (!fs.statSync(pluginPath).isDirectory()) continue;

      let manifestPath = path.join(pluginPath, "codeagent-plugin.json");
      if (!fs.existsSync(manifestPath)) {
        manifestPath = path.join(pluginPath, "plugin.json");
      }

      if (fs.existsSync(manifestPath)) {
        try {
          const raw = fs.readFileSync(manifestPath, "utf8");
          const manifest = JSON.parse(raw);
          plugins.push({
            name: manifest.name || entry,
            version: manifest.version || "0.0.0",
            description: manifest.description || "",
            path: pluginPath,
            manifest,
          });
        } catch {
          // Ignore malformed plugin manifests
        }
      }
    }
  }

  return plugins;
}

export class PluginRegistry {
  constructor({ cwd, logger } = {}) {
    this.cwd = cwd || process.cwd();
    this.logger = logger;
  }

  listPlugins() {
    return discoverPlugins(this.cwd);
  }
}
