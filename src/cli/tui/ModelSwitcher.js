import { useState, useMemo, useRef, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { h } from "./h.js";

/**
 * `options` is an array of { provider, model, priceLabel, isFree, isCurrent }
 * — built by App.js from the real configured-providers map (docs/18), not
 * hardcoded. Filtering is a simple case-insensitive substring match against
 * "provider model", which is enough for a list in the tens, not hundreds,
 * of entries — this isn't trying to be a fuzzy-match command palette.
 */
export function ModelSwitcher({ options, onSelect, onCancel }) {
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // The index driving actual keyboard-handling logic — a ref, not the
  // `selectedIndex` state above. Real keystrokes (holding an arrow key,
  // fast typing) can arrive faster than React re-renders; if the handler
  // below read `selectedIndex` from its own render's closure, two
  // keypresses processed before the first's re-render commits would both
  // see the same stale index — a real bug this caught in testing, not a
  // hypothetical. A ref updates synchronously and is shared across every
  // call to the handler regardless of render timing, so it's the correct
  // source of truth for "what index does the next keystroke act on."
  // `selectedIndex` state exists purely to trigger a re-render so the
  // highlighted row visually updates; it always mirrors the ref.
  const indexRef = useRef(0);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => `${o.provider} ${o.model}`.toLowerCase().includes(needle));
  }, [filter, options]);

  // When the filter narrows/widens the list, reset to the top rather than
  // keeping a numeric index that may now point at something unrelated.
  // An effect (runs after commit), not a during-render mutation, so this
  // never races with the ref updates the input handler makes.
  useEffect(() => {
    indexRef.current = 0;
    setSelectedIndex(0);
  }, [filter]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      indexRef.current = Math.max(0, indexRef.current - 1);
      setSelectedIndex(indexRef.current);
      return;
    }
    if (key.downArrow) {
      indexRef.current = Math.min(Math.max(filtered.length - 1, 0), indexRef.current + 1);
      setSelectedIndex(indexRef.current);
      return;
    }
    if (key.return) {
      const chosen = filtered[indexRef.current];
      if (chosen) onSelect(chosen);
    }
  });

  return h(
    Box,
    { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, width: 60 },
    h(
      Box,
      null,
      h(Text, { color: "gray" }, "🔍 "),
      h(TextInput, { value: filter, onChange: setFilter, placeholder: "Switch model…" })
    ),
    h(Box, { borderStyle: "single", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false, borderColor: "gray", flexDirection: "column", marginTop: 1, paddingTop: 1 },
      filtered.length === 0
        ? h(Text, { color: "gray", dimColor: true }, "No matching provider/model configured.")
        : filtered.map((opt, i) =>
            h(
              Box,
              { key: `${opt.provider}:${opt.model}` },
              h(Text, { color: i === selectedIndex ? "#d97757" : undefined }, i === selectedIndex ? "› " : "  "),
              h(Text, { color: opt.isCurrent ? "#d97757" : undefined }, opt.isCurrent ? "✓ " : "  "),
              h(Text, null, opt.model),
              h(Text, { color: "gray" }, "  " + opt.provider),
              h(Text, { color: opt.isFree ? "green" : "gray" }, "  " + opt.priceLabel)
            )
          )
    ),
    h(
      Box,
      { marginTop: 1 },
      h(Text, { color: "gray", dimColor: true }, "↑↓ navigate   ↵ switch   esc cancel   history carries over")
    )
  );
}
