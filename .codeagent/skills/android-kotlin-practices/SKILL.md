---
name: android-kotlin-practices
description: Write idiomatic Android code with Kotlin (Jetpack Compose or the View system). Use when writing or reviewing Android UI and app architecture.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Android Kotlin Practices

- Follow the project's existing UI toolkit convention (Jetpack Compose vs. the traditional View/XML system) rather than mixing both for one new screen unless there's a specific interop reason.
- Use `ViewModel` to hold UI state that should survive configuration changes (rotation) — state held directly in an Activity/Fragment/Composable without a ViewModel is lost on rotation, a very common, easy-to-miss Android bug.
- In Compose specifically: hoist state to the appropriate level (stateless composables where possible, state owned by the caller) rather than each composable managing its own state independently, which makes composition and testing harder.
- Use `LazyColumn`/`LazyRow` (Compose) or `RecyclerView` (Views) for lists, never rendering an unbounded list without virtualization.
- Respect the Android lifecycle explicitly for anything holding a resource (a listener, a coroutine scope tied to the UI) — cancel/unregister in the corresponding lifecycle callback to avoid leaking a reference to a destroyed Activity/Fragment.
- Use Kotlin coroutines with the project's existing structured-concurrency conventions (`viewModelScope`, `lifecycleScope`) rather than manually managed threads for async work.
