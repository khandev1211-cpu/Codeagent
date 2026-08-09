import { useState, useRef, useMemo } from "react";
import { Box, useInput, useApp } from "ink";
import { h } from "./h.js";
import { StatusHeader } from "./StatusHeader.js";
import { SessionLog } from "./SessionLog.js";
import { InputBox } from "./InputBox.js";
import { ModelSwitcher } from "./ModelSwitcher.js";
import { Orchestrator } from "../../agent/orchestrator.js";
import { ContextManager, buildProjectContext } from "../../agent/context.js";
import { buildSystemPrompt } from "../../agent/systemPrompt.js";
import { planTurn, shouldPlan } from "../../agent/planner.js";
import { createConfirmer } from "../../safety/confirm.js";
import { getProvider } from "../../providers/index.js";
import { LimitExceededError } from "../../utils/errors.js";

/**
 * The Ink-based interactive session — the rich-TUI counterpart to
 * repl.js's plain-readline loop (docs/21). Every piece of turn-running
 * logic here (build system prompt, call runTurn, sync the diff tracker,
 * save the session) deliberately mirrors repl.js's sequence exactly, so
 * the two front ends stay behaviorally identical — this file changes how
 * the session looks, not what it does.
 */
export function App({
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
  skillRegistry,
  projectContext,
  configuredProviders = {},
}) {
  const { exit } = useApp();
  const [entries, setEntries] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [activeConfig, setActiveConfig] = useState({ provider: config.provider, model: config.model });
  const [planMode, setPlanMode] = useState(Boolean(config.planMode));

  const confirm = useMemo(() => createConfirmer({ config, logger }), []);
  const contextManagerRef = useRef(new ContextManager({ provider }));
  const orchestratorRef = useRef(
    new Orchestrator({
      provider,
      toolRegistry,
      confirm,
      config,
      logger,
      contextManager: contextManagerRef.current,
      diffTracker,
      hookRegistry,
      permissionRules,
    })
  );

  function appendEntry(entry) {
    setEntries((prev) => [...prev, entry]);
  }

  // Tab, not Ctrl+K as originally designed (docs/21's design discussion) —
  // Ink's useInput has no event-consumption/priority mechanism, so every
  // active useInput hook receives every keystroke, including the one
  // InputBox's TextInput uses internally. TextInput doesn't special-case
  // Ctrl+K (confirmed by reading ink-text-input's source), so it would
  // append the literal "k" to the text field on the very same keystroke
  // that opens the switcher — reproduced with a real PTY, not hypothetical.
  // Tab is one of a small set of keys (arrows, Ctrl+C, Tab, Shift+Tab)
  // ink-text-input unconditionally ignores regardless of focus state, so
  // it can never leak into typed text this way.
  useInput(
    (input, key) => {
      if (key.tab) {
        setSwitcherOpen(true);
        return;
      }
      if (key.ctrl && input === "c") {
        exit();
      }
    },
    { isActive: !switcherOpen && !working }
  );

  const switcherOptions = useMemo(() => {
    return Object.entries(configuredProviders).flatMap(([name, entry]) => [
      {
        provider: name,
        model: entry.model || "(default)",
        priceLabel: entry.model ? "" : "",
        isFree: name !== "anthropic",
        isCurrent: name === activeConfig.provider && (entry.model || "(default)") === activeConfig.model,
        apiKeyEnvVar: entry.apiKeyEnvVar,
        useKeychain: entry.useKeychain,
      },
    ]);
  }, [configuredProviders, activeConfig]);

  function handleSwitcherSelect(option) {
    setSwitcherOpen(false);
    const nextConfig = {
      ...config,
      provider: option.provider,
      model: option.model,
      apiKeyEnvVar: option.apiKeyEnvVar,
    };
    let newProvider;
    try {
      newProvider = getProvider(nextConfig, { logger });
    } catch (err) {
      appendEntry({ type: "assistant_text", text: `Could not switch provider: ${err.message}` });
      return;
    }
    orchestratorRef.current.setProvider(newProvider, { providerName: option.provider, model: option.model });
    setActiveConfig({ provider: option.provider, model: option.model });
    appendEntry({ type: "assistant_text", text: `Switched to ${option.provider} (${option.model}). History carries over.` });
  }

  async function handleSubmit(text) {
    const trimmed = text.trim();
    setInputValue("");
    if (!trimmed) return;

    appendEntry({ type: "user_message", text: trimmed });
    setWorking(true);

    try {
      let plannerOutput = null;
      if (shouldPlan({ config, userRequest: trimmed })) {
        plannerOutput = await planTurn({ provider: orchestratorRef.current.provider, userRequest: trimmed });
        if (plannerOutput) appendEntry({ type: "assistant_text", text: `Plan:\n${plannerOutput}` });
      }

      const system = buildSystemPrompt({
        projectContext,
        plannerOutput,
        customAddendum: config.customSystemPromptAddendum,
        adminPrompt: config.adminSystemPrompt,
        skillsIndex: skillRegistry.formatIndexForPrompt(),
      });

      const result = await orchestratorRef.current.runTurn({
        messages: session.messages,
        userInput: trimmed,
        system,
        cwd,
        onEvent: (event) => {
          if (event.type === "tool_call") {
            appendEntry({ type: "tool_call", tool: event.tool, detail: summarizeInput(event.input) });
          }
          if (event.type === "tool_declined") {
            appendEntry({ type: "tool_call", tool: event.tool, status: "declined", detail: event.reason });
          }
          if (event.type === "tool_blocked") {
            appendEntry({ type: "tool_call", tool: event.tool, status: "declined", detail: `hook: ${event.reason}` });
          }
          if (event.type === "tool_denied") {
            appendEntry({ type: "tool_call", tool: event.tool, status: "denied", detail: `rule: ${event.rule.pattern}` });
          }
          if (event.type === "tool_planned") {
            appendEntry({ type: "tool_call", tool: event.tool, status: "planned", detail: event.description });
          }
          if (event.type === "final_text") {
            appendEntry({ type: "assistant_text", text: event.text });
          }
          if (event.type === "tool_error") {
            appendEntry({ type: "assistant_text", text: `${event.tool}: ${event.error.message}` });
          }
        },
      });

      session.messages = result.history;
      sessionStore.syncDiffTracker(session, diffTracker);
      await sessionStore.save(session);
    } catch (err) {
      if (err instanceof LimitExceededError) {
        appendEntry({ type: "assistant_text", text: err.message });
        await sessionStore.save(session);
      } else {
        appendEntry({ type: "assistant_text", text: err.message });
      }
    } finally {
      setWorking(false);
    }
  }

  return h(
    Box,
    { flexDirection: "column", padding: 1 },
    h(StatusHeader, {
      model: activeConfig.model,
      provider: activeConfig.provider,
      planMode,
      skillsCount: skillRegistry.list().length,
      rulesCount: permissionRules.length,
      cwd,
    }),
    switcherOpen
      ? h(ModelSwitcher, {
          options: switcherOptions,
          onSelect: handleSwitcherSelect,
          onCancel: () => setSwitcherOpen(false),
        })
      : h(
          Box,
          { flexDirection: "column" },
          h(SessionLog, { entries }),
          h(InputBox, { value: inputValue, onChange: setInputValue, onSubmit: handleSubmit, disabled: working })
        )
  );
}

function summarizeInput(input) {
  if (!input) return "";
  if (input.command) return input.command;
  if (input.path) return input.path;
  if (input.query) return input.query;
  return "";
}
