---
name: serialization-formats
description: Choose and correctly use a serialization format (JSON, Protocol Buffers, MessagePack, XML, etc.) for a specific use case. Use when adding a new data interchange format or reviewing an existing choice.
allowed-tools: read_file, write_file, edit_file
---

# Serialization Formats

- JSON is the reasonable default for human-readable, web-facing, loosely-versioned data — reach for something else only for a specific reason (performance, strict schema enforcement, binary efficiency), not by default.
- Protocol Buffers/Avro/similar schema-first binary formats are worth it when you need compact size, strong cross-language typing, and schema evolution guarantees (adding a field without breaking old consumers) — the schema-definition overhead pays for itself at that scale.
- Understand the format's actual type fidelity — JSON has no native `Date` or large-integer type, no distinction between int/float beyond "number" — decide explicitly how those get represented rather than discovering the gap in production.
- For anything versioned/evolving over time, understand the format's compatibility rules (Protobuf's field numbering rules, JSON's lack of enforced schema at all) and follow them deliberately when changing a message shape.
- Don't invent a custom binary format unless there's a genuinely specific reason an existing one doesn't fit — a hand-rolled format usually means hand-rolled bugs in edge cases well-established libraries have already solved.
