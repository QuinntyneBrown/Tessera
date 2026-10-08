# Video player implementation record

The automated video player implementation (L2-057 to L2-084) is complete. Each production slice was built test first: its Chromium Playwright acceptance tests, written through `VideoPlayerPage` (`test/e2e/pages/video-player-page.ts`), ran and failed for the stated reason before production code was written. Where a criterion's behaviour already existed from an earlier slice, its test passed on first run and is recorded as such. No mock or architecture tests were added. The manual release gate (L2-083) and the demonstration backend (L2-085 to L2-094) remain open.

Every slice is one commit on the `video-player` branch; its message repeats the red and green evidence.

| Slice | Criteria | Red evidence | Green evidence |
|---|---|---|---|
| 1. Package and idle region | L2-066 AC6, L2-070 AC1, L2-071 AC1 | `t-video-player` absent on `/video-player` | Region, hidden native controls and empty live region; library build, lint and full e2e (bar one pre-existing combobox flake) |
| 2. Connect and apply the descriptor | L2-057 AC1, L2-058 AC1/3, L2-066 AC1, L2-070 AC5, L2-071 AC2 | State stayed idle; region never named | Five tests pass |
| 3. Codec check and describe failures | L2-058 AC2/4, L2-068 AC1/2, L2-071 AC5, L2-078 AC5 | No alert rendered | Nine tests pass |
| 4. First frame through MSE | L2-057 AC1, L2-059 AC1/2, L2-060 AC1, L2-066 AC6 | `readyState` never reached 2 | Init appended first, appends serialised, one growing range across fixture loops; three repeats |
| 5. Rebuild, early media, decode, quota | L2-059 AC3-6 | One object URL, no decode alert | Seven pipeline tests; the early-media warning predated its test and a mutation removing it fails the test |
| 6. Live edge, pruning, stats, LIVE badge | L2-060 AC2/3/5/6, L2-070 AC4, L2-071 AC6, L2-075 AC5 | No stats, no prune, no badge | 13 pipeline tests, three repeats |
| 7. Pause and resume to live | L2-060 AC4, L2-061 AC1-4/6, L2-070 AC2 | No control group | Five tests, three repeats |
| 8. Mute, volume, autoplay fallback | L2-062 AC1-5, L2-070 AC3, L2-071 AC4, L2-075 AC1 | No mute control or slider | 13 controls tests twice |
| 9. Fullscreen on the host | L2-063 AC1/2/3/5, L2-069 AC5 | No Fullscreen control; the omitted-control test passed first and fails under mutation | 54 of 54 runs |
| 10. Captions | L2-064 AC1-4 | No track | 44 of 44 runs; null-captions test verified by mutation |
| 11. Buffering, stalls, ended | L2-061 AC5, L2-066 AC2-6, L2-068 AC2 | All five status tests failed | 54 of 54 runs |
| 12. Reconnection | L2-067 AC1-6 | Policy unit spec did not compile; seven resilience tests failed | 21 of 21 runs with two workers |
| 13. Error mapping and focus | L2-068 AC1-5, L2-070 AC6 | Six tests failed | 26 of 26 runs |
| 14. Keyboard and focus recovery | L2-069 AC1-7 | Seven of nine failed; slider and Tab-order tests passed first | Nine tests twice |
| 15. ARIA catalogue and coalescing | L2-057 AC5, L2-070 AC1-3, L2-071 AC1/3 | Two-player test failed until the fixture rendered a second player | Behaviour built earlier; coalescing unit test fails if the window restarts |
| 16. Auto-hide and touch | L2-061 AC3, L2-063 AC4, L2-065, L2-074 AC1/2/4 | Eight of eleven failed | 34 of 34 runs |
| 17. Responsive layout | L2-062 AC6, L2-069 AC7, L2-073, L2-074 AC3 | Eight of twelve failed | 24 of 24 runs; whole suite 98 of 98 |
| 18. Theme, contrast, motion, forced colours | L2-064 AC5, L2-072, L2-077 AC1-3 | Seven of eight failed | 20 of 20; whole suite 106 of 106 |
| 19. SignalR transport | L2-057 AC1/5/6, L2-075 AC2-4, L2-078 AC2/3, L2-082 AC5 | Adapter spec did not compile; warning tests failed | 12 unit tests; 14 of 14 runs |
| 20. Localisation | L2-070 AC7, L2-076 | Override and number tests failed; i18n spec did not compile | 19 unit tests; 22 of 22 runs |
| 21. Untrusted text and token | L2-058 AC5, L2-078 AC1-3 | Hostile-title tests failed | 8 of 8 runs |
| 22. Stream switch and release | L2-057 AC2-4, L2-063 AC5, L2-080 | Five of six failed | 12 of 12 runs, including 100 create-and-destroy cycles |
| 23. Performance | L2-079 | Measurement only; passed once the probes were right | See below |
| 24. Consumer harness | L2-081 | "VideoPlayerHarness unavailable" | Contract passes twice |
| 25. Examples, dev app, documentation | L2-078 AC4, L2-082 AC6, L2-083 (record), L2-084 | Examples screen absent; backend spec skips | Examples pass twice; dev app shows the fallback notice and plays the fixture |

## Measured performance (L2-079)

Measured in Chromium on the development machine with `pnpm e2e:performance`:

| Budget | Result |
|---|---|
| First frame at 4x CPU slowdown, 100 runs | p50 166 ms, p95 202 ms, max 243 ms (budget 2000 ms in 95 runs) |
| Buffer behind the playhead over ten media minutes | 30 to 32 s in every sample (budget 61 s) |
| Long tasks across 100 appends of 200 KB | One long task (132 ms) overlapped one append (budget 5) |
| Component timers while paused for 10 s | Only the statistics interval, 10 times |
| Control bar reveal at 200% text | Within one frame in 20 of 20 runs |

Chrome's `performance.memory` is coarse in this environment, so the heap-growth check is weak evidence.

## Test environment notes

- The development machine had about 1.4 GB of free memory, and six parallel Chromium workers decoding video closed pages. Local runs used two workers; CI's default is two.
- Page-object assertions wait up to 15 s and video specs allow 60 s per test, because first frames on the loaded machine exceeded Playwright's defaults.
- The fixture paces fragments from a worker, so Playwright's fake clock never starves the media; with a frozen clock, assertions that follow a timer advance one animation frame for the render.
- Fullscreen is stubbed in the page object because headless Chromium does not honour it; real fullscreen is part of the manual matrix.
