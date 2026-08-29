import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { h } from "./h.js";

/**
 * A genuine subset of vim, not a full emulation — docs/21 already scoped
 * this as "normal/insert-mode-style navigation within the existing
 * inline-render model, not a vim/htop-style full-screen takeover," and
 * this is that: two modes, a handful of navigation/edit commands, no
 * registers, no visual mode, no `.`-repeat, no counts (`3dd`). Enough to
 * feel like vim for basic line editing, not a reimplementation of it.
 *
 * Built directly on ink's `useInput` rather than `ink-text-input`
 * (which InputBox.js uses for the default, non-vim experience) because
 * TextInput manages its own internal cursor state with no way to
 * intercept keys for a second mode — modal editing needs this component
 * to own cursor position and character insertion/deletion itself.
 *
 * Enter always submits regardless of mode. This deviates from real vim
 * (where Enter in normal mode moves down a line, and there's no
 * universal "submit" concept), deliberately — this is a single-line chat
 * input, not a text editor, and "press Enter to send" is the one
 * behavior every user of this box already expects from every other chat
 * interface. Trading strict vim fidelity for that expectation is the
 * right call for a comfort feature layered onto a chat box, not a vim
 * clone.
 */
export function VimInputBox({ value, onChange, onSubmit, disabled }) {
  const [mode, setMode] = useState("insert");
  const [cursor, setCursor] = useState(value.length);
  // Only "dd" (delete whole line) needs any pending-key state — the
  // smallest useful multi-key command, and the one most worth having
  // given this is a single-line box where "delete line" and "clear
  // input" are the same action. A single boolean flag, not a general
  // pending-command state machine: building a real vim-style command
  // parser for one two-key sequence would be solving a problem this
  // minimal subset doesn't have yet.
  const [pendingD, setPendingD] = useState(false);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        onSubmit(value);
        return;
      }

      if (mode === "insert") {
        if (key.escape) {
          setMode("normal");
          setCursor((c) => Math.max(0, Math.min(c, Math.max(0, value.length - 1))));
          return;
        }
        if (key.backspace || key.delete) {
          if (cursor > 0) {
            onChange(value.slice(0, cursor - 1) + value.slice(cursor));
            setCursor((c) => c - 1);
          }
          return;
        }
        if (key.leftArrow) {
          setCursor((c) => Math.max(0, c - 1));
          return;
        }
        if (key.rightArrow) {
          setCursor((c) => Math.min(value.length, c + 1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          onChange(value.slice(0, cursor) + input + value.slice(cursor));
          setCursor((c) => c + input.length);
        }
        return;
      }

      // Normal mode.
      if (pendingD) {
        setPendingD(false);
        if (input === "d") {
          onChange("");
          setCursor(0);
        }
        return;
      }

      if (input === "i") {
        setMode("insert");
      } else if (input === "a") {
        setCursor((c) => Math.min(value.length, c + 1));
        setMode("insert");
      } else if (input === "I") {
        setCursor(0);
        setMode("insert");
      } else if (input === "A") {
        setCursor(value.length);
        setMode("insert");
      } else if (input === "h" || key.leftArrow) {
        setCursor((c) => Math.max(0, c - 1));
      } else if (input === "l" || key.rightArrow) {
        setCursor((c) => Math.min(Math.max(0, value.length - 1), c + 1));
      } else if (input === "0") {
        setCursor(0);
      } else if (input === "$") {
        setCursor(Math.max(0, value.length - 1));
      } else if (input === "x") {
        if (cursor < value.length) {
          onChange(value.slice(0, cursor) + value.slice(cursor + 1));
        }
      } else if (input === "d") {
        setPendingD(true);
      }
    },
    { isActive: !disabled }
  );

  const displayValue = value || "";
  const beforeCursor = displayValue.slice(0, cursor);
  const atCursor = displayValue[cursor] || " ";
  const afterCursor = displayValue.slice(cursor + 1);

  return h(
    Box,
    { flexDirection: "column" },
    h(
      Box,
      { borderStyle: "round", borderColor: "gray", paddingX: 1 },
      h(Text, { color: "gray" }, mode === "normal" ? "N " : "› "),
      disabled
        ? h(Text, { color: "gray", dimColor: true }, "working…")
        : h(
            Text,
            null,
            beforeCursor,
            h(Text, { inverse: true }, atCursor),
            afterCursor,
            displayValue.length === 0 ? h(Text, { color: "gray", dimColor: true }, "Type a message…") : null
          )
    ),
    !disabled
      ? h(
          Text,
          { color: "gray", dimColor: true },
          mode === "normal" ? "-- NORMAL --  i/a/I/A insert, hl 0$ move, x delete, dd clear" : "-- INSERT --  Esc for normal mode"
        )
      : null
  );
}
