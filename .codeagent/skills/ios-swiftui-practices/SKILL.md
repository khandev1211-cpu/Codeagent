---
name: ios-swiftui-practices
description: Write idiomatic SwiftUI code for iOS/macOS. Use when writing or reviewing SwiftUI views and state management.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# iOS SwiftUI Practices

- Use the right property wrapper deliberately: `@State` for local view state, `@Binding` for state owned by a parent, `@ObservedObject`/`@StateObject` for reference-type external models (with `@StateObject` specifically for state the view itself owns and creates) — using the wrong one is a common source of subtle bugs (state resetting unexpectedly, or a view not updating).
- Keep views small and composed — a single massive `body` with deeply nested modifiers is hard to read and hard for SwiftUI to diff efficiently; extract subviews for distinct logical sections.
- Avoid putting business logic directly in a view's `body` — keep it in a view model/observable object, so it's testable independent of the UI rendering.
- Use `LazyVStack`/`LazyHStack`/`List` for long or unbounded content, not a plain `VStack` inside a `ScrollView`, for the same virtualization reason as React Native's `FlatList`.
- Respect accessibility from the start — `accessibilityLabel`, Dynamic Type support (avoid fixed font sizes that don't scale with the user's text-size setting), and sufficient tap target sizes.
- Match the project's existing architecture pattern (MVVM is common with SwiftUI) rather than introducing a different one for a single new screen.
