import { render } from "ink";
import { h } from "./h.js";
import { App } from "./App.js";
import { buildProjectContext } from "../../agent/context.js";
import { loadMemory, formatMemoryForPrompt } from "../../agent/memory.js";
import { SkillRegistry, wireSkillsIndex } from "../../skills/index.js";
import { SubagentRegistry, wireSubagentsIndex } from "../../agent/subagentRegistry.js";
import { listConfiguredProviders } from "../../config/loader.js";

/**
 * The rich-TUI counterpart to repl.js's startRepl — same parameters, same
 * responsibility (run an interactive session against a resumed/new
 * session), different rendering technology underneath (docs/21). Callers
 * (cli/index.js) choose between this and startRepl based on whether
 * stdout/stdin are a real TTY — Ink cannot render meaningfully otherwise.
 */
export async function startTui({
  provider,
  toolRegistry,
  config,
  logger,
  session,
  sessionStore,
  diffTracker,
  cwd,
  hookRegistry,
  permissionRules = [],
}) {
  const projectContext = await buildProjectContext(cwd);
  const memory = formatMemoryForPrompt(await loadMemory({ cwd }));
  const skillRegistry = new SkillRegistry({ cwd, logger });
  const { skillsIndexMode } = wireSkillsIndex({ skillRegistry, toolRegistry, config });
  const subagentRegistry = new SubagentRegistry({ cwd, logger });
  wireSubagentsIndex({ subagentRegistry, toolRegistry });
  const configuredProviders = listConfiguredProviders({});

  const instance = render(
    h(App, {
      provider,
      toolRegistry,
      config,
      logger,
      session,
      sessionStore,
      diffTracker,
      cwd,
      hookRegistry,
      permissionRules,
      skillRegistry,
      skillsIndexMode,
      subagentRegistry,
      projectContext,
      memory,
      configuredProviders,
    })
  );

  await instance.waitUntilExit();
}
