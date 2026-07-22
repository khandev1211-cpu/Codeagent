import fs from "fs";
import path from "path";

/**
 * Installs a plugin from a local directory source into .codeagent/plugins/
 * 
 * @param {string} sourcePath - Absolute or relative path to the plugin directory
 * @param {{ cwd: string }} options 
 * @returns {{ name: string, targetPath: string }}
 */
export function installPlugin(sourcePath, { cwd }) {
  const absSource = path.resolve(cwd, sourcePath);

  if (!fs.existsSync(absSource) || !fs.statSync(absSource).isDirectory()) {
    throw new Error(`Plugin source directory does not exist: ${sourcePath}`);
  }

  let manifestPath = path.join(absSource, "codeagent-plugin.json");
  if (!fs.existsSync(manifestPath)) {
    manifestPath = path.join(absSource, "plugin.json");
  }

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No codeagent-plugin.json or plugin.json manifest found in ${sourcePath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const pluginName = manifest.name || path.basename(absSource);

  const targetDir = path.join(cwd, ".codeagent", "plugins", pluginName);
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy directory contents recursively
  fs.cpSync(absSource, targetDir, { recursive: true });

  return { name: pluginName, targetPath: targetDir };
}
