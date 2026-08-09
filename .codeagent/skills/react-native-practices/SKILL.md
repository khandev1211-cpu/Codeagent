---
name: react-native-practices
description: Write idiomatic React Native code. Use when writing or reviewing React Native components or navigation.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# React Native Practices

- Use `FlatList`/`SectionList` for any list of non-trivial or unbounded length, never `.map()` over a plain `ScrollView` — the latter renders every item immediately with no virtualization, which is a real, common performance bug on long lists.
- Keep platform-specific code isolated (`.ios.js`/`.android.js` file extensions, or explicit `Platform.select`) rather than scattering inline platform checks throughout shared component logic.
- Match the project's existing navigation library conventions (React Navigation is the common default) rather than introducing a different pattern for one new screen.
- Test on both platforms for anything touching layout or platform-specific APIs — a component that looks correct on iOS can render differently on Android due to real platform differences (elevation/shadow handling, default font metrics).
- Avoid unnecessary re-renders in list item components specifically — since list items can render many times, an unmemoized item component with an inline function/object prop (creating a new reference every render) is a more impactful performance issue here than in a typical one-off component.
- Check bundle size impact of new dependencies — mobile apps have a real install-size cost that a web app doesn't feel the same way.
