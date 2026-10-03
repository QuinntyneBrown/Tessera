# Combobox performance evidence

The isolated Chromium run on 2026-10-03 passed all five checks. The default-debounce typing burst produced exactly one request. Each latency run discarded ten warm-ups and retained 100 samples; at least 95 samples must meet its threshold.

| Scenario | CPU slowdown | Limit (ms) | Median (ms) | 95th percentile (ms) | Maximum (ms) | Within limit | Raw samples |
|---|---|---|---|---|---|---|---|
| Typing with slow search pending | 1× | 100 | 6.5 | 8.8 | 9.4 | 100/100 | [JSON](combobox-performance/typing-timings.json) |
| Rendering 50 options | 4× | 200 | 46.6 | 61.2 | 81.7 | 100/100 | [JSON](combobox-performance/rendering-timings.json) |
| Toggling with 200 selected chips | 4× | 200 | 59.6 | 86.4 | 101.6 | 100/100 | [JSON](combobox-performance/toggling-timings.json) |
| Navigating 250 loaded options | 1× | 100 | 17.1 | 20.0 | 32.5 | 100/100 | [JSON](combobox-performance/navigation-timings.json) |

Environment: Windows build 10.0.26200, Snapdragon X 12-core X1E80100 at 3.40 GHz, 16,757,260,288 bytes reported RAM, Node 22.23.2, Playwright 1.63.0, Chromium 153.0.8010.12. Windows power scheme was High performance, read using `powercfg /getactivescheme`. Revision `4f4ea1c34302c480d86d8258285db1cd875c77b9` plus the uncommitted combobox implementation. Raw files contain timestamps and full machine/tool metadata.

Measurements begin at browser keydown or source emission and end at the first requestAnimationFrame containing the expected state, followed by a frame opportunity. The run uses headless Chromium with one worker and no concurrent test/build commands. It does not certify foreground display or screen-reader latency, or prove absence of unrelated system workloads. The foreground-browser condition in the design has not been manually verified.

Rerun `pnpm e2e:performance` after installing Chromium. Set `TESSERA_E2E_PORT` when the default port is occupied and `TESSERA_PERFORMANCE_POWER_MODE` to the observed power scheme. CI saves timing files under `test-results` before the packed-consumer run resets that directory. Timing files are written before threshold assertions so failed measurements are retained as well.
