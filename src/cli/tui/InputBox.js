import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { h } from "./h.js";
import { VimInputBox } from "./VimInputBox.js";

/**
 * `vimKeybindings` (config.vimKeybindings, docs/28) swaps the whole
 * rendering path to VimInputBox rather than layering vim-mode detection
 * onto this component — ink-text-input's TextInput has no way to
 * intercept keys for a second mode, so there's no smaller change than a
 * genuinely different component when the flag is on. Default (flag off)
 * renders byte-for-byte what this component always has, so the default
 * experience is provably unchanged for anyone not opting in.
 */
export function InputBox({ value, onChange, onSubmit, disabled, vimKeybindings = false }) {
  if (vimKeybindings) {
    return h(VimInputBox, { value, onChange, onSubmit, disabled });
  }

  return h(
    Box,
    { flexDirection: "column" },
    h(
      Box,
      { borderStyle: "round", borderColor: "gray", paddingX: 1 },
      h(Text, { color: "gray" }, "› "),
      disabled
        ? h(Text, { color: "gray", dimColor: true }, "working…")
        : h(TextInput, {
            value,
            onChange,
            onSubmit,
            placeholder: "Type a message, or Tab to switch model…",
          })
    )
  );
}
