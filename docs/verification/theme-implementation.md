# Shared theme implementation verification

## Acceptance workflow

Requirements: L1-019 and L2-051 through L2-056. Browser acceptance tests use Chromium and the ThemePage page object; production slices begin with a demonstrated expected failure.

- Foundation red: applying dark mode retained `rgb(24, 49, 46)` rather than `rgb(244, 247, 245)`. Green: theme creation, application, replacement, nesting and clearing passed; the theme package compiled.
- Combobox red: the input retained its light color after the host applied a dark theme. Verification includes legacy inherited overrides and inline/detached overlays.
- Player red: applying dark mode retained black rather than the shared foreground. Verification includes loading/error states, contrast, keyboard navigation, isolated course styles and responsive adaptations.
- Packed consumer red: its build could not resolve `@tessera/theme` from the installed combobox tarball. Green: a strict application imports the TypeScript API and exported Sass module and themes both installed component packages.
- Tooltip cleanup red: after replacing detached tooltips and destroying the component, three media subscriptions remained instead of zero. Release verification includes restoration to the warm subscription baseline.

## Manual release checks

Status: **Pending; no manual screen-reader or actual browser zoom result is inferred from automation.**

| Assistive technology | Browser / platform | Result |
| --- | --- | --- |
| NVDA | Chrome / Windows | Not run |
| JAWS | Chrome / Windows | Not run |
| VoiceOver | Chromium / macOS | Not run |
| TalkBack | Chrome / Android | Not run |
| Narrator | Chromium / Windows | Not run |
| Actual 400% browser zoom | Chrome / Windows | Not run |

For each combination, record tester, commit, date, OS, browser and AT versions, fixture URL, outcome and defects. Operate both components entirely by keyboard in light/dark themes. Change themes during an open combobox list/tooltip and an active course; check focus, selection, announcements, loading/error speech, navigation and persistence. Check nested themes and existing overrides. Repeat forced colors, enlarged text and text spacing. Test a real 1280 × 1024 browser window at actual 400% zoom, including all controls and horizontal overflow. A 320 × 256 reflow viewport does not establish actual browser zoom.
