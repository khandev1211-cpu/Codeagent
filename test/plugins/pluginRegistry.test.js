import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { discoverPlugins, PluginRegistry } from "../../src/plugins/pluginRegistry.js";
import { installPlugin } from "../../src/plugins/pluginManager.js";

describe("Plugin Registry & Manager", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeagent-plugin-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array if no plugins installed", () => {
    const registry = new PluginRegistry({ cwd: tmpDir });
    expect(registry.listPlugins()).toEqual([]);
  });

  it("installs local plugin directory into .codeagent/plugins/", () => {
    const srcPluginDir = path.join(tmpDir, "my-plugin");
    fs.mkdirSync(srcPluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcPluginDir, "codeagent-plugin.json"),
      JSON.stringify({ name: "my-plugin", version: "1.0.0", description: "Test plugin" })
    );

    const targetProject = path.join(tmpDir, "project");
    fs.mkdirSync(targetProject, { recursive: true });

    const result = installPlugin(srcPluginDir, { cwd: targetProject });
    expect(result.name).toBe("my-plugin");
    expect(fs.existsSync(result.targetPath)).toBe(true);

    const registry = new PluginRegistry({ cwd: targetProject });
    const installed = registry.listPlugins();
    expect(installed).toHaveLength(1);
    expect(installed[0].name).toBe("my-plugin");
    expect(installed[0].version).toBe("1.0.0");
  });
});
