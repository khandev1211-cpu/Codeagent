---
name: mobile-performance
description: Diagnose and fix mobile app performance issues (slow rendering, jank, excessive battery/memory use). Use when a mobile app feels slow or asked to improve mobile performance.
allowed-tools: read_file, run_bash, search_code
---

# Mobile Performance

1. Profile with the platform's real tooling (Xcode Instruments, Android Studio Profiler, React Native's profiler, `run_bash` where applicable) rather than guessing — mobile performance issues are often not where intuition suggests, same principle as the general performance-profiling skill.
2. Check list rendering first for scrolling jank — an unvirtualized long list is the single most common mobile rendering performance bug (see the platform-specific practices skills).
3. Watch memory usage specifically — mobile devices have much less headroom than a typical server/desktop, and a slow memory leak that's tolerable in a long-lived server process can crash a mobile app much sooner.
4. Minimize main-thread/UI-thread work — heavy computation, JSON parsing, or synchronous I/O on the main thread causes visible jank; move it to a background thread/coroutine/worker.
5. Check network efficiency for a mobile-specific reason beyond general API design — mobile networks are slower and less reliable, so unnecessary requests, uncompressed payloads, or missing caching are felt more acutely than on a fast, stable connection.
6. Battery impact matters as a real metric, not just speed — excessive background work, frequent location/network polling, or keeping the screen awake unnecessarily are mobile-specific costs a desktop/web performance mindset can miss.
