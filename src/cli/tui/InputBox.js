import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { h } from "./h.js";

export function InputBox({ value, onChange, onSubmit, disabled }) {
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
